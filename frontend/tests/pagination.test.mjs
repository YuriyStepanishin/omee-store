import test from 'node:test';
import assert from 'node:assert/strict';
import { pageNumbers, productWindow, PAGE_SIZE } from '../src/utils/pagination.ts';
test('numbered pagination keeps the edges and the current page within reach', () => {
  assert.deepEqual(pageNumbers(1, 78), [1, 2, 3, 4, 'gap', 78]);
  assert.deepEqual(pageNumbers(19, 78), [1, 'gap', 18, 19, 20, 'gap', 78]);
  assert.deepEqual(pageNumbers(78, 78), [1, 'gap', 75, 76, 77, 78]);
  assert.deepEqual(pageNumbers(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageNumbers(2, 5), [1, 2, 3, 4, 5]);
});
test('desktop renders 20 items per page with a partial last page', () => {
  assert.equal(PAGE_SIZE, 20);
  assert.deepEqual(productWindow(45, 1, 20, true), {
    start: 20,
    end: 40,
    page: 1,
    pageCount: 3,
    remaining: 5,
  });
  assert.equal(productWindow(45, 2, 20, true).end, 45);
});
test('compact mode accumulates pages without moving the first item', () => {
  assert.equal(productWindow(45, 0, 40, false).start, 0);
  assert.equal(productWindow(45, 0, 40, false).end, 40);
  assert.equal(productWindow(45, 0, 60, false).remaining, 0);
});
test('shrinking result sets and zero results do not expose an empty out of range page', () => {
  assert.equal(productWindow(5, 9, 20, true).page, 0);
  assert.equal(productWindow(0, 9, 20, true).end, 0);
  assert.equal(productWindow(0, 9, 20, true).pageCount, 0);
});
