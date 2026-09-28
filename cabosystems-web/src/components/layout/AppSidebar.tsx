import React, { useState, useRef, useEffect } from 'react';
import { useSidebar } from '../../context/SidebarContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils';
import {
  GridIcon,
  GroupIcon,
  ChatIcon,
} from '../../icons';
import {
  Clock,
  UserPlus,
  Settings,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';

interface AppSidebarProps {
  onOpenCollaboratorsModal: () => void;
  onOpenInvitationsModal: () => void;
  onOpenInviteModal: () => void;
  workersCount?: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  onOpenCollaboratorsModal,
  onOpenInvitationsModal,
  onOpenInviteModal,
}) => {
  const {
    isHovered,
    setIsHovered,
    activeItem,
    setActiveItem,
  } = useSidebar();

  const {
    user,
    adminProfile,
    setIsLoginModalOpen,
    setIsEditProfileModalOpen,
    logout,
  } = useAdminAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isWide = isHovered;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    {
      id: 'radar',
      name: 'Radar Satelital',
      icon: <GridIcon size={20} className="shrink-0" />,
      action: () => setActiveItem('radar'),
    },
    {
      id: 'colaboradores',
      name: 'Colaboradores',
      icon: <GroupIcon size={20} className="shrink-0" />,
      badge: 'Equipo',
      badgeColor: 'bg-slate-100 text-slate-600',
      action: () => {
        onOpenCollaboratorsModal();
      },
    },
    {
      id: 'invitaciones',
      name: 'Invitaciones',
      icon: <Clock size={19} className="shrink-0" />,
      badge: 'Activas',
      badgeColor: 'bg-slate-100 text-slate-600',
      action: () => {
        onOpenInvitationsModal();
      },
    },
    {
      id: 'invitar',
      name: 'Invitar Colaborador',
      icon: <UserPlus size={19} className="shrink-0" />,
      badge: '+ Nuevo',
      badgeColor: 'bg-orange-50 text-orange-700 border border-orange-200/80',
      action: () => {
        onOpenInviteModal();
      },
    },
    {
      id: 'chat',
      name: 'Chat de Equipo',
      icon: <ChatIcon size={20} className="shrink-0" />,
      badge: 'Pronto',
      badgeColor: 'bg-slate-100 text-slate-400 border border-slate-200/60 font-medium',
      disabled: true,
      action: () => {},
    },
  ];

  const adminName = adminProfile?.nombre || 'Admin CaboSystems';
  const adminRoleLabel =
    adminProfile?.rol === 'admin'
      ? 'Super Administrador'
      : (adminProfile?.rol?.replace(/_/g, ' ') || 'Super Administrador');

  const initials = adminName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsMenuOpen(false);
      }}
      className={cn(
        'fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between border-r border-slate-200 bg-white select-none font-sans transition-all duration-300 ease-in-out',
        isWide ? 'w-64 shadow-2xl' : 'w-[72px] shadow-xs'
      )}
    >
      {/* Top: Logo & Branding */}
      <div>
        <div className="flex h-16 items-center px-4 border-b border-slate-100">
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

        {/* Navigation Section */}
        <div className="px-2.5 pt-3">
          {isWide && (
            <p className="px-2.5 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Operaciones y Personal
            </p>
          )}

          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = activeItem === item.id;
              const isDisabled = item.disabled;

              return (
                <button
                  key={item.id}
                  onClick={isDisabled ? undefined : item.action}
                  disabled={isDisabled}
                  className={cn(
                    'group relative flex items-center rounded-xl py-2.5 text-xs font-semibold transition-all duration-150 text-left',
                    isDisabled
                      ? 'text-slate-400 opacity-60 cursor-not-allowed hover:bg-transparent border border-transparent'
                      : isActive
                        ? 'bg-orange-50 text-[#f78c26] border border-orange-200 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent',
                    isWide ? 'px-3 justify-between' : 'justify-center px-0'
                  )}
                  title={isDisabled ? `${item.name} (Próximamente)` : (!isWide ? item.name : undefined)}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className={cn(
                        isDisabled
                          ? 'text-slate-400'
                          : isActive
                            ? 'text-[#f78c26]'
                            : 'text-slate-400 group-hover:text-slate-600'
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
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex h-8.5 w-8.5 shrink-0 items-center justify-center">
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-orange-100 text-[#f78c26] font-bold text-xs overflow-hidden border border-orange-200/80">
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
                    <h4 className="truncate text-xs font-bold text-[#343e48] group-hover:text-[#f78c26] transition-colors">
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
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-[#f78c26] hover:bg-orange-50 transition-colors"
                  title="Opciones de perfil"
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
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[#f78c26] hover:border-orange-300 shadow-2xs overflow-hidden">
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

            {/* Dropdown Menu - Exactly 2 Options: Editar Perfil & Cerrar Sesión */}
            {isMenuOpen && (
              <div
                className={cn(
                  'absolute z-50 bottom-[calc(100%+8px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-bottom-2 duration-150',
                  isWide ? 'left-3 right-3' : 'left-3 w-48'
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditProfileModalOpen(true);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#343e48] hover:bg-orange-50 hover:text-[#f78c26] transition-colors cursor-pointer"
                  >
                    <User size={15} className="text-slate-400 group-hover:text-[#f78c26]" />
                    <span>Editar Perfil</span>
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
                    <span>Cerrar Sesión</span>
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
            title="Iniciar Sesión de Administrador"
          >
            <LogIn size={16} />
            {isWide && <span>Iniciar Sesión</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
