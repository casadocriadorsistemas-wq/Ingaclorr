import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Category, Coupon, StoreSettings, OrderRecord, CartItem, SystemSubscription } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_COUPONS, DEFAULT_SETTINGS, DEFAULT_SUBSCRIPTION } from '../data/defaultData';

const LOCAL_PRODUCTS_KEY = 'pet_store_products_v1';
const LOCAL_CATEGORIES_KEY = 'pet_store_categories_v1';
const LOCAL_COUPONS_KEY = 'pet_store_coupons_v1';
const LOCAL_SETTINGS_KEY = 'pet_store_settings_v1';
const LOCAL_SUBSCRIPTION_KEY = 'pet_store_subscription_v1';
const LOCAL_ORDERS_KEY = 'pet_store_orders_v1';
const SEED_LOCK_KEY = 'pet_store_seeded_lock_v1';

let isSeedingInProgress = false;

// Seed initial setup to Firestore (categories, settings and coupons if empty).
// NOTE: We NEVER seed fictitious/mock products into Firestore. If empty, it stays blank as requested.
export async function seedInitialDataIfNeeded(): Promise<void> {
  if (isSeedingInProgress) return;
  
  isSeedingInProgress = true;
  try {
    const categoriesSnap = await getDocs(collection(db, 'categories'));
    if (categoriesSnap.empty) {
      const batch = writeBatch(db);
      for (const cat of DEFAULT_CATEGORIES) {
        batch.set(doc(db, 'categories', cat.id), cat);
      }
      await batch.commit();
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    }

    // Check settings & coupons without adding any fictitious products
    const settingsSnap = await getDoc(doc(db, 'settings', 'config'));
    if (!settingsSnap.exists()) {
      const batch = writeBatch(db);
      for (const coup of DEFAULT_COUPONS) {
        batch.set(doc(db, 'coupons', coup.id), coup);
      }
      batch.set(doc(db, 'settings', 'config'), DEFAULT_SETTINGS);
      await batch.commit();
    }
    localStorage.setItem(SEED_LOCK_KEY, 'true');
  } catch (error) {
    console.warn('Initial seeding note (working with local data if offline):', error);
  } finally {
    isSeedingInProgress = false;
  }
}

// Active In-Memory Listeners for Instant UI updates
const productListeners = new Set<(products: Product[]) => void>();
const categoryListeners = new Set<(categories: Category[]) => void>();
const couponListeners = new Set<(coupon: Coupon[]) => void>();

function notifyProductListeners(products: Product[]) {
  productListeners.forEach((cb) => {
    try { cb(products); } catch (e) { console.error(e); }
  });
}

function notifyCategoryListeners(categories: Category[]) {
  categoryListeners.forEach((cb) => {
    try { cb(categories); } catch (e) { console.error(e); }
  });
}

function notifyCouponListeners(coupons: Coupon[]) {
  couponListeners.forEach((cb) => {
    try { cb(coupons); } catch (e) { console.error(e); }
  });
}

// Subscribe to Products with change detection: keeps data blank if database has no products
export function subscribeProducts(callback: (products: Product[]) => void): () => void {
  productListeners.add(callback);
  let lastJson = '';

  const cached = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  if (cached) {
    try {
      lastJson = cached;
      callback(JSON.parse(cached));
    } catch {
      lastJson = JSON.stringify([]);
      callback([]);
    }
  } else {
    // When no cache exists, default to empty blank list []
    lastJson = JSON.stringify([]);
    callback([]);
  }

  let firestoreUnsub = () => {};
  try {
    firestoreUnsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: Product[] = [];
      if (!snapshot.empty) {
        snapshot.forEach((d) => {
          prods.push(d.data() as Product);
        });
      }
      // When snapshot is empty, prods is [] and accurately clears the screen and cache
      const newJson = JSON.stringify(prods);
      if (newJson !== lastJson) {
        lastJson = newJson;
        localStorage.setItem(LOCAL_PRODUCTS_KEY, newJson);
        notifyProductListeners(prods);
      }
    }, (error) => {
      console.warn('Products listener note:', error.message);
    });
  } catch {}

  return () => {
    productListeners.delete(callback);
    firestoreUnsub();
  };
}

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined) as any;
  }
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as any;
  }
  return obj;
}

