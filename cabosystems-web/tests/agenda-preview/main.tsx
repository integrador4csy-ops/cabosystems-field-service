import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/context/LanguageContext';
import { SidebarProvider, useSidebar } from '../../src/context/SidebarContext';
import { AppHeader } from '../../src/components/layout/AppHeader';
import { CompanyAgenda } from '../../src/components/agenda/CompanyAgenda';
import './preview.css';
export function Preview() {
  const { setActiveItem } = useSidebar();
  useEffect(() => { setActiveItem('agenda'); }, [setActiveItem]);
  return <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f9fafb', padding: 16, gap: 12, fontFamily: 'Outfit,sans-serif' }}><p style={{ fontSize: 12 }}>Vista de prueba · datos ficticios · sin conexión a Supabase</p><AppHeader searchQuery="" onSearchChange={() => {}} onlineCount={0} movingCount={0} offlineCount={0} /><CompanyAgenda /></div>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><SidebarProvider><Preview /></SidebarProvider></LanguageProvider>);
