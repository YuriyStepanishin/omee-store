import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import {getArticle} from '@/services/articles.server';
import css from '../Blog.module.css';
export const dynamic='force-dynamic';
const loadArticle=cache(getArticle);
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const article=await loadArticle((await params).slug);if(!article)return {title:'Статтю не знайдено',robots:{index:false}};
 return {title:article.seoTitle,description:article.seoDescription,authors:[{name:article.author}],openGraph:{title:article.seoTitle,description:article.seoDescription,type:'article',publishedTime:article.date,authors:[article.author],locale:'uk_UA'},twitter:{card:'summary',title:article.seoTitle,description:article.seoDescription}};
}
export default async function ArticlePage({params}:Props){
 const article=await loadArticle((await params).slug);if(!article)notFound();
 return <main className={css.page}><Link href="/blog" className={css.read}>← Усі статті</Link><article className={css.article}><header><p className={css.eyebrow}>{article.category}</p><h1>{article.title}</h1><p className={css.intro}>{article.excerpt}</p><p className={css.meta}>{article.author} · <time dateTime={article.date}>{new Date(article.date+'T00:00:00Z').toLocaleDateString('uk-UA',{timeZone:'UTC'})}</time></p></header>
 <div className={css.body}>{article.body.split(/\n\s*\n/).map((block,index)=>block.startsWith('## ')?<h2 key={index}>{block.slice(3)}</h2>:<p key={index}>{block}</p>)}</div>
 {article.media?.length>0&&<section aria-label="Фото та відео публікації"><h2>Фото та відео</h2>{article.media.map((item,index)=><figure key={index}>{item.type==='photo'?<img src={item.url} alt={item.caption||article.title} loading="lazy" style={{maxWidth:'100%',height:'auto',borderRadius:12}}/>:<video src={item.url} controls preload="metadata" playsInline style={{maxWidth:'100%',borderRadius:12}}/>}{item.caption&&<figcaption>{item.caption}</figcaption>}</figure>)}</section>}
 <footer className={css.sources}><h2>Джерела</h2><p>Оригінальний редакційний матеріал omee store. Наведені джерела використано для перевірки рекомендацій.</p><ul>{article.sources.filter(s=>{try{return new URL(s.url).protocol==='https:';}catch{return false;}}).map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul></footer>
 </article><Link href="/#catalog" className={css.read}>Знайти засоби для догляду →</Link></main>;
}