export async function saveProduct(product: Product): Promise<boolean> {
  const cached = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  let list: Product[] = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(p => p.id === product.id);
  if (idx >= 0) {
    list[idx] = product;
  } else {
    list.push(product);
  }
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(list));
  notifyProductListeners(list);

  try {
    const cleanDoc = sanitizeForFirestore(product);
    await setDoc(doc(db, 'products', product.id), cleanDoc);
    return true;
  } catch (err) {
    console.error('Product save to Firestore error:', err);
    throw err;
  }
}

export async function saveProductsBulk(
  newProducts: Product[],
  newCategories: Category[] = []
): Promise<boolean> {
  // 1. Update Categories locally
  if (newCategories.length > 0) {
    const cachedCats = localStorage.getItem(LOCAL_CATEGORIES_KEY);
    let catList: Category[] = cachedCats ? JSON.parse(cachedCats) : [...DEFAULT_CATEGORIES];
    for (const cat of newCategories) {
      const idx = catList.findIndex(c => c.id === cat.id || c.name.toLowerCase() === cat.name.toLowerCase());
      if (idx >= 0) catList[idx] = cat;
      else catList.push(cat);
    }
    localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(catList));
    notifyCategoryListeners(catList);
  }

  // 2. Update Products locally
  const cachedProds = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  let prodList: Product[] = cachedProds ? JSON.parse(cachedProds) : [];
  for (const prod of newProducts) {
    const idx = prodList.findIndex(p => p.id === prod.id || p.name.toLowerCase() === prod.name.toLowerCase());
    if (idx >= 0) prodList[idx] = prod;
    else prodList.push(prod);
  }
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(prodList));
  notifyProductListeners(prodList);

  // 3. Commit to Firestore in chunks (max 300 operations per batch)
  try {
    const operations: { ref: any; data: any }[] = [];

    for (const cat of newCategories) {
      operations.push({
        ref: doc(db, 'categories', cat.id),
        data: sanitizeForFirestore(cat),
      });
    }

    for (const prod of newProducts) {
      operations.push({
        ref: doc(db, 'products', prod.id),
        data: sanitizeForFirestore(prod),
      });
    }

    const CHUNK_SIZE = 300;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        batch.set(op.ref, op.data);
      }
      await batch.commit();
    }

    return true;
  } catch (err: any) {
    console.error('CRITICAL: Error committing bulk products to Firestore:', err);
    throw new Error(err.message || 'Erro ao gravar os produtos no Firestore.');
  }
}

export async function removeProduct(productId: string): Promise<boolean> {
  const cached = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  let list: Product[] = cached ? JSON.parse(cached) : [];
  const updated = list.filter(p => p.id !== productId);
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updated));
  notifyProductListeners(updated);

  try {
    await deleteDoc(doc(db, 'products', productId));
    return true;
  } catch (err) {
    console.warn('Product deleted locally, Firestore error:', err);
    return true;
  }
}

// Clear all products completely from Firestore and local storage (for clean database)
export async function clearAllProducts(): Promise<boolean> {
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify([]));
  notifyProductListeners([]);

  try {
    const snap = await getDocs(collection(db, 'products'));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error('Error clearing products collection from Firestore:', err);
    throw err;
  }
}

// Categories
export function subscribeCategories(callback: (categories: Category[]) => void): () => void {
  categoryListeners.add(callback);
  let lastJson = '';

  const cached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
  if (cached) {
    try {
      lastJson = cached;
      callback(JSON.parse(cached));
    } catch {}
  } else {
    lastJson = JSON.stringify(DEFAULT_CATEGORIES);
    callback(DEFAULT_CATEGORIES);
  }

  let firestoreUnsub = () => {};
  try {
    firestoreUnsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      if (!snapshot.empty) {
        const cats: Category[] = [];
        snapshot.forEach((d) => {
          cats.push(d.data() as Category);
        });
        cats.sort((a, b) => a.sortOrder - b.sortOrder);
        const newJson = JSON.stringify(cats);
        if (newJson !== lastJson) {
          lastJson = newJson;
          localStorage.setItem(LOCAL_CATEGORIES_KEY, newJson);
          notifyCategoryListeners(cats);
        }
      } else {
        // If snapshot is empty, check if we need to seed or if user legitimately emptied it
        const currentCached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        if (!currentCached) {
          localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
          notifyCategoryListeners(DEFAULT_CATEGORIES);
        }
      }
    }, (err) => console.warn('Categories listener note:', err.message));
  } catch {}

  return () => {
    categoryListeners.delete(callback);
    firestoreUnsub();
  };
}

