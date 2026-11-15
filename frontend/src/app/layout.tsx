import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import '@/styles/globals.css';
import Providers from './providers';
import StoreChrome from '@/components/StoreChrome/StoreChrome';


import {BRAND} from '@/constants/brand';
const manrope = localFont({src:'./fonts/Manrope.ttf',variable:'--font-manrope',weight:'200 800',display:'swap'});
const unbounded = localFont({src:'./fonts/Unbounded.ttf',variable:'--font-unbounded',weight:'200 900',display:'swap',preload:false});
export const metadata: Metadata = {
 title:{default:BRAND.name,template:`%s | ${BRAND.name}`},
 description:BRAND.description,
 applicationName:BRAND.name,
 manifest:'/manifest.webmanifest',
 openGraph:{title:BRAND.name,description:BRAND.description,siteName:BRAND.name,locale:'uk_UA',type:'website'},
 twitter:{card:'summary',title:BRAND.name,description:BRAND.description},
};
const THEME_SCRIPT="try{document.documentElement.dataset.theme=localStorage.getItem('kateryna-theme')==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}";
export default function RootLayout({children}:{children:ReactNode}){
 return <html lang="uk" className={`${manrope.variable} ${unbounded.variable}`} suppressHydrationWarning><head><link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" type="image/x-icon"/><script dangerouslySetInnerHTML={{__html:THEME_SCRIPT}}/></head><body suppressHydrationWarning><Providers><StoreChrome>{children}</StoreChrome></Providers></body></html>;
}
