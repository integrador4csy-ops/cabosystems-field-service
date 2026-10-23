import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/context/LanguageContext';
import { SidebarProvider, useSidebar } from '../../src/context/SidebarContext';
import { AppHeader } from '../../src/components/layout/AppHeader';
import { CompanyAgenda } from '../../src/components/agenda/CompanyAgenda';
import { RetainedView } from '../../src/components/layout/RetainedView';
import './preview.css';
export function Preview() {
  const [agendaVisible, setAgendaVisible] = useState(true);
  const { setActiveItem } = useSidebar();
  useEffect(() => { setActiveItem('agenda'); }, [setActiveItem]);
  return <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f9fafb', padding: 16, gap: 12, fontFamily: 'Outfit,sans-serif' }}><p style={{ fontSize: 12 }}>Vista de prueba · datos ficticios · sin conexión a Supabase</p><nav><button onClick={() => setAgendaVisible(true)}>Agenda (prueba)</button> | <button onClick={() => setAgendaVisible(false)}>Otra sección (prueba)</button></nav><AppHeader searchQuery="" onSearchChange={() => {}} onlineCount={0} movingCount={0} offlineCount={0} /><RetainedView active={agendaVisible} fallback={<p>Cargando módulo de prueba</p>}><CompanyAgenda /></RetainedView><RetainedView active={!agendaVisible} fallback={null}><p>Otra sección de prueba</p><input aria-label="Borrador de prueba" /></RetainedView></div>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><SidebarProvider><Preview /></SidebarProvider></LanguageProvider>);