export async function saveCategory(category: Category): Promise<boolean> {
  const cached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
  let list: Category[] = cached ? JSON.parse(cached) : [...DEFAULT_CATEGORIES];
  const idx = list.findIndex(c => c.id === category.id);
  if (idx >= 0) list[idx] = category;
  else list.push(category);
  localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(list));
  notifyCategoryListeners(list);

  try {
    await setDoc(doc(db, 'categories', category.id), category);
    return true;
  } catch (err) {
    console.warn('Category saved locally:', err);
    return true;
  }
}

export async function removeCategory(categoryId: string): Promise<boolean> {
  const cached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
  let list: Category[] = cached ? JSON.parse(cached) : [...DEFAULT_CATEGORIES];
  const updated = list.filter(c => c.id !== categoryId);
  localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));
  notifyCategoryListeners(updated);

  try {
    await deleteDoc(doc(db, 'categories', categoryId));
    return true;
  } catch (err) {
    console.warn('Category deleted locally:', err);
    return true;
  }
}

// Coupons
export function subscribeCoupons(callback: (coupons: Coupon[]) => void): () => void {
  couponListeners.add(callback);
  let lastJson = '';

  const cached = localStorage.getItem(LOCAL_COUPONS_KEY);
  if (cached) {
    try {
      lastJson = cached;
      callback(JSON.parse(cached));
    } catch {}
  } else {
    lastJson = JSON.stringify(DEFAULT_COUPONS);
    callback(DEFAULT_COUPONS);
  }

  let firestoreUnsub = () => {};
  try {
    firestoreUnsub = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      if (!snapshot.empty) {
        const list: Coupon[] = [];
        snapshot.forEach(d => list.push(d.data() as Coupon));
        const newJson = JSON.stringify(list);
        if (newJson !== lastJson) {
          lastJson = newJson;
          localStorage.setItem(LOCAL_COUPONS_KEY, newJson);
          callback(list);
        }
      }
    }, (err) => console.warn('Coupons listener note:', err.message));
  } catch {}

  return () => {
    couponListeners.delete(callback);
    firestoreUnsub();
  };
}

export async function saveCoupon(coupon: Coupon): Promise<boolean> {
  const cached = localStorage.getItem(LOCAL_COUPONS_KEY);
  let list: Coupon[] = cached ? JSON.parse(cached) : [...DEFAULT_COUPONS];
  const idx = list.findIndex(c => c.id === coupon.id);
  if (idx >= 0) list[idx] = coupon;
  else list.push(coupon);
  localStorage.setItem(LOCAL_COUPONS_KEY, JSON.stringify(list));
  notifyCouponListeners(list);

  try {
    await setDoc(doc(db, 'coupons', coupon.id), coupon);
    return true;
  } catch (err) {
    console.warn('Coupon saved locally:', err);
    return true;
  }
}

export async function removeCoupon(couponId: string): Promise<boolean> {
  const cached = localStorage.getItem(LOCAL_COUPONS_KEY);
  let list: Coupon[] = cached ? JSON.parse(cached) : [...DEFAULT_COUPONS];
  const updated = list.filter(c => c.id !== couponId);
  localStorage.setItem(LOCAL_COUPONS_KEY, JSON.stringify(updated));
  notifyCouponListeners(updated);

  try {
    await deleteDoc(doc(db, 'coupons', couponId));
    return true;
  } catch (err) {
    console.warn('Coupon deleted locally:', err);
    return true;
  }
}

// Settings
const settingsListeners = new Set<(settings: StoreSettings) => void>();

export function getStoredSettings(): StoreSettings {
  try {
    const cached = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (cached) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function getStoredAdminPassword(): string {
  try {
    const cached = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.adminPassword && String(parsed.adminPassword).trim()) {
        return String(parsed.adminPassword).trim();
      }
    }
  } catch {}
  return DEFAULT_SETTINGS.adminPassword || '1234';
}

