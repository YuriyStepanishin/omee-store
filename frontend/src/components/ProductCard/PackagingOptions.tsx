import type { ProductVariant } from '@/types/store';
import css from './ProductCard.module.css';
import { packagingLabel } from './productPackaging';

export default function PackagingOptions({
  variants,
  selected,
  onSelect,
}: {
  variants: ProductVariant[];
  selected?: ProductVariant;
  onSelect: (variant: ProductVariant) => void;
}) {
  if (!variants.length || (variants.length === 1 && selected?.volume == null)) {
    return null;
  }

  return (
    <div className={css.packaging} role="group" aria-label="Фасування">
      <span>Фасування</span>
      <div className={css.packagingOptions}>
        {variants.length === 1 ? (
          <span className={css.packagingOption}>{packagingLabel(variants[0])}</span>
        ) : (
          variants.map(variant => (
            <button
              key={variant.id}
              type="button"
              className={css.packagingOption}
              aria-pressed={variant.id === selected?.id}
              onClick={() => onSelect(variant)}
            >
              {packagingLabel(variant)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
