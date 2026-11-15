'use client';
import {useEffect,useId,useRef,useState} from 'react';
import type {Product} from '@/types/store';
import ProductPhoto from '../ProductPhoto/ProductPhoto';
import {CartButton,ProductPrice} from '../ProductCard/ProductCard';
import css from './ProductModal.module.css';
import FavoriteButton from '../ProductCard/FavoriteButton';
export default function ProductModal({product:p,busy,added,onAdd,onClose}:{product:Product;busy:boolean;added:boolean;onAdd:()=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const titleId=useId();const [selected,setSelected]=useState(0);
 const images=[...new Set([p.image,...(p.images||[])].filter(Boolean))];
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  element.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{element.close();document.body.style.overflow=overflow;};
 },[]);
 const close=()=>dialog.current?.close();
 return <dialog ref={dialog} className={css.dialog} aria-labelledby={titleId} onClose={()=>{if(!dialog.current?.open)onClose();}} onClick={event=>{
  if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
 }}>
  <button type="button" className={css.close} aria-label="Закрити картку товару" onClick={close} autoFocus><svg className={css.closeIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></button>
  <div className={css.layout}>
   <div className={css.gallery}><ProductPhoto className={css.mainPhoto} image={images[selected]||''} alt={p.title} loading="eager"/>{images.length>1&&<div className={css.thumbnails} aria-label="Фотографії товару">{images.map((image,index)=><button key={image} type="button" aria-label={`Фото ${index+1}: ${p.title}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}><ProductPhoto className={css.thumbnail} image={image} alt=""/></button>)}</div>}</div>
   <div className={css.info}><p className={css.brand}>{p.brand}</p><h2 id={titleId}>{p.title}</h2><p className={css.sku}>Артикул: {p.sku}</p>{p.groups?.length?<p className={css.groups}>{p.groups.join(' · ')}</p>:null}<div className={css.purchase}><ProductPrice product={p}/><CartButton product={p} busy={busy} added={added} onAdd={onAdd}/><FavoriteButton productId={p.id} title={p.title}/></div>{added&&<p role="status" className={css.added}>Товар додано до кошика.</p>}
    {p.description&&<section><h3>Опис</h3><p>{p.description}</p></section>}
    {Object.keys(p.characteristics||{}).length>0&&<section><h3>Характеристики</h3><dl>{Object.entries(p.characteristics||{}).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></section>}
    {p.details?.map(detail=><section key={detail.label}><h3>{detail.label}</h3><p>{detail.text}</p></section>)}
   </div>
  </div>
 </dialog>;
}