export function subscribeSettings(callback: (settings: StoreSettings) => void): () => void {
  settingsListeners.add(callback);
  let lastJson = '';

  const cached = localStorage.getItem(LOCAL_SETTINGS_KEY);
  if (cached) {
    try {
      lastJson = cached;
      callback(JSON.parse(cached));
    } catch {}
  } else {
    lastJson = JSON.stringify(DEFAULT_SETTINGS);
    callback(DEFAULT_SETTINGS);
  }

  try {
    const unsub = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as StoreSettings;
        const newJson = JSON.stringify(data);
        if (newJson !== lastJson) {
          lastJson = newJson;
          localStorage.setItem(LOCAL_SETTINGS_KEY, newJson);
          callback(data);
        }
      }
    }, (err) => console.warn('Settings listener note:', err.message));
    return () => {
      settingsListeners.delete(callback);
      unsub();
    };
  } catch {
    return () => {
      settingsListeners.delete(callback);
    };
  }
}

export async function saveSettings(settings: StoreSettings): Promise<boolean> {
  try {
    // 1. Always save in localStorage instantly
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));

    // 2. Notify all active in-memory listeners immediately so React components update instantaneously
    settingsListeners.forEach(listener => {
      try {
        listener(settings);
      } catch (e) {
        console.warn('Listener notification error in saveSettings:', e);
      }
    });

    // 3. Persist to Firestore
    await setDoc(doc(db, 'settings', 'config'), settings, { merge: true });
    return true;
  } catch (err) {
    console.warn('Settings saved locally, Firestore update note:', err);
    return true;
  }
}

// System Subscription Management (Admin Master xT7$mQ2!vB9#)
export function subscribeSubscription(callback: (sub: SystemSubscription) => void): () => void {
  let lastJson = '';

  const cached = localStorage.getItem(LOCAL_SUBSCRIPTION_KEY);
  if (cached) {
    try {
      lastJson = cached;
      callback(JSON.parse(cached));
    } catch {}
  } else {
    lastJson = JSON.stringify(DEFAULT_SUBSCRIPTION);
    localStorage.setItem(LOCAL_SUBSCRIPTION_KEY, lastJson);
    callback(DEFAULT_SUBSCRIPTION);
  }

  try {
    const unsub = onSnapshot(doc(db, 'settings', 'subscription'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SystemSubscription;
        const newJson = JSON.stringify(data);
        if (newJson !== lastJson) {
          lastJson = newJson;
          localStorage.setItem(LOCAL_SUBSCRIPTION_KEY, newJson);
          callback(data);
        }
      } else {
        setDoc(doc(db, 'settings', 'subscription'), DEFAULT_SUBSCRIPTION, { merge: true }).catch(() => {});
      }
    }, (err) => console.warn('Subscription listener note:', err.message));
    return unsub;
  } catch {
    return () => {};
  }
}

export async function saveSubscription(sub: SystemSubscription): Promise<boolean> {
  try {
    localStorage.setItem(LOCAL_SUBSCRIPTION_KEY, JSON.stringify(sub));
    await setDoc(doc(db, 'settings', 'subscription'), sub, { merge: true });
    return true;
  } catch (err) {
    console.warn('Subscription saved locally, Firestore update note:', err);
    return true;
  }
}

export function checkIsSubscriptionExpired(sub: SystemSubscription): {
  isExpired: boolean;
  daysRemaining: number;
  formattedDueDate: string;
} {
  if (sub.isExpiredManualOverride) {
    const [y, m, d] = (sub.dueDate || '').split('-').map(Number);
    const formattedDueDate = y && m && d ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : 'Hoje';
    return {
      isExpired: true,
      daysRemaining: 0,
      formattedDueDate,
    };
  }

  if (!sub.dueDate) {
    return { isExpired: false, daysRemaining: 999, formattedDueDate: '' };
  }

  const [y, m, d] = sub.dueDate.split('-').map(Number);
  if (!y || !m || !d) {
    return { isExpired: false, daysRemaining: 999, formattedDueDate: '' };
  }

  const dueDateTime = new Date(y, m - 1, d, 23, 59, 59).getTime();
  const now = Date.now();
  const diffMs = dueDateTime - now;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = now > dueDateTime;
  const formattedDueDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

  return {
    isExpired,
    daysRemaining,
    formattedDueDate,
  };
}

// Orders
export async function createOrder(order: OrderRecord): Promise<void> {
  const cached = localStorage.getItem(LOCAL_ORDERS_KEY);
  const list: OrderRecord[] = cached ? JSON.parse(cached) : [];
  list.unshift(order);
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(list));

  try {
    await setDoc(doc(db, 'orders', order.id), order);
  } catch (err) {
    console.warn('Order saved locally, firestore write note:', err);
  }
}

