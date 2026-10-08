/**
 * Service to dynamically sync application branding (Favicon, Apple Icon, and Web App Manifest)
 * with the merchant's configured store logo (.ico, .png, etc.) and store name.
 */

// Default house/store icon in SVG format encoded as data URL
export const DEFAULT_APP_ICON_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="128" fill="%232563eb"/><path d="M144 240 L256 144 L368 240 V368 H144 Z" fill="none" stroke="white" stroke-width="28" stroke-linejoin="round"/><path d="M224 368 V272 H288 V368" fill="none" stroke="white" stroke-width="28" stroke-linejoin="round"/></svg>`;

export function updateAppBranding(logoUrl?: string, storeName?: string) {
  const currentTitle = storeName || 'Catálogo de Vendas';
  document.title = currentTitle;

  const effectiveIcon = logoUrl && logoUrl.trim() ? logoUrl.trim() : DEFAULT_APP_ICON_SVG;
  const isIco = effectiveIcon.toLowerCase().includes('.ico') || effectiveIcon.startsWith('data:image/x-icon');

  // 1. Update or create Favicon link in document head
  let favicon = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.id = 'app-favicon';
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.type = isIco ? 'image/x-icon' : (effectiveIcon.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png');
  favicon.href = effectiveIcon;

  // 2. Update or create Apple Touch Icon for iOS home screen
  let appleIcon = document.getElementById('app-apple-icon') as HTMLLinkElement | null;
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.id = 'app-apple-icon';
    appleIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = effectiveIcon;

  // 3. Dynamically update Web App Manifest for App Installation
  try {
    const manifestObj = {
      id: '/',
      name: currentTitle,
      short_name: currentTitle.slice(0, 12),
      description: `Catálogo e pedidos online - ${currentTitle}`,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#2563eb',
      icons: [
        {
          src: effectiveIcon,
          sizes: '192x192 512x512',
          type: isIco ? 'image/x-icon' : 'image/png',
          purpose: 'any'
        },
        {
          src: effectiveIcon,
          sizes: '192x192 512x512',
          type: isIco ? 'image/x-icon' : 'image/png',
          purpose: 'maskable'
        }
      ]
    };

    const blob = new Blob([JSON.stringify(manifestObj, null, 2)], { type: 'application/manifest+json' });
    const blobUrl = URL.createObjectURL(blob);

    let manifestLink = document.getElementById('app-manifest') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.id = 'app-manifest';
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = blobUrl;
  } catch (err) {
    console.warn('PWA manifest dynamic update note:', err);
  }
}
