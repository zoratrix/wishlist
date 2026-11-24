import { Outlet } from 'react-router-dom';
import { SiteHeader } from './site-header';

/** Каркас авторизованной части: единая шапка и контент. */
export function AppLayout() {
 return (
 <div className="flex min-h-dvh flex-col bg-paper">
 <SiteHeader />
 <main className="w-full flex-1 pb-12">
 <Outlet />
 </main>
 </div>
 );
}