export function subscribeOrders(callback: (orders: OrderRecord[]) => void): () => void {
  let lastJson = '';

  const cached = localStorage.getItem(LOCAL_ORDERS_KEY);
  if (cached) {
    try {
      lastJson = cached;
      callback(JSON.parse(cached));
    } catch {}
  }

  try {
    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders: OrderRecord[] = [];
      snapshot.forEach(d => orders.push(d.data() as OrderRecord));
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const newJson = JSON.stringify(orders);
      if (newJson !== lastJson) {
        lastJson = newJson;
        localStorage.setItem(LOCAL_ORDERS_KEY, newJson);
        callback(orders);
      }
    }, (err) => console.warn('Orders listener note:', err.message));
    return unsub;
  } catch {
    return () => {};
  }
}

export async function updateOrderStatus(orderId: string, status: OrderRecord['status']): Promise<void> {
  const cached = localStorage.getItem(LOCAL_ORDERS_KEY);
  if (cached) {
    const list: OrderRecord[] = JSON.parse(cached);
    const item = list.find(o => o.id === orderId);
    if (item) item.status = status;
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(list));
  }
  try {
    await updateDoc(doc(db, 'orders', orderId), { status });
  } catch (err) {
    console.warn('Update order status locally:', err);
  }
}

// Store Open / Closed Schedule Calculation
export interface StoreOpenStatus {
  isOpen: boolean;
  message: string;
  nextScheduleText: string;
  badgeText: string;
}

