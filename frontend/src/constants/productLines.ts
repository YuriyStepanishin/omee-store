export const PRODUCT_LINES=[
 {id:'hair',label:'Догляд за волоссям'},
 {id:'body',label:'Догляд за тілом'},
 {id:'other',label:'Інше'},
] as const;
export type ProductLine=typeof PRODUCT_LINES[number]['id'];
