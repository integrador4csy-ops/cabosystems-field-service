import React, { useRef, useEffect, useMemo } from 'react';
import { SearchIcon, CloseIcon } from '../../icons';
import { CalendarDays, Car, ChevronLeft, ChevronRight, Menu, MapPin, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { useSidebar } from '../../context/SidebarContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import type { LiveWorker } from '../../types/fleet';
import { dateKey, shiftDate } from '../../lib/taskDates';
import { formatShortName } from '../../lib/agendaPresentation';
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
  workers?: LiveWorker[];
  selectedWorkerId?: string | null;
  onSelectWorker?: (workerId: string) => void;
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
  workers = [],
  selectedWorkerId = null,
  onSelectWorker,
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
  const canManageEvents = Boolean(user && adminProfile?.activo);
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

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const aMoving = !a.isOffline && (a.location?.velocidad || 0) > 12;
      const bMoving = !b.isOffline && (b.location?.velocidad || 0) > 12;
      if (aMoving !== bMoving) return aMoving ? -1 : 1;
      if (a.isOffline !== b.isOffline) return a.isOffline ? 1 : -1;
      const nameA = a.profile?.nombre || a.profile?.full_name || '';
      const nameB = b.profile?.nombre || b.profile?.full_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [workers]);

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
          <input ref={searchInputRef} type="search" aria-label={searchLabel} value={sectionQuery} onChange={(event) => changeSectionQuery(event.target.value)} placeholder={searchPlaceholder} className="h-10 w-full rounded-lg border border-slate-200 bg-white shadow-2xs pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-colors" />
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
        <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
          <button
            type="button"
            onClick={() => onHistoryDateChange?.(shiftDate(historyDate || today, -1))}
            className="flex h-full w-8 items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label={t('Día anterior')}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onHistoryDateChange?.(today)}
            className="flex h-full items-center gap-1.5 border-x border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <CalendarDays size={14} />
            {historyDate === today ? t('Hoy') : historyDate === yesterday ? t('Ayer') : historyDate}
          </button>
          <button
            type="button"
            disabled={Boolean(historyDate && historyDate >= today)}
            onClick={() => onHistoryDateChange?.(shiftDate(historyDate || today, 1))}
            className="flex h-full w-8 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 transition-colors"
            aria-label={t('Día siguiente')}
          >
            <ChevronRight size={16} />
          </button>
        </div>
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
        {isWarranty && <button type="button" onClick={requestCreateWarranty} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600"><Plus size={16} aria-hidden="true" />{t('Nueva garantía')}</button>}
        {isTeam && <button type="button" onClick={requestCreateTeamInvite} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600"><Plus size={16} aria-hidden="true" />{t('Nueva invitación')}</button>}
        {isRadar && (
          sortedWorkers.length > 0 ? (
            <div
              className="flex items-center gap-1.5 overflow-x-auto max-w-[320px] sm:max-w-[440px] lg:max-w-[560px] 2xl:max-w-[720px] py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {sortedWorkers.map((worker) => {
                const isSelected = selectedWorkerId === worker.profile.id;
                const isOffline = worker.isOffline;
                const isMoving = !isOffline && (worker.location?.velocidad || 0) > 12;
                const fullName = worker.profile.nombre || worker.profile.full_name || worker.profile.email || t('Técnico');
                const displayName = formatShortName(fullName) || fullName;
                const initial = (fullName.charAt(0) || 'T').toUpperCase();
                const statusLabel = isMoving ? t('header.inRoute') : isOffline ? t('header.offline') : t('header.online');

                return (
                  <button
                    key={worker.profile.id}
                    type="button"
                    onClick={() => onSelectWorker?.(isSelected ? '' : worker.profile.id)}
                    className={`group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-xs font-medium transition-all select-none ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-2xs ring-2 ring-brand-500/25'
                        : isOffline
                        ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        : isMoving
                        ? 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70'
                        : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/70'
                    }`}
                    title={`${fullName} · ${statusLabel}`}
                    aria-pressed={isSelected}
                  >
                    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 overflow-hidden">
                      {worker.profile.avatar_url ? (
                        <img src={worker.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{initial}</span>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full ring-1 ring-white ${
                          isOffline ? 'bg-slate-400' : isMoving ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </span>
                    <span className="truncate max-w-[90px] sm:max-w-[120px] font-semibold">{displayName}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        isOffline
                          ? 'bg-slate-100 text-slate-500'
                          : isMoving
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-9 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium" title={t('header.onlineTitle')}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-semibold">{onlineCount}</span>
                <span className="hidden sm:inline">{t('header.online')}</span>
              </div>
              {movingCount > 0 && (
                <div className="flex items-center gap-1.5 text-orange-700 font-medium" title={t('header.inRouteTitle')}>
                  <Car size={14} />
                  <span className="font-semibold">{movingCount}</span>
                  <span className="hidden xl:inline">{t('header.inRoute')}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-slate-500 font-medium" title={t('header.offlineTitle')}>
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="font-semibold">{offlineCount}</span>
                <span className="hidden sm:inline">{t('header.offline')}</span>
              </div>
            </div>
          )
        )}
        <NotificationCenter />
      </div>
    </header>
  );
};
