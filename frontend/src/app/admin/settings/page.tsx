import Link from 'next/link';
import { Settings } from '../AdminData';
import css from '../Admin.module.css';
export default function Page() { return <><Settings/><div className={css.actions}><Link href="/admin/content">Контакти та промокоди</Link><Link href="/admin/categories">Категорії товарів</Link></div></>; }
