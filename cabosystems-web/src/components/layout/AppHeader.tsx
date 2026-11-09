import React, { useRef, useEffect } from 'react';
import { SearchIcon, CloseIcon } from '../../icons';
import { CalendarDays, Car, ChevronLeft, ChevronRight, ClipboardPlus, Menu, MapPin, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { useSidebar } from '../../context/SidebarContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import type { LiveWorker } from '../../types/fleet';
import { dateKey, shiftDate } from '../../lib/taskDates';
import { AppSelect } from '../ui/AppSelect';
import { NotificationCenter } from './NotificationCenter';
import { AgendaDateTimeField } from '../agenda/AgendaDateTimeField';

interface AppHeaderProps {
  trackingSection?: 'map' | 'checks' | 'history';
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onlineCount: number;
  movingCount: number;
  offlineCount: number;
  historyWorkers?: LiveWorker[];
  historyWorkerId?: string;
  onHistoryWorkerChange?: (workerId: string) => void;
  historyDate?: string;
  onHistoryDateChange?: (date: string) => void;
  checkTechnicians?: Array<{ id: string; name: string }>;
  checkTechnicianId?: string;
  onCheckTechnicianChange?: (workerId: string) => void;
  checkDate?: string;
  onCheckDateChange?: (date: string) => void;
  onRefreshChecks?: () => void;
  isChecksLoading?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  trackingSection = 'map',
  searchQuery,
  onSearchChange,
  onlineCount,
  movingCount,
  offlineCount,
  historyWorkers = [],
  historyWorkerId = '',
  onHistoryWorkerChange,
  historyDate = '',
  onHistoryDateChange,
  checkTechnicians = [],
  checkTechnicianId = '',
  onCheckTechnicianChange,
  checkDate = '',
  onCheckDateChange,
  onRefreshChecks,
  isChecksLoading = false,
}) => {
  const { t, locale } = useTranslation();
  const { isAdmin, user, adminProfile } = useAdminAuth();
  const {
    activeItem, isMobileOpen, setIsMobileOpen,
    taskSearchQuery, setTaskSearchQuery, requestCreateTask,
    agendaSearchQuery, setAgendaSearchQuery, requestCreateEvent,
    chatSearchQuery, setChatSearchQuery, requestCreateChatGroup,
    teamSearchQuery, setTeamSearchQuery, requestCreateTeamInvite,
    directorySearchQuery, setDirectorySearchQuery,
    warrantySearchQuery, setWarrantySearchQuery, requestCreateWarranty,
  } = useSidebar();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isTracking = activeItem === 'radar';
  const isRadar = isTracking && trackingSection === 'map';
  const isChecks = isTracking && trackingSection === 'checks';
  const isTasks = activeItem === 'proyectos' || activeItem === 'agenda';
  const isAgenda = activeItem === 'agenda';
  const isChat = activeItem === 'chat';
  const isCollaborators = activeItem === 'colaboradores';
  const isDirectory = activeItem === 'directorio-proyectos';
  const isWarranty = activeItem === 'garantias';
  const isTeam = isCollaborators || activeItem === 'invitaciones';
  const isHistory = activeItem === 'historial' || (activeItem === 'radar' && trackingSection === 'history');
  const canManageEvents = Boolean(user && adminProfile?.activo && ['admin', 'supervisor_instalacion'].includes(adminProfile.rol || ''));
  const canManageChat = Boolean(user && adminProfile?.activo && ['admin', 'supervisor_instalacion'].includes(adminProfile.rol || ''));
  const hasSearch = isRadar || isTasks || isChat || isCollaborators || isDirectory || isWarranty;
  const sectionQuery = isAgenda ? agendaSearchQuery : isTasks ? taskSearchQuery : isChat ? chatSearchQuery : isCollaborators ? teamSearchQuery : isDirectory ? directorySearchQuery : isWarranty ? warrantySearchQuery : searchQuery;
  const changeSectionQuery = isAgenda ? setAgendaSearchQuery : isTasks ? setTaskSearchQuery : isChat ? setChatSearchQuery : isCollaborators ? setTeamSearchQuery : isDirectory ? setDirectorySearchQuery : isWarranty ? setWarrantySearchQuery : onSearchChange;
  const searchLabel = isAgenda ? t('Buscar eventos') : isTasks ? t('Buscar tareas') : isChat ? t('Buscar grupo o proyecto') : isCollaborators ? t('Buscar colaboradores') : isDirectory ? t('Buscar villas o números de proyecto') : isWarranty ? t('Buscar garantías') : t('header.searchPlaceholder');
  const searchPlaceholder = isAgenda ? t('Buscar evento o ubicación...') : isTasks ? t('Buscar tarea, villa o responsable...') : isChat ? t('Buscar grupo o proyecto...') : isCollaborators ? t('Buscar colaborador por nombre, correo o rol...') : isDirectory ? t('Buscar villa o número de proyecto...') : isWarranty ? t('Buscar folio, villa, equipo o serie...') : t('header.searchPlaceholder');
  const teamTitles: Record<string, string> = { colaboradores: t('sidebar.collaborators'), invitaciones: t('sidebar.invitations'), 'directorio-proyectos': t('Proyectos') };
  const title = isChecks ? t('Historial de checks') : isHistory ? t('sidebar.history') : isTracking ? t('sidebar.radar') : teamTitles[activeItem] || (activeItem === 'garantias' ? (locale.startsWith('es') ? 'Garantías' : 'Warranties') : activeItem === 'chat' ? t('sidebar.chat') : activeItem === 'agenda' ? t('sidebar.agenda') : activeItem === 'proyectos' ? t('sidebar.projects') : isHistory ? t('sidebar.history') : t('sidebar.radar'));
  const today = dateKey(new Date());
  const yesterday = shiftDate(today, -1);

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
    <header className="app-header min-h-16 shrink-0 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => setIsMobileOpen(true)} aria-label={t("Abrir navegación")} aria-expanded={isMobileOpen} aria-controls="app-navigation" className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Menu size={20} /></button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-800">{title}</h1>
          {isRadar && <div className="hidden lg:flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} className="text-brand-600" /><span>{t('header.location')}</span></div>}
        </div>
      </div>
      {hasSearch && (
        <div className="header-search relative min-w-0">
          <SearchIcon size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input ref={searchInputRef} type="search" aria-label={searchLabel} value={sectionQuery} onChange={(event) => changeSectionQuery(event.target.value)} placeholder={searchPlaceholder} className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-500 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-colors" />
          {sectionQuery && <button type="button" onClick={() => changeSectionQuery('')} aria-label={t("Borrar búsqueda")} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><CloseIcon size={16} /></button>}
        </div>
      )}
      {isHistory && <div className="history-header-controls" aria-label={t('Filtros del historial')}>
        <label className="history-header-worker">
          <AppSelect
            aria-label={t('Seleccionar técnico')}
            value={historyWorkerId}
            disabled={historyWorkers.length === 0}
            onChange={(event) => onHistoryWorkerChange?.(event.target.value)}
          >
            {historyWorkers.map((worker) => <option key={worker.profile.id} value={worker.profile.id}>{worker.profile.nombre || worker.profile.full_name || t('Técnico')}</option>)}
          </AppSelect>
        </label>
        <div className="history-header-presets" aria-label={t('Fechas rápidas')}>
          <button type="button" aria-pressed={historyDate === today} onClick={() => onHistoryDateChange?.(today)}>{t('Hoy')}</button>
          <button type="button" aria-pressed={historyDate === yesterday} onClick={() => onHistoryDateChange?.(yesterday)}>{t('Ayer')}</button>
        </div>
        <div className="history-header-date">
          <AgendaDateTimeField
            type="date"
            value={historyDate}
            label={t('Seleccionar fecha')}
            locale={locale}
            onChange={(value) => onHistoryDateChange?.(value)}
          />
        </div>
      </div>}
      {isChecks && <div className="history-header-controls" aria-label={t('Filtros del historial')}>
        <label className="history-header-worker">
          <AppSelect
            aria-label={t('Filtrar por técnico')}
            value={checkTechnicianId}
            onChange={(event) => onCheckTechnicianChange?.(event.target.value)}
          >
            <option value="">{t('Todos los técnicos')}</option>
            {checkTechnicians.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
          </AppSelect>
        </label>
        <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
          <button
            type="button"
            onClick={() => onCheckDateChange?.(shiftDate(checkDate, -1))}
            className="flex h-full w-8 items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label={t('Día anterior')}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onCheckDateChange?.(today)}
            className="flex h-full items-center gap-1.5 border-x border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <CalendarDays size={14} />
            {checkDate === today ? t('Hoy') : checkDate}
          </button>
          <button
            type="button"
            disabled={checkDate >= today}
            onClick={() => onCheckDateChange?.(shiftDate(checkDate, 1))}
            className="flex h-full w-8 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 transition-colors"
            aria-label={t('Día siguiente')}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onRefreshChecks?.()}
          disabled={isChecksLoading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-2xs transition-colors"
          aria-label={t('Actualizar checks')}
        >
          <RefreshCw size={15} className={isChecksLoading ? 'animate-spin' : ''} />
        </button>
      </div>}
      <div className="header-status flex items-center justify-end gap-3 text-xs tabular-nums">
        {isTasks && (isAgenda ? canManageEvents : isAdmin) && <button type="button" onClick={isAgenda ? requestCreateEvent : requestCreateTask} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600"><Plus size={16} aria-hidden="true" />{isAgenda ? t('Nuevo evento') : t('Nueva Tarea')}</button>}
        {isChat && canManageChat && <button type="button" onClick={requestCreateChatGroup} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600"><Plus size={16} aria-hidden="true" />{t('Nuevo grupo')}</button>}
        {isWarranty && <button type="button" onClick={requestCreateWarranty} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600"><ClipboardPlus size={16} aria-hidden="true" />{t('Nueva garantía')}</button>}
        {isTeam && <button type="button" onClick={requestCreateTeamInvite} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600"><Plus size={16} aria-hidden="true" />{t('Nueva invitación')}</button>}
        {isRadar && <>
          <div className="flex items-center gap-1.5 text-emerald-700" title={t('header.onlineTitle')}><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="font-semibold">{onlineCount}</span><span className="hidden sm:inline">{t('header.online')}</span></div>
          {movingCount > 0 && <div className="flex items-center gap-1.5 text-orange-700" title={t('header.inRouteTitle')}><Car size={14} /><span className="font-semibold">{movingCount}</span><span className="hidden xl:inline">{t('header.inRoute')}</span></div>}
          <div className="flex items-center gap-1.5 text-slate-500" title={t('header.offlineTitle')}><span className="h-2 w-2 rounded-full bg-slate-400" /><span className="font-semibold">{offlineCount}</span><span className="hidden sm:inline">{t('header.offline')}</span></div>
        </>}
        <NotificationCenter />
      </div>
    </header>
  );
};
