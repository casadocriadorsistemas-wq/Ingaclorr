import React, { useState } from 'react';
import { 
  Plus, 
  Minus,
  Scale, 
  Package, 
  Check, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Product, CartItem } from '../types';

interface ProductCardProps {
  product: Product;
  onSelectForCustom: (product: Product) => void;
  onAddDirectUnit: (item: CartItem) => void;
  onOpenDetails?: (product: Product) => void;
  hidePetBadges?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectForCustom,
  onAddDirectUnit,
  onOpenDetails,
  hidePetBadges,
}) => {
  const [unitQuantity, setUnitQuantity] = useState(1);
  const isRation = product.sellMode === 'bag_and_bulk' || product.sellMode === 'bag_only' || product.sellMode === 'bulk_only';

  const handleAction = () => {
    if (isRation) {
      onSelectForCustom(product);
    } else {
      // Direct unit item
      const unitPrice = product.unitPrice || 0;
      const qty = Math.max(1, unitQuantity);
      const item: CartItem = {
        cartItemId: `${product.id}-unit-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        type: 'unit',
        label: `${qty}x ${product.unitLabel || 'unidade'}`,
        details: product.unitLabel ? `Embalagem: ${product.unitLabel}` : 'Item unitário',
        unitPrice: unitPrice,
        quantity: qty,
        totalPrice: unitPrice * qty,
      };
      onAddDirectUnit(item);
    }
  };

  const handleOpenDetails = () => {
    if (onOpenDetails) {
      onOpenDetails(product);
    } else {
      handleAction();
    }
  };

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden group ${
      product.isOnSale
        ? 'border-rose-300 hover:border-rose-500 shadow-rose-100/70 shadow-sm hover:shadow-lg'
        : 'border-stone-200/90 hover:border-blue-500/50 shadow-xs hover:shadow-lg'
    }`}>
      {/* Product Image & Badges */}
      <div 
        onClick={handleOpenDetails}
        className="relative aspect-4/3 sm:aspect-square overflow-hidden bg-white flex items-center justify-center p-2.5 sm:p-3 border-b border-stone-100 cursor-pointer"
        title="Ver detalhes do produto"
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Badges overlay */}
        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 flex flex-col gap-1 items-start max-w-[calc(100%-1rem)] z-10">
          {product.isOnSale && (
            <span className="bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded-md shadow-md shadow-rose-600/30 flex items-center gap-1 animate-pulse max-w-full truncate">
              🔥 {product.promoDiscountText || 'PROMOÇÃO'}
            </span>
          )}
          {product.isFeatured && (
            <span className="bg-amber-400 text-stone-900 font-black text-[10px] uppercase px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Mais Pedido
            </span>
          )}
          {product.sellMode === 'bag_and_bulk' && (
            <span className="bg-blue-600 text-white font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-md shadow-xs">
              Saco ou a Granel
            </span>
          )}
          {product.sellMode === 'bulk_only' && (
            <span className="bg-sky-600 text-white font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-md shadow-xs">
              A Granel (Kg ou R$)
            </span>
          )}
        </div>

        {/* Animal Pet Badges - Hidden if hidePetBadges is true */}
        {!hidePetBadges && (
          <div className="absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 z-10 pointer-events-none flex flex-wrap gap-1 justify-end max-w-[85%]">
            {((product.animalTypes && product.animalTypes.length > 0) ? product.animalTypes : [product.animalType || 'dog']).map((pt) => (
              <span key={pt} className="bg-white/95 backdrop-blur-sm text-stone-700 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shadow-xs border border-stone-200/90 flex items-center gap-1">
                {pt === 'cat' ? '🐈 Gatos' :
                 pt === 'bird' ? '🦜 Pássaros' :
                 pt === 'fish' ? '🐠 Peixes' :
                 pt === 'other' ? '🐾 Pets' :
                 '🐕 Cães'}
              </span>
            ))}
          </div>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center">
            <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Esgotado no Momento
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 
            onClick={handleOpenDetails}
            className="font-bold text-stone-900 text-sm sm:text-base leading-snug line-clamp-2 hover:text-blue-600 cursor-pointer transition-colors"
            title="Ver detalhes do produto"
          >
            {product.name}
          </h3>
          <p className="text-stone-500 text-xs mt-1.5 line-clamp-2">
            {product.description}
          </p>
        </div>

        {/* Pricing & Sell Mode Display */}
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
          {/* Bag & Bulk options breakdown */}
          {product.sellMode === 'bag_and_bulk' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-blue-600" /> A granel:
                </span>
                <span className="font-extrabold text-blue-700">
                  R$ {product.bulkPricePerKg?.toFixed(2).replace('.', ',')} / kg
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-stone-400" />
                  {product.bagVariations && product.bagVariations.length > 1
                    ? `Sacos (${product.bagVariations.map(v => `${v.weightKg}k`).join('/')}):`
                    : `Saco (${product.bagVariations?.[0]?.weightKg || product.bagWeightKg || 15}kg):`}
                </span>
                <span className="font-bold text-stone-900">
                  {product.bagVariations && product.bagVariations.length > 1
                    ? `a partir de R$ ${Math.min(...product.bagVariations.map(v => v.price)).toFixed(2).replace('.', ',')}`
                    : `R$ ${(product.bagVariations?.[0]?.price || product.bagPrice || 0).toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>
          )}

          {product.sellMode === 'bulk_only' && (
            <div>
              <span className="text-[11px] text-stone-500 block">Preço a granel:</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-blue-700">
                  R$ {product.bulkPricePerKg?.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-xs font-semibold text-stone-500">/ kg</span>
              </div>
              <span className="text-[10px] text-blue-700 font-semibold block">
                Compre por peso ou por valor em R$ (Ex: R$ 20,00)
              </span>
            </div>
          )}

          {product.sellMode === 'bag_only' && (
            <div>
              <span className="text-[11px] text-stone-500 block">
                {product.bagVariations && product.bagVariations.length > 1
                  ? `Sacos Disponíveis: ${product.bagVariations.map(v => `${v.weightKg}kg`).join(', ')}`
                  : `Saco Fechado (${product.bagVariations?.[0]?.weightKg || product.bagWeightKg || 15}kg):`}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-stone-900">
                  {product.bagVariations && product.bagVariations.length > 1
                    ? `A partir de R$ ${Math.min(...product.bagVariations.map(v => v.price)).toFixed(2).replace('.', ',')}`
                    : `R$ ${(product.bagVariations?.[0]?.price || product.bagPrice || 0).toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>
          )}

          {product.sellMode === 'unit' && (
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-stone-500 block truncate">
                  {product.unitLabel ? `Preço por ${product.unitLabel}:` : 'Preço:'}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-stone-900">
                    R$ {product.unitPrice?.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Seletor de Quantidade do Item Unitário */}
              {product.inStock && (
                <div 
                  className="flex items-center bg-stone-100 border border-stone-200/90 rounded-xl p-0.5 shadow-2xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUnitQuantity((q) => Math.max(1, q - 1));
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-stone-200 text-stone-700 active:scale-90 font-bold transition-all shadow-2xs"
                    title="Diminuir quantidade"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-black text-xs sm:text-sm text-stone-900 select-none">
                    {unitQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUnitQuantity((q) => q + 1);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-stone-200 text-stone-700 active:scale-90 font-bold transition-all shadow-2xs"
                    title="Aumentar quantidade"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleAction}
            disabled={!product.inStock}
            className={`w-full mt-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs ${
              !product.inStock
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : isRation
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-700/20 active:scale-98'
                : 'bg-stone-900 hover:bg-stone-800 text-white active:scale-98'
            }`}
          >
            {isRation ? (
              <>
                <Scale className="w-4 h-4" />
                <span>Escolher Quantidade</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>
                  {unitQuantity > 1
                    ? `Adicionar ${unitQuantity} un. • R$ ${((product.unitPrice || 0) * unitQuantity).toFixed(2).replace('.', ',')}`
                    : 'Adicionar ao Carrinho'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
