'use client';
import {useState,type ReactNode} from 'react';
import ReactPaginate from 'react-paginate';
import {useDesktop} from '@/hooks/useDesktop';
import type {Product} from '@/types/store';
import {PAGE_SIZE,productWindow} from '@/utils/pagination';
import css from './ProductResults.module.css';
interface Props{products:Product[];renderItem:(product:Product)=>ReactNode;serverPage?:boolean;}
export default function ProductResults(props:Props){
 const desktop=useDesktop();
 return <Results key={desktop?'desktop':'compact'} {...props} desktop={desktop}/>;
}
function Results({products,renderItem,desktop,serverPage=false}:Props&{desktop:boolean}){
 const [page,setPage]=useState(0);
 const [shown,setShown]=useState(PAGE_SIZE);
 const view=productWindow(products.length,page,shown,desktop);
 if(serverPage)return <ul className={css.grid} id="catalog-products">{products.map(renderItem)}</ul>;
 function selectPage({selected}:{selected:number}){
  setPage(selected);
  const catalog=document.getElementById('catalog');
  catalog?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 return <>
  <ul className={css.grid} id="catalog-products">{products.slice(view.start,view.end).map(renderItem)}</ul>
  {products.length>0&&<div className={css.controls}>
   <p className={css.count} role="status" aria-live="polite">Показано {view.start+1}–{view.end} із {products.length}</p>
   {desktop&&view.pageCount>1&&<nav aria-label="Сторінки каталогу"><ReactPaginate pageCount={view.pageCount} forcePage={view.page} onPageChange={selectPage} disableInitialCallback pageRangeDisplayed={3} marginPagesDisplayed={1} previousLabel="← Назад" nextLabel="Далі →" breakLabel="…" previousAriaLabel="Попередня сторінка" nextAriaLabel="Наступна сторінка" ariaLabelBuilder={(number:number)=>`Сторінка ${number}`} breakAriaLabels={{forward:'Наступні сторінки',backward:'Попередні сторінки'}} containerClassName={css.pages} activeClassName={css.active} disabledClassName={css.disabled} renderOnZeroPageCount={null}/></nav>}
   {!desktop&&view.remaining>0&&<button type="button" className={css.more} aria-controls="catalog-products" onClick={()=>setShown(count=>count+PAGE_SIZE)}>Показати ще {Math.min(PAGE_SIZE,view.remaining)}</button>}
  </div>}
 </>;
}
