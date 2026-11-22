import test from 'node:test';
import assert from 'node:assert/strict';
import {productSchema} from '../src/validators/catalog.js';

const base={
  categoryId:'11111111-1111-4111-8111-111111111111',
  brandId:null,
  name:'Тестовий товар',
  slug:'test-product',
  description:'',
  price:100,
  oldPrice:null,
  stock:1,
  sku:'TEST-1',
  isActive:false,
  images:[],
  characteristics:{},
};
const badge={label:'Новинка',background:'#D9F0D3',color:'#225D2A'};

test('product accepts up to four manually configured badges',()=>{
  const result=productSchema.parse({...base,badges:[badge,{...badge,label:'Доставка 0₴'}]});
  assert.equal(result.badges.length,2);
  assert.equal(result.badges[1].label,'Доставка 0₴');
});

test('missing badges default to an empty array',()=>{
  assert.deepEqual(productSchema.parse(base).badges,[]);
});

test('reject invalid colors, empty labels and too many badges',()=>{
  for(const badges of [[{...badge,background:'red'}],[{...badge,label:'  '}],Array.from({length:5},(_,i)=>({...badge,label:'Badge '+i}))]){
    assert.equal(productSchema.safeParse({...base,badges}).success,false);
  }
});
