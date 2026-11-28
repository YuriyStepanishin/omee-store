'use client';
import Link from 'next/link';
import {useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuthStore} from '@/store/auth';
import {fetchMyOrders,fetchFavorites} from '@/services/account';
import ProductCard from '@/components/ProductCard/ProductCard';
import ProductModal from '@/components/ProductModal/ProductModal';
import type {Product} from '@/types/store';
import {useCart} from '@/hooks/useCart';
import css from './Account.module.css';
import {deliveryLabel,orderStatusLabel,paymentMethodLabel,paymentStatusLabels,trackingPage} from '@/constants/order';
const money=(amount:string|number)=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH'}).format(Number(amount));
function Account({title,children}:{title:string;children:ReactNode}) {
  const {user,loaded,error}=useAuthStore();
  return <main className={css.page}><nav className={css.nav} aria-label="Особистий кабінет"><Link href="/profile">Профіль</Link><Link href="/profile/orders">Мої замовлення</Link><Link href="/profile/wishlist">Список бажань</Link><Link href="/#catalog">До каталогу</Link></nav><h1>{title}</h1>
    {!loaded?<p role="status">Перевіряємо сесію…</p>:!user?<><p>{error||'Увійдіть, щоб переглянути свій кабінет.'}</p><Link className={css.button} href="/login">Увійти</Link></>:children}
  </main>;
}
function Pagination({page,setPage,next,busy}:{page:number;setPage:(page:number)=>void;next:boolean;busy:boolean}) {
  return <nav className={css.pagination} aria-label="Сторінки"><button disabled={page===1||busy} onClick={()=>setPage(page-1)}>Назад</button><span>Сторінка {page}</span><button disabled={!next||busy} onClick={()=>setPage(page+1)}>Далі</button></nav>;
}
export function MyOrders() {
  const user=useAuthStore(state=>state.user);
  const [page,setPage]=useState(1);
  const query=useQuery({queryKey:['my-orders',user?.id,page],enabled:Boolean(user),queryFn:()=>fetchMyOrders(page)});
  return <Account title="Мої замовлення">
    {query.isPending&&<p role="status">Завантажуємо замовлення…</p>}
    {query.isError&&<p role="alert" className={css.error}>{query.error.message}</p>}
    {query.data && <>
      {query.data.items.length === 0 && <p>Тут поки немає замовлень. Замовлення, оформлені після входу, зберігатимуться в цьому розділі.</p>}
      {query.data.items.map(order => {
        const tracker = trackingPage(order.deliveryMethod);
        return <details className={css.order} key={order.id}>
          <summary>№ {order.id.slice(0,8)} · {new Date(order.createdAt).toLocaleDateString('uk-UA')} · {orderStatusLabel(order.status, order.deliveryMethod)} · {money(order.total)}</summary>
          <ul>{order.items.map((item,index) => <li key={`${item.sku}-${index}`}>
            <span>{item.name}<small>Артикул: {item.sku}</small></span>
            <span>{item.quantity} × {money(item.price)}</span>
          </li>)}</ul>
          <dl className={css.orderDetails}>
            <dt>Отримання</dt><dd>{deliveryLabel(order.deliveryMethod)} · {order.city}, {order.address}</dd>
            <dt>Оплата</dt><dd>{paymentMethodLabel(order.paymentMethod)} · {paymentStatusLabels[order.paymentStatus]}</dd>
            {tracker && order.trackingNumber && <>
              <dt>Номер відправлення</dt>
              <dd><strong>{order.trackingNumber}</strong> <a href={tracker} target="_blank" rel="noopener noreferrer">Відстежити у перевізника ↗</a></dd>
            </>}
            <dt>Номер замовлення</dt><dd>{order.id}</dd>
          </dl>
        </details>;
      })}
      <Pagination page={page} setPage={setPage} next={query.data.items.length === 20} busy={query.isFetching}/>
    </>}
  </Account>;
}
export function Wishlist() {
  const user=useAuthStore(state=>state.user);
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<Product|null>(null);
  const [added,setAdded]=useState('');
  const {addToCart}=useCart();
  const client=useQueryClient();
  const query=useQuery({queryKey:['favorites',user?.id,'page',page],enabled:Boolean(user),queryFn:()=>fetchFavorites(page)});
  function add(product: Product, sourceProductId = product.id) {
    addToCart(sourceProductId);
    setAdded(product.id);
  }
  return <Account title="Список бажань">
    {query.isPending&&<p role="status">Завантажуємо список…</p>}
    {query.isError&&<p role="alert" className={css.error}>{query.error.message}</p>}
    {query.data&&<>{query.data.items.length===0&&<p>Список порожній. Натисніть сердечко біля товару, щоб зберегти його тут.</p>}<ul className={css.grid}>{query.data.items.map(product=><ProductCard key={product.id} product={product} busy={false} added={added===product.id} onAdd={sourceProductId=>add(product,sourceProductId)} onOpen={()=>setSelected(product)}/>)}</ul><Pagination page={page} setPage={setPage} next={query.data.items.length===20} busy={query.isFetching}/></>}
    <button className={css.button} onClick={()=>{void client.invalidateQueries({queryKey:['favorites',user?.id]});}}>Оновити список</button>
    {selected&&<ProductModal product={selected} busy={false} added={added===selected.id} onAdd={sourceProductId=>add(selected,sourceProductId)} onClose={()=>setSelected(null)}/>}
  </Account>;
}
