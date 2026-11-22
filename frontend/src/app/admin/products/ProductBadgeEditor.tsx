'use client';
import {useState} from 'react';
import type {ProductBadge} from '@/types/store';
import css from './ProductBadgeEditor.module.css';

const presets:ProductBadge[]=[
  {label:'Новинка',background:'#D9F0D3',color:'#225D2A'},
  {label:'Хіт продажів',background:'#FFF0C5',color:'#73521C'},
  {label:'Акція',background:'#FADDE4',color:'#872840'},
  {label:'Безкоштовна доставка',background:'#DDECFB',color:'#204F7E'},
];
const limit=4;

export default function ProductBadgeEditor({value,onChange}:{
  value:ProductBadge[];
  onChange:(badges:ProductBadge[])=>void;
}){
  const [customLabel,setCustomLabel]=useState('');
  const add=(badge:ProductBadge)=>{
    if(value.length>=limit||value.some(item=>item.label.toLocaleLowerCase('uk-UA')===badge.label.toLocaleLowerCase('uk-UA')))return;
    onChange([...value,badge]);
  };
  const update=(index:number,field:keyof ProductBadge,change:string)=>
    onChange(value.map((item,i)=>i===index?{...item,[field]:change}:item));
  const move=(index:number,step:number)=>{
    const next=[...value];
    [next[index],next[index+step]]=[next[index+step],next[index]];
    onChange(next);
  };
  return (
    <section className={css.editor} aria-label="Бейджі товару">
      <div className={css.heading}><strong>Бейджі товару</strong><span>{value.length}/{limit}</span></div>
      <p className={css.note}>Позначки поверх фото товару в каталозі. Додайте готову або власну, налаштуйте кольори та порядок.</p>
      <div className={css.presets}>
        {presets.map(badge=><button
          type="button"
          key={badge.label}
          className={css.preset}
          style={{backgroundColor:badge.background,color:badge.color}}
          disabled={value.length>=limit||value.some(item=>item.label===badge.label)}
          onClick={()=>add(badge)}
        >+ {badge.label}</button>)}
      </div>
      <div className={css.custom}>
        <input aria-label="Назва власного бейджа" placeholder="Власний напис (до 28 символів)"
          maxLength={28} value={customLabel} onChange={event=>setCustomLabel(event.target.value)}/>
        <button type="button" disabled={!customLabel.trim()||value.length>=limit} onClick={()=>{
          add({label:customLabel.trim(),background:'#E9E3F4',color:'#4C3574'});
          setCustomLabel('');
        }}>Додати бейдж</button>
      </div>
      {value.map((badge,index)=><div className={css.row} key={index}>
        <span className={css.preview} style={{backgroundColor:badge.background,color:badge.color}}>{badge.label||'Назва бейджа'}</span>
        <label>Напис<input required maxLength={28} value={badge.label} onChange={event=>update(index,'label',event.target.value)}/></label>
        <div className={css.colors}>
          <label>Фон<input type="color" value={badge.background} onChange={event=>update(index,'background',event.target.value)}/></label>
          <label>Текст<input type="color" value={badge.color} onChange={event=>update(index,'color',event.target.value)}/></label>
        </div>
        <div className={css.buttons}>
          <button type="button" aria-label={'Перемістити вгору: '+badge.label} disabled={index===0} onClick={()=>move(index,-1)}>↑</button>
          <button type="button" aria-label={'Перемістити вниз: '+badge.label} disabled={index===value.length-1} onClick={()=>move(index,1)}>↓</button>
          <button type="button" className={css.remove} onClick={()=>onChange(value.filter((_,i)=>index!==i))}>Прибрати</button>
        </div>
      </div>)}
    </section>
  );
}
