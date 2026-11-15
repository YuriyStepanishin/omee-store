import {productAudience} from './productAudience.js';
const text=value=>typeof value==='string'?value.trim():typeof value==='number'||typeof value==='boolean'?String(value):'';
const first=(...values)=>values.map(text).find(Boolean)||'';
export function catalogDetails(row){
 const raw=row.characteristics&&typeof row.characteristics==='object'?row.characteristics:{};
 const source=raw.sourceData&&typeof raw.sourceData==='object'?raw.sourceData:{};
 const brand=first(row.brandName,raw.brand,raw['Бренд'],raw['Brand'],source.brand);
 const group=first(raw.group,raw['Група'],raw['Група товарів'],raw.sourceCategory,source.category,source.group);
 const category=group||((row.category||'').toLowerCase()!==brand.toLowerCase()?row.category:'');
 const groups=[...new Set([category,...(Array.isArray(raw.groups)?raw.groups:[]),...(Array.isArray(raw.sourceGroups)?raw.sourceGroups:[])].map(text).filter(Boolean))];
 const reserved=new Set(['groups','brandId','brand','Brand','group','subcategory','sourceData','formulaFeatures','usage','recommendation','activeIngredients','inciIngredients']);
 const characteristics={};
 for(const [key,value] of Object.entries({...source.characteristics,...raw})){
  if(reserved.has(key)||key.startsWith('source'))continue;
  const content=text(value);if(content)characteristics[key]=content;
 }
 const details=[['Особливості формули','formulaFeatures'],['Спосіб використання','usage'],['Рекомендації','recommendation'],['Активні компоненти','activeIngredients'],['Склад INCI','inciIngredients']]
  .map(([label,key])=>({label,text:first(raw[key],source[key])})).filter(item=>item.text);
 return {audience:productAudience(raw,groups),brand,groups,group:groups[0]||'',category:groups[0]||'',subcategory:first(raw.subcategory,raw.sourceSubcategory,source.subcategory),
  description:first(row.description,source.productDescription,source.description),characteristics,details};
}
