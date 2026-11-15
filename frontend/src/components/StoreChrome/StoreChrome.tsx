'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import CartModal from '@/components/CartModal/CartModal';
export default function StoreChrome({ children }: { children: ReactNode }) {
 const pathname = usePathname() ?? '';
 if (pathname === '/admin' || pathname.startsWith('/admin/')) return <>{children}</>;
 return <><Header/>{children}<Footer/><CartModal/></>;
}
