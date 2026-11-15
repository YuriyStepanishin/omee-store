'use client';
import {useEffect,useState} from 'react';
import {useAuthStore} from '@/store/auth';
import {useCartStore} from '@/store/cart';
import {http} from '@/services/http';
import type {CartItem} from '@/types/store';
import {trackCartSave} from '@/services/cartSync';
export default function CartSync(){
  const userId=useAuthStore(state=>state.user?.id);
  const error=useCartStore(state=>state.syncError);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!userId)return;
    let active=true;
    let unsubscribe:undefined|(()=>void);
    let queue=Promise.resolve();
    const store=useCartStore;
    async function initialize(){
      try{
        const current=store.getState();
        const retrySave=Boolean(current.syncError&&!current.syncing);
        const items=retrySave?current.items:current.guestItems;
        store.setState({syncing:true,syncError:''});
        const response=retrySave?await http.put<{items:CartItem[]}>('/account/cart',{expectedUserId:userId,items}):await http.post<{items:CartItem[]}>('/account/cart/merge',{expectedUserId:userId,items});
        if(!active||store.getState().ownerId!==userId)return;
        store.getState().loadAccount(userId,response.data.items);
        unsubscribe=store.subscribe((next,previous)=>{
          if(next.ownerId!==userId||next.items===previous.items)return;
          const snapshot=next.items;
          queue=queue.then(async()=>{
            if(!active||store.getState().ownerId!==userId)return;
            try{
              await http.put('/account/cart',{expectedUserId:userId,items:snapshot});
              if(active&&store.getState().ownerId===userId)store.setState({syncError:''});
            }catch{
              if(active&&store.getState().ownerId===userId)store.setState({syncError:'Не вдалося зберегти кошик. Перевірте з’єднання.'});
            }
          });
          trackCartSave(queue);
        });
      }catch{
        if(active&&store.getState().ownerId===userId)store.setState({syncError:'Не вдалося завантажити кошик акаунта. Спробуйте ще раз.'});
      }
    }
    void initialize();
    return()=>{active=false;unsubscribe?.();};
  },[userId,retry]);
  return error?<div role="alert" style={{padding:'12px',background:'var(--color-primary-soft)',color:'var(--color-text)',textAlign:'center'}}>{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Повторити</button></div>:null;
}
