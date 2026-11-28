import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogDetails } from '../src/models/catalogDetails.js';
test('catalog exposes database brand, groups and readable features without import internals', () => {
  const result = catalogDetails({
    category: 'Full Force',
    description: 'Опис з Бази Даних',
    characteristics: {
      brand: 'Full Force',
      sourceCategory: 'Шампуні',
      sourceSubcategory: 'Для блонду',
      sourceFile: 'private.json',
      sourceData: {
        usage: 'Нанести на волосся',
        inciIngredients: 'Water',
        characteristics: { 'Об’єм': '250 мл' },
      },
      sourcePrice: '99',
      pH: '5',
    },
  });
  assert.equal(result.brand, 'Full Force');
  assert.equal(result.group, 'Шампуні');
  assert.equal(result.subcategory, 'Для блонду');
  assert.equal(result.description, 'Опис з Бази Даних');
  assert.deepEqual(result.characteristics, { 'Об’єм': '250 мл', pH: '5' });
  assert.equal(result.details[0].text, 'Нанести на волосся');
  assert.ok(!JSON.stringify(result).includes('private.json'));
});
test('brand category is not invented as product group; description falls back to stored source', () => {
  const result = catalogDetails({
    category: 'Cotril',
    description: '',
    characteristics: {
      brand: 'Cotril',
      sourceData: {
        productDescription: 'Original description',
        characteristics: { Weight: '0.3 kg' },
      },
    },
  });
  assert.equal(result.group, '');
  assert.equal(result.description, 'Original description');
  assert.equal(result.characteristics.Weight, '0.3 kg');
  assert.deepEqual(
    catalogDetails({ category: 'Маски', characteristics: { brand: 'Cotril' } })
      .group,
    'Маски'
  );
});