export function checkStoreOpenStatus(settings: StoreSettings): StoreOpenStatus {
  if (settings.scheduleMode === 'forced_open') {
    return {
      isOpen: true,
      message: 'Loja Aberta! Faça seu pedido agora.',
      nextScheduleText: 'Atendimento imediato.',
      badgeText: 'ABERTO AGORA',
    };
  }

  if (settings.scheduleMode === 'forced_closed') {
    return {
      isOpen: false,
      message: settings.closedMessage || 'Loja fechada no momento, mas fique à vontade para escolher seus produtos! Entregaremos no primeiro horário de atendimento.',
      nextScheduleText: 'Consulte nosso horário de funcionamento.',
      badgeText: 'LOJA FECHADA',
    };
  }

  // Automatic calculation based on local time
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1-5 = Weekday, 6 = Saturday
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeVal = currentHours * 60 + currentMinutes;

  const parseTime = (timeStr: string) => {
    const [h, m] = (timeStr || '08:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  let openTimeVal = 0;
  let closeTimeVal = 0;
  let isClosedToday = false;
  let scheduleDesc = '';

  if (dayOfWeek === 0) { // Sunday
    if (settings.isSundayClosed) {
      isClosedToday = true;
      scheduleDesc = 'Fechado aos Domingos';
    } else {
      openTimeVal = parseTime(settings.sundayOpen || '08:00');
      closeTimeVal = parseTime(settings.sundayClose || '12:00');
      scheduleDesc = `Domingo das ${settings.sundayOpen} às ${settings.sundayClose}`;
    }
  } else if (dayOfWeek === 6) { // Saturday
    openTimeVal = parseTime(settings.saturdayOpen || '08:00');
    closeTimeVal = parseTime(settings.saturdayClose || '14:00');
    scheduleDesc = `Sábado das ${settings.saturdayOpen} às ${settings.saturdayClose}`;
  } else { // Monday - Friday
    openTimeVal = parseTime(settings.weekdayOpen || '08:00');
    closeTimeVal = parseTime(settings.weekdayClose || '18:30');
    scheduleDesc = `Segunda a Sexta das ${settings.weekdayOpen} às ${settings.weekdayClose}`;
  }

  if (isClosedToday) {
    return {
      isOpen: false,
      message: settings.closedMessage,
      nextScheduleText: `Reabrimos segunda-feira às ${settings.weekdayOpen || '08:00'}`,
      badgeText: 'LOJA FECHADA HOJE',
    };
  }

  const isOpen = currentTimeVal >= openTimeVal && currentTimeVal < closeTimeVal;

  if (isOpen) {
    return {
      isOpen: true,
      message: `Aberto até as ${dayOfWeek === 6 ? settings.saturdayClose : dayOfWeek === 0 ? settings.sundayClose : settings.weekdayClose}!`,
      nextScheduleText: scheduleDesc,
      badgeText: 'ABERTO AGORA',
    };
  }

  let nextInfo = '';
  if (currentTimeVal < openTimeVal) {
    const nextH = Math.floor(openTimeVal / 60).toString().padStart(2, '0');
    const nextM = (openTimeVal % 60).toString().padStart(2, '0');
    nextInfo = `Abrimos hoje às ${nextH}:${nextM}`;
  } else {
    if (dayOfWeek === 5) {
      nextInfo = `Abrimos amanhã (Sábado) às ${settings.saturdayOpen || '08:00'}`;
    } else if (dayOfWeek === 6) {
      if (settings.isSundayClosed) {
        nextInfo = `Abrimos Segunda-feira às ${settings.weekdayOpen || '08:00'}`;
      } else {
        nextInfo = `Abrimos amanhã (Domingo) às ${settings.sundayOpen || '08:00'}`;
      }
    } else {
      nextInfo = `Abrimos amanhã às ${settings.weekdayOpen || '08:00'}`;
    }
  }

  return {
    isOpen: false,
    message: settings.closedMessage,
    nextScheduleText: nextInfo,
    badgeText: 'LOJA FECHADA',
  };
}

// Generate formatted WhatsApp URL
export function generateWhatsAppOrderUrl({
  settings,
  order,
  items,
  isClosed,
}: {
  settings: StoreSettings;
  order: Omit<OrderRecord, 'id' | 'createdAt' | 'status' | 'itemsSummary'>;
  items: CartItem[];
  isClosed: boolean;
}): string {
  const cleanPhone = (settings.whatsappNumber || '').replace(/\D/g, '');
  
  let msg = `🐾 *NOVO PEDIDO - ${(settings.storeName || 'LOJA').toUpperCase()}* 🐾\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (order.isExistingCustomer) {
    msg += `👤 *Cliente:* Já sou cliente cadastrado na loja ✅\n`;
    if (order.customerName && order.customerName !== 'Cliente Cadastrado') {
      msg += `👤 *Nome:* ${order.customerName}\n`;
    }
    msg += `📍 *Modalidade:* ${order.deliveryType === 'delivery' ? '🛵 Entregar no meu endereço já cadastrado' : '🏬 Retirar no Balcão'}\n`;
  } else {
    msg += `👤 *Cliente:* ${order.customerName}\n`;
    msg += `📱 *Telefone:* ${order.customerPhone}\n`;
    msg += `📍 *Modalidade:* ${order.deliveryType === 'delivery' ? '🛵 Entrega em Domicílio' : '🏬 Retirar no Balcão'}\n`;
    if (order.deliveryType === 'delivery') {
      msg += `🏠 *Endereço:* ${order.address}\n`;
    }
  }
  
  msg += `💳 *Forma de Pagamento:* ${order.paymentMethod}\n`;
  if (order.changeFor) {
    msg += `💵 *Troco para:* ${order.changeFor}\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🛒 *ITENS DO PEDIDO:*\n\n`;

  items.forEach((item, index) => {
    msg += `${index + 1}️⃣ *${item.productName}*\n`;
    msg += `   ▫️ ${item.label}\n`;
    if (item.details) {
      msg += `   ▫️ _${item.details}_\n`;
    }
    msg += `   ▫️ Subtotal: R$ ${item.totalPrice.toFixed(2).replace('.', ',')}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💵 *Subtotal:* R$ ${order.subtotal.toFixed(2).replace('.', ',')}\n`;
  
  if (order.discount > 0) {
    msg += `🏷️ *Cupom Desconto (${order.couponCode || 'APLICADO'}):* -R$ ${order.discount.toFixed(2).replace('.', ',')}\n`;
  }

  if (order.deliveryType === 'delivery') {
    if (order.deliveryFee === 0) {
      msg += `🛵 *Taxa de Entrega:* GRÁTIS 🎉\n`;
    } else {
      msg += `🛵 *Taxa de Entrega:* R$ ${order.deliveryFee.toFixed(2).replace('.', ',')}\n`;
    }
  }

  msg += `💰 *TOTAL A PAGAR: R$ ${order.total.toFixed(2).replace('.', ',')}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

  if (order.notes && order.notes.trim()) {
    msg += `📝 *Observações:* ${order.notes.trim()}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  const dateStr = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  msg += `🕒 Pedido gerado em ${dateStr}\n`;

  if (isClosed) {
    msg += `\n⚠️ *Aviso do Cliente:* Sei que a loja está fechada no momento, mas deixo meu pedido registrado para ser entregue/atendido no primeiro horário! Obrigado! 🙏🐾\n`;
  }

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
}
