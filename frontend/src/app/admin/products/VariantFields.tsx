import { useId } from 'react';
import type { ProductVariant } from '@/types/store';
import css from '../Admin.module.css';

export const units = [
  ['ml', 'мл'], ['l', 'л'], ['g', 'г'], ['kg', 'кг'],
] as const;

type Unit = (typeof units)[number][0];

export type VariantForm = {
  key: string;
  id?: string;
  volume: string;
  unit: Unit | '';
  price: string;
  oldPrice: string;
  stock: string;
  sku: string;
  isActive: boolean;
};

export function variantForm(key: string, variant?: ProductVariant): VariantForm {
  return {
    key,
    id: variant?.id,
    volume: variant?.volume?.toString() ?? '',
    unit: units.find(([id]) => id === variant?.unit)?.[0] ?? '',
    price: variant?.price.toString() ?? '',
    oldPrice: variant?.oldPrice?.toString() ?? '',
    stock: variant?.stock.toString() ?? '0',
    sku: variant?.sku ?? '',
    isActive: variant?.isActive ?? true,
  };
}

type VariantFieldsProps = {
  variants: VariantForm[];
  editing: boolean;
  onChange: (variants: VariantForm[]) => void;
};

export default function VariantFields({ variants, editing, onChange }: VariantFieldsProps) {
  const heading = useId();
  function update(index: number, values: Partial<VariantForm>) {
    onChange(variants.map((row, i) => i === index ? { ...row, ...values } : row));
  }

  return (
    <section className={css.variantList} aria-labelledby={heading}>
      <h3 id={heading}>Фасування товару</h3>
      <p className={css.muted}>Додайте об’єм або вагу та ціну для кожного фасування. Ціну можна заповнити пізніше.</p>
      {variants.map((variant, index) => (
        <fieldset className={css.variantEditor} key={variant.key}>
          <legend>{index === 0 ? 'Основне фасування' : `Фасування ${index + 1}`}</legend>
          <label>Об’єм або вага
            <input type="number" min="0.001" max="1000000" step="any"
              required={Boolean(variant.unit) || (variants.length > 1 && variant.isActive)}
              value={variant.volume} onChange={e => update(index, { volume: e.target.value })} />
          </label>
          <label>Одиниця виміру
            <select required={Boolean(variant.volume) || (variants.length > 1 && variant.isActive)}
              value={variant.unit} onChange={e => update(index, { unit: e.target.value as Unit | '' })}>
              <option value="">Оберіть</option>
              {units.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>Ціна, грн
            <input type="number" min="0" max="9999999999.99" step="0.01"
              value={variant.price} onChange={e => update(index, { price: e.target.value })} />
          </label>
          <label>Залишок, шт.
            <input type="number" min="0" max="1000000" step="1"
              value={variant.stock} onChange={e => update(index, { stock: e.target.value })} />
          </label>
          {editing && (
            <label className={css.check}>
              <input type="checkbox" checked={variant.isActive} onChange={e => update(index, { isActive: e.target.checked })} />
              Показувати фасування
            </label>
          )}
          {index > 0 && !variant.id && (
            <button type="button" className={css.button} onClick={() => onChange(variants.filter((_, i) => i !== index))}>Прибрати</button>
          )}
        </fieldset>
      ))}
      <button type="button" className={css.button} disabled={variants.length >= 40}
        onClick={() => onChange([...variants, variantForm(crypto.randomUUID())])}>Додати фасування</button>
    </section>
  );
}

export function VariantExtraFields({ variants, editing, onChange }: VariantFieldsProps) {
  function update(key: string, values: Partial<VariantForm>) {
    onChange(variants.map(row => row.key === key ? { ...row, ...values } : row));
  }

  return (
    <div className={css.variantList}>
      {variants.map((variant, index) => (
        <fieldset className={css.variantEditor} key={variant.key}>
          <legend>{index === 0 ? 'Основне фасування' : `Фасування ${index + 1}`}</legend>
          <label>Стара ціна, грн
            <input type="number" min="0" max="9999999999.99" step="0.01"
              value={variant.oldPrice} onChange={e => update(variant.key, { oldPrice: e.target.value })} />
          </label>
          <label>Артикул
            <input
              required={Boolean(variant.id) || (editing && index === 0)}
              maxLength={100}
              placeholder="Автоматично при збереженні"
              value={variant.sku}
              onChange={e => update(variant.key, { sku: e.target.value })}
            />
          </label>
        </fieldset>
      ))}
    </div>
  );
}
