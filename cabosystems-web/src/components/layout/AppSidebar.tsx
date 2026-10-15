import { getRoleLabel } from '../../lib/uiTranslations';
import { useDialog } from '../ui/useDialog';
import React, { useState, useRef, useEffect } from 'react';
import { useSidebar } from '../../context/SidebarContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils';
import {
  GroupIcon,
  ChatIcon,
} from '../../icons';
import {
  Map,
  Settings,
  User,
  LogOut,
  LogIn,
  Globe,
  ListTodo,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    setIsExpanded,
    setIsMobileOpen,
    isHovered,
    setIsHovered,
    activeItem,
    setActiveItem,
    unreadChatCount,
    setUnreadChatCount,
  } = useSidebar();

  const {
    user,
    adminProfile,
    setIsLoginModalOpen,
    setIsEditProfileModalOpen,
    logout,
  } = useAdminAuth();

  const { language, setLanguage, t } = useLanguage();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navigationRef = useDialog<HTMLElement>(isMobileOpen, () => setIsMobileOpen(false));

  const isWide = isExpanded || isHovered || isMobileOpen;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  interface NavItem {
    id: string;
    name: string;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: string;
    disabled?: boolean;
    action: () => void;
  }

  const navItems: NavItem[] = [
    {
      id: 'radar',
      name: t('sidebar.radar'),
      icon: <Map size={20} className="shrink-0" />,
      action: () => setActiveItem('radar'),
    },
    {
      id: 'proyectos',
      name: t('sidebar.projects'),
      icon: <ListTodo size={20} className="shrink-0" />,
      action: () => setActiveItem('proyectos'),
    },
    {
      id: 'agenda',
      name: t('sidebar.agenda'),
      icon: <CalendarDays size={20} className="shrink-0" />,
      action: () => setActiveItem('agenda'),
    },
    {
      id: 'colaboradores',
      name: language === 'es' ? t("Equipo") : 'Team',
      icon: <GroupIcon size={20} className="shrink-0" />,
      action: () => {
        setActiveItem('colaboradores');
      },
    },
    {
      id: 'chat',
      name: t('sidebar.chat'),
      icon: (
        <span className="relative inline-flex items-center justify-center overflow-visible">
          <ChatIcon size={20} className="shrink-0" />
          {!isWide && unreadChatCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 z-30 flex items-center justify-center pointer-events-none">
              <span className="flex h-4 min-w-[17px] px-1 items-center justify-center rounded-full bg-red-500 text-[9.5px] font-black leading-none text-white shadow-xs ring-2 ring-white">
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            </span>
          )}
        </span>
      ),
      badge:
        unreadChatCount > 0
          ? `${unreadChatCount} ${unreadChatCount > 1 ? t('sidebar.newMessages') : t('sidebar.newMessage')}`
          : t('sidebar.chatLive'),
      badgeColor:
        unreadChatCount > 0
          ? 'bg-red-500 text-white font-bold animate-pulse shadow-2xs'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold',
      action: () => {
        setUnreadChatCount(0);
        setActiveItem('chat');
      },
    },
  ];

  const adminName = adminProfile?.nombre || 'Admin CaboSystems';
  const adminRoleLabel =
    adminProfile?.rol === 'admin'
      ? t('sidebar.superAdmin')
      : (adminProfile?.rol ? getRoleLabel(adminProfile.rol, t) : t('sidebar.superAdmin'));

  const initials = adminName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <>
    {isMobileOpen && <button type="button" aria-label={t("Cerrar navegación")} onClick={() => setIsMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-900/40 md:hidden" />}
    <aside
      ref={navigationRef}
      role={isMobileOpen ? 'dialog' : undefined}
      aria-modal={isMobileOpen || undefined}
      tabIndex={-1}
      id="app-navigation"
      aria-label={t("Navegación principal")}
      onFocus={() => setIsHovered(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsHovered(false); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { setIsMobileOpen(false); setIsMenuOpen(false); setIsHovered(false); } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsMenuOpen(false);
      }}
      className={cn(
        'fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between border-r border-slate-200 bg-white select-none font-sans transition-all duration-300 ease-in-out',
        isWide ? 'w-64' : 'w-[72px]',
        isMobileOpen ? 'flex' : 'hidden md:flex'
      )}
    >
      {/* Top: Logo & Branding */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
          {isWide ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <img
                src="/logo-cabosystems-light.svg"
                alt="CaboSystems Field Service"
                className="h-11 w-auto max-w-[215px] object-contain"
              />
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center">
              <img
                src="/logo-cabosystems-icon.svg"
                alt="CaboSystems"
                className="h-9 w-9 object-contain transition-transform duration-200 hover:scale-110"
              />
            </div>
          )}
        </div>

        <div className="hidden md:flex justify-center px-3 py-2">
          <button type="button" onClick={() => setIsExpanded((previous) => !previous)} aria-expanded={isExpanded} aria-controls="app-navigation" title={isExpanded ? t("Contraer menú") : t("Fijar menú abierto")} className="hidden md:flex h-9 w-full items-center justify-center gap-2 rounded-lg text-slate-500 hover:bg-slate-100">
            {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            {isWide && <span className="text-xs">{isExpanded ? t("Contraer menú") : t("Fijar menú abierto")}</span>}
          </button>
        </div>
        {/* Navigation Section */}
        <div className="px-2.5 pt-3">
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = activeItem === item.id || (item.id === 'colaboradores' && activeItem === 'invitaciones');
              const isDisabled = item.disabled;

              return (
                <button
                  key={item.id}
                  aria-label={item.name}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={isDisabled ? undefined : () => { item.action(); setIsMobileOpen(false); setIsHovered(false); }}
                  disabled={isDisabled}
                  className={cn(
                    'group relative flex h-11 items-center rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 text-left',
                    isDisabled
                      ? 'text-slate-400 opacity-60 cursor-not-allowed hover:bg-transparent border border-transparent'
                      : isActive
                        ? 'bg-orange-50 text-brand-500 border border-orange-200 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent',
                    isWide ? 'px-3 justify-between' : 'justify-center px-0'
                  )}
                  title={
                    isDisabled
                      ? t("{value0} (Próximamente)", { value0: item.name })
                      : !isWide
                        ? item.id === 'chat' && unreadChatCount > 0
                          ? `${item.name} (${unreadChatCount})`
                          : item.name
                        : undefined
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0 overflow-visible">
                    <span
                      className={cn(
                        isDisabled
                          ? 'text-slate-400'
                          : isActive
                            ? 'text-brand-500'
                            : 'text-slate-400 group-hover:text-slate-600',
                        'relative shrink-0 overflow-visible'
                      )}
                    >
                      {item.icon}
                    </span>
                    {isWide && <span className="truncate">{item.name}</span>}
                  </div>

                  {isWide && item.badge && (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-bold shrink-0',
                        item.badgeColor
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom: Admin Profile Card / Menu */}
      <div ref={menuRef} className="relative p-3 border-t border-slate-100 bg-slate-50/60">
        {user ? (
          <>
            {isWide ? (
              <div
                role="button" tabIndex={0} aria-label={t("Opciones de perfil")} aria-expanded={isMenuOpen}
                onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setIsMenuOpen(!isMenuOpen); } }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex h-8.5 w-8.5 shrink-0 items-center justify-center">
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-orange-100 text-brand-500 font-bold text-xs overflow-hidden border border-orange-200/80">
                      {adminProfile?.avatar_url ? (
                        <img
                          src={adminProfile.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-xs" />
                  </div>
                  <div className="overflow-hidden text-left">
                    <h4 className="truncate text-xs font-bold text-[#343e48] group-hover:text-brand-500 transition-colors">
                      {adminName}
                    </h4>
                    <p className="truncate text-[10.5px] text-slate-500 font-medium">
                      {adminRoleLabel}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-brand-500 hover:bg-orange-50 transition-colors"
                  title={t("Opciones de perfil")}
                >
                  <Settings size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="relative mx-auto flex h-9 w-9 items-center justify-center cursor-pointer group"
                title={`${adminName} (${adminRoleLabel})`}
              >
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-brand-500 hover:border-orange-300 shadow-2xs overflow-hidden">
                  {adminProfile?.avatar_url ? (
                    <img
                      src={adminProfile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-xs">{initials}</span>
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-xs" />
              </button>
            )}

            {/* Dropdown Menu - Editar Perfil, Idioma & Cerrar Sesión */}
            {isMenuOpen && (
              <div
                className={cn(
                  'absolute z-50 bottom-[calc(100%+8px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-bottom-2 duration-150',
                  isWide ? 'left-3 right-3' : 'left-3 w-52'
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditProfileModalOpen(true);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#343e48] hover:bg-orange-50 hover:text-brand-500 transition-colors cursor-pointer"
                  >
                    <User size={15} className="text-slate-400 group-hover:text-brand-500" />
                    <span>{t('sidebar.editProfile')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLanguage(language === 'es' ? 'en' : 'es');
                    }}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#343e48] hover:bg-orange-50 hover:text-brand-500 transition-colors cursor-pointer"
                    title={language === 'es' ? 'Cambiar a English' : 'Switch to Spanish'}
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe size={15} className="text-slate-400 group-hover:text-brand-500" />
                      <span>{t('sidebar.language')}</span>
                    </div>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                      {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
                    </span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <LogOut size={15} className="text-rose-500" />
                    <span>{t('sidebar.logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* When not authenticated */
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2.5 transition-all shadow-xs cursor-pointer',
              isWide ? 'w-full px-3' : 'w-10 h-10 mx-auto p-0'
            )}
            title={t("Iniciar Sesión de Administrador")}
          >
            <LogIn size={16} />
            {isWide && <span>{t('sidebar.login')}</span>}
          </button>
        )}
      </div>
    </aside>
    </>
  );
};
