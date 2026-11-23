'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/services/http';
import css from './Admin.module.css';

export { default as Overview } from "./DashboardOverview";

export function Customers() {
  const [page,setPage] = useState(1);
  const query = useQuery({queryKey:['admin','customers',page],queryFn:async()=>(await http.get<{items:{id:string;name:string;email:string;phone:string|null;loyalty_points:number}[]}>('/admin/customers',{params:{page}})).data});
  return <section className={css.panel}><h2>Клієнти</h2>
    {query.isPending && <p role="status">Завантаження…</p>}
    {query.isError && <p role="alert">{query.error.message}</p>}
    {query.data && <>{query.data.items.length === 0 && <p>На цій сторінці клієнтів немає.</p>}{query.data.items.map(customer=><div className={css.row} key={customer.id}><h3>{customer.name}</h3><p>{customer.email}</p>{customer.phone && <p>{customer.phone}</p>}<p>Бонусні бали: <strong>{customer.loyalty_points}</strong></p></div>)}</>}
    <div className={css.actions}><button className={css.button} disabled={page===1||query.isFetching} onClick={()=>setPage(page-1)}>Назад</button><span>Сторінка {page}</span><button className={css.button} disabled={query.isFetching||!query.data||query.data.items.length<50} onClick={()=>setPage(page+1)}>Далі</button></div>
  </section>;
}

export function Settings() {
  const query = useQuery({queryKey:['admin','settings'],queryFn:async()=>(await http.get<{emailRecoveryConfigured:boolean}>('/admin/settings')).data});
  return <section className={css.panel}><h2>Авторизація</h2><p>Спільний вхід через email і пароль. Роль перевіряє сервер.</p>
    {query.isPending && <p role="status">Перевіряємо налаштування пошти…</p>}
    {query.isError && <p role="alert">{query.error.message}</p>}
    {query.data && <p>Відновлення пароля поштою: {query.data.emailRecoveryConfigured ? 'налаштовано' : 'очікує підключення пошти'}.</p>}
  </section>;
}
