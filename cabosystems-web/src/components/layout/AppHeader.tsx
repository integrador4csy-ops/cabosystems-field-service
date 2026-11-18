import React, { useRef, useEffect, useMemo, useState } from 'react';
import { SearchIcon, CloseIcon } from '../../icons';
import { Battery, BatteryCharging, CalendarDays, Car, ChevronDown, ChevronLeft, ChevronRight, Menu, MapPin, Plus, RefreshCw, X } from 'lucide-react';
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

  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [teamSearchText, setTeamSearchText] = useState('');
  const teamMenuContainerRef = useRef<HTMLDivElement>(null);

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

  const displayWorkers = useMemo(() => {
    const q = teamSearchText.toLowerCase().trim();
    if (!q) return sortedWorkers;
    return sortedWorkers.filter((w) => {
      const name = (w.profile?.nombre || w.profile?.full_name || '').toLowerCase();
      const email = (w.profile?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [sortedWorkers, teamSearchText]);

  useEffect(() => {
    if (!teamMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!teamMenuContainerRef.current?.contains(event.target as Node)) {
        setTeamMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTeamMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [teamMenuOpen]);

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
          <div ref={teamMenuContainerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setTeamMenuOpen((prev) => !prev)}
              aria-expanded={teamMenuOpen}
              className={`flex h-9 items-center gap-2.5 rounded-lg border px-3 text-xs font-medium shadow-2xs transition-all ${
                teamMenuOpen
                  ? 'border-brand-500 bg-brand-50/70 text-slate-800 ring-2 ring-brand-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
              title={t('header.teamListTitle')}
            >
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium" title={t('header.onlineTitle')}>
                <span className="relative flex h-2 w-2">
                  {onlineCount > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-semibold">{onlineCount}</span>
                <span className="hidden sm:inline">{t('header.online')}</span>
              </div>
              {movingCount > 0 && (
                <div className="flex items-center gap-1.5 text-orange-700 font-medium" title={t('header.inRouteTitle')}>
                  <Car size={13} />
                  <span className="font-semibold">{movingCount}</span>
                  <span className="hidden xl:inline">{t('header.inRoute')}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-slate-500 font-medium" title={t('header.offlineTitle')}>
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="font-semibold">{offlineCount}</span>
                <span className="hidden sm:inline">{t('header.offline')}</span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 ${teamMenuOpen ? 'rotate-180 text-brand-600' : ''}`}
              />
            </button>

            {teamMenuOpen && (
              <div
                className="absolute right-0 top-11 z-[120] flex max-h-[min(540px,calc(100vh-88px))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                role="dialog"
                aria-label={t('header.teamList')}
              >
                {/* Header of popover */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">{t('header.teamList')}</h2>
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {sortedWorkers.length}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {onlineCount} {t('header.online')}
                      </span>
                      {movingCount > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <Car size={12} />
                            {movingCount} {t('header.inRoute')}
                          </span>
                        </>
                      )}
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        {offlineCount} {t('header.offline')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeamMenuOpen(false)}
                    aria-label={t('Cerrar')}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search if there are more than 4 workers */}
                {sortedWorkers.length > 4 && (
                  <div className="border-b border-slate-100 p-2 bg-white">
                    <div className="relative">
                      <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="search"
                        value={teamSearchText}
                        onChange={(e) => setTeamSearchText(e.target.value)}
                        placeholder={t('Buscar colaboradores')}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20"
                      />
                    </div>
                  </div>
                )}

                {/* List of workers */}
                <div className="overflow-y-auto p-2 divide-y divide-slate-100/80">
                  {displayWorkers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      {t('No se encontraron colaboradores con esa búsqueda')}
                    </div>
                  ) : (
                    displayWorkers.map((worker) => {
                      const isSelected = selectedWorkerId === worker.profile.id;
                      const isOffline = worker.isOffline;
                      const speed = worker.location?.velocidad || 0;
                      const isMoving = !isOffline && speed > 12;
                      const fullName = worker.profile.nombre || worker.profile.full_name || worker.profile.email || t('Técnico');
                      const initial = (fullName.charAt(0) || 'T').toUpperCase();
                      const battery = worker.location?.bateria;

                      return (
                        <button
                          key={worker.profile.id}
                          type="button"
                          onClick={() => {
                            onSelectWorker?.(isSelected ? '' : worker.profile.id);
                            setTeamMenuOpen(false);
                          }}
                          className={`group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-brand-50 text-brand-950 ring-1 ring-brand-500/30'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          {/* Avatar with live status indicator */}
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 overflow-hidden ring-1 ring-slate-200">
                            {worker.profile.avatar_url ? (
                              <img src={worker.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span>{initial}</span>
                            )}
                            <span
                              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                                isOffline ? 'bg-slate-400' : isMoving ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            />
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-xs font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                                {fullName}
                              </span>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  isOffline
                                    ? 'bg-slate-100 text-slate-600'
                                    : isMoving
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isMoving ? t('header.inRoute') : isOffline ? t('header.offline') : t('header.online')}
                              </span>
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                              {isMoving ? (
                                <span className="flex items-center gap-1 text-amber-700 font-medium">
                                  <Car size={11} />
                                  {Math.round(speed)} km/h
                                </span>
                              ) : isOffline ? (
                                <span>{worker.relativeTime || t('header.offline')}</span>
                              ) : (
                                <span className="text-emerald-700 font-medium">● GPS activo</span>
                              )}

                              {typeof battery === 'number' && battery >= 0 && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="flex items-center gap-1 font-medium">
                                    {worker.location?.esta_cargando ? (
                                      <BatteryCharging size={12} className="text-amber-500" />
                                    ) : battery < 20 ? (
                                      <Battery size={12} className="text-rose-500" />
                                    ) : (
                                      <Battery size={12} className="text-slate-400" />
                                    )}
                                    <span>{Math.round(battery)}%</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <NotificationCenter />
      </div>
    </header>
  );
};
