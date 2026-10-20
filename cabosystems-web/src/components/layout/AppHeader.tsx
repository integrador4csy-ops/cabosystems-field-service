import React, { useRef, useEffect } from 'react';
import { SearchIcon, CloseIcon } from '../../icons';
import { Car, Menu, MapPin, Plus } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { useSidebar } from '../../context/SidebarContext';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface AppHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onlineCount: number;
  movingCount: number;
  offlineCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ searchQuery, onSearchChange, onlineCount, movingCount, offlineCount }) => {
  const { t } = useTranslation();
  const { isAdmin, user, adminProfile } = useAdminAuth();
  const { activeItem, isMobileOpen, setIsMobileOpen, taskSearchQuery, setTaskSearchQuery, requestCreateTask, agendaSearchQuery, setAgendaSearchQuery, requestCreateEvent } = useSidebar();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isRadar = activeItem === 'radar';
  const isTasks = activeItem === 'proyectos' || activeItem === 'agenda';
  const isAgenda = activeItem === 'agenda';
  const canManageEvents = Boolean(user && adminProfile?.activo && ['admin', 'supervisor_instalacion'].includes(adminProfile.rol || ''));
  const sectionQuery = isAgenda ? agendaSearchQuery : isTasks ? taskSearchQuery : searchQuery;
  const changeSectionQuery = isAgenda ? setAgendaSearchQuery : isTasks ? setTaskSearchQuery : onSearchChange;
  const teamTitles: Record<string, string> = { colaboradores: t('sidebar.collaborators'), invitaciones: t('sidebar.invitations'), 'directorio-proyectos': t('Proyectos') };
  const title = teamTitles[activeItem] || (activeItem === 'chat' ? t('sidebar.chat') : activeItem === 'agenda' ? t('sidebar.agenda') : activeItem === 'proyectos' ? t('sidebar.projects') : t('sidebar.radar'));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isRadar && (event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRadar]);

  return (
    <header className="app-header shrink-0 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => setIsMobileOpen(true)} aria-label={t("Abrir navegación")} aria-expanded={isMobileOpen} aria-controls="app-navigation" className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Menu size={20} /></button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-800">{title}</h1>
          {isRadar && <div className="hidden lg:flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} className="text-brand-600" /><span>{t('header.location')}</span></div>}
        </div>
      </div>
      {(isRadar || isTasks) && (
        <div className="header-search relative min-w-0">
          <SearchIcon size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input ref={searchInputRef} type="search" aria-label={isAgenda ? t('Buscar eventos y recordatorios') : isTasks ? t('Buscar tareas') : t('header.searchPlaceholder')} value={sectionQuery} onChange={(event) => changeSectionQuery(event.target.value)} placeholder={isAgenda ? t('Buscar evento, recordatorio o ubicación...') : isTasks ? t('Buscar tarea, villa o responsable...') : t('header.searchPlaceholder')} className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-500 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-colors" />
          {sectionQuery && <button type="button" onClick={() => changeSectionQuery('')} aria-label={t("Borrar búsqueda")} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><CloseIcon size={16} /></button>}
        </div>
      )}
      {isTasks && (isAgenda ? canManageEvents : isAdmin) && <div className="header-status flex justify-end"><button type="button" onClick={isAgenda ? requestCreateEvent : requestCreateTask} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600"><Plus size={16} aria-hidden="true" />{isAgenda ? t('Nuevo evento') : t('Nueva Tarea')}</button></div>}
      {isRadar && <div className="header-status flex items-center justify-end gap-3 text-xs tabular-nums">
        <div className="flex items-center gap-1.5 text-emerald-700" title={t('header.onlineTitle')}><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="font-semibold">{onlineCount}</span><span className="hidden sm:inline">{t('header.online')}</span></div>
        {movingCount > 0 && <div className="flex items-center gap-1.5 text-orange-700" title={t('header.inRouteTitle')}><Car size={14} /><span className="font-semibold">{movingCount}</span><span className="hidden xl:inline">{t('header.inRoute')}</span></div>}
        <div className="flex items-center gap-1.5 text-slate-500" title={t('header.offlineTitle')}><span className="h-2 w-2 rounded-full bg-slate-400" /><span className="font-semibold">{offlineCount}</span><span className="hidden sm:inline">{t('header.offline')}</span></div>
      </div>}
    </header>
  );
};
