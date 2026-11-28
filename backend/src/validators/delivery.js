const carriers=new Set(['nova_poshta','ukrposhta','meest']);
const types=new Set(['branch','courier','locker']);
const refPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function validateDelivery(customer){
 const carrier=customer?.deliveryCarrier,type=customer?.deliveryType;
 const cityRef=customer?.deliveryCityRef,pointRef=customer?.deliveryPointRef;
 const hasRefs=cityRef!==undefined||pointRef!==undefined;
 if(hasRefs&&(carrier!=='nova_poshta'||!['branch','locker'].includes(type)||
  typeof cityRef!=='string'||!refPattern.test(cityRef)||typeof pointRef!=='string'||!refPattern.test(pointRef))){
  throw Object.assign(new Error('Повторно оберіть населений пункт і пункт отримання Нової пошти.'),{status:400});
 }
 if(carrier===undefined&&type===undefined)return {method:'to_be_confirmed'};
 if(carrier==='pickup'||type==='pickup'){
  if(carrier!=='pickup'||type!=='pickup')throw Object.assign(new Error('Оберіть перевізника та спосіб доставки.'),{status:400});
  return {method:'pickup',carrier,type};
 }
 if(!carriers.has(carrier)||!types.has(type)||(carrier==='ukrposhta'&&type==='locker'))throw Object.assign(new Error('Оберіть перевізника та спосіб доставки.'),{status:400});
 return {method:`${carrier}:${type}`,carrier,type,...(hasRefs?{cityRef,pointRef}:{})};
}
