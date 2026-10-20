import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import type { LiveWorker, Profile, UserLocation } from './types/fleet';
import { formatRelativeTime, isWorkerOffline } from './lib/timeAgo';
import { AdminLoginModal } from './components/modals/AdminLoginModal';
import { AdminEditProfileModal } from './components/modals/AdminEditProfileModal';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { useTranslation, LanguageProvider } from './context/LanguageContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { AuthSplitScreen } from './components/auth/AuthSplitScreen';
import {
  playNotificationSound,
  requestDesktopNotificationPermission,
  showDesktopNotification,
  updateTabTitle,
  resetTabTitle,
} from './lib/desktopNotifications';
import {
  ChatNotificationToastContainer,
  type ChatToastItem,
} from './components/chat/ChatNotificationToast';

const LiveMap = lazy(() => import('./components/LiveMap').then((module) => ({ default: module.LiveMap })));

const ChatView = lazy(() => import('./components/chat/ChatView').then((module) => ({ default: module.ChatView })));

const ProjectsManagementView = lazy(() => import('./components/projects/ProjectsManagementView').then((module) => ({ default: module.ProjectsManagementView })));
const CompanyAgenda = lazy(() => import('./components/agenda/CompanyAgenda').then((module) => ({ default: module.CompanyAgenda })));
const ProjectDirectoryView = lazy(() => import('./components/projects/ProjectDirectoryView').then((module) => ({ default: module.ProjectDirectoryView })));

const TeamManagementView = lazy(() => import('./components/team/TeamManagementView').then((module) => ({ default: module.TeamManagementView })));

function DashboardContent() {
  const { t } = useTranslation();
  const {
    activeItem,
    isExpanded,
    setActiveItem,
    setUnreadChatCount,
    setTargetGroupId,
  } = useSidebar();
  const { user } = useAdminAuth();
  const [chatToasts, setChatToasts] = useState<ChatToastItem[]>([]);
  const [workers, setWorkers] = useState<LiveWorker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);

  // Solicitar permisos de notificación de escritorio en el navegador
  useEffect(() => {
    requestDesktopNotificationPermission();
  }, []);

  // Al entrar a la vista de chat, limpiar los contadores y toasts
  useEffect(() => {
    if (activeItem === 'chat') {
      try {
        localStorage.setItem('csy_last_chat_view_time', new Date().toISOString());
      } catch {
        // ignore
      }
      setUnreadChatCount(0);
      setChatToasts([]);
      resetTabTitle();
    }
  }, [activeItem, setUnreadChatCount]);

  // Verificar mensajes no leídos iniciales al cargar la aplicación (ej. en el mapa satelital)
  useEffect(() => {
    if (!user?.id || activeItem === 'chat') return;

    let isMounted = true;
    async function checkInitialUnread() {
      try {
        const lastViewTime = localStorage.getItem('csy_last_chat_view_time');
        // Si no hay tiempo guardado, verificar la última hora
        const sinceTime = lastViewTime || new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { count, error } = await supabase
          .from('chat_mensajes')
          .select('*', { count: 'exact', head: true })
          .gt('created_at', sinceTime)
          .neq('remitente_id', user!.id);

        if (!error && count && count > 0 && isMounted) {
          setUnreadChatCount(count);
          updateTabTitle(count);
        }
      } catch (err) {
        console.warn('Error al verificar mensajes no leídos iniciales:', err);
      }
    }

    checkInitialUnread();
    return () => {
      isMounted = false;
    };
  }, [user?.id, activeItem, setUnreadChatCount]);

  // Escuchar mensajes entrantes en tiempo real para notificaciones in-app y de escritorio
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('global_desktop_chat_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          // Si el mensaje es del propio usuario conectado, ignorar
          if (newMsg.remitente_id === user.id) return;

          try {
            // Obtener nombre del grupo y del remitente
            const [grpRes, senderRes] = await Promise.all([
              supabase.from('chat_grupos').select('nombre').eq('id', newMsg.grupo_id).single(),
              supabase.from('profiles').select('nombre').eq('id', newMsg.remitente_id).single(),
            ]);

            const groupName = grpRes.data?.nombre || 'Chat';
            const senderName = senderRes.data?.nombre || t("Colaborador");

            let preview = newMsg.contenido || t("Nuevo mensaje");
            if (newMsg.tipo === 'imagen') preview = t("📷 Foto");
            if (newMsg.tipo === 'video') preview = t("🎥 Video");
            if (newMsg.tipo === 'sticker') preview = '🎨 Sticker';

            const isUserActivelyInChat = activeItem === 'chat' && !document.hidden;

            // Si el usuario NO está en la vista de chat O si la pestaña del navegador está en segundo plano / minimizada:
            if (!isUserActivelyInChat) {
              // 1. Sonido suave sintetizado
              playNotificationSound();

              // 2. Incrementar badge numérico en sidebar y título de pestaña
              setUnreadChatCount((prev) => {
                const next = prev + 1;
                updateTabTitle(next);
                return next;
              });

              // 3. Notificación nativa del sistema operativo (Windows / Mac)
              showDesktopNotification(`💬 ${groupName}`, `${senderName}: ${preview}`, () => {
                setTargetGroupId(newMsg.grupo_id);
                setActiveItem('chat');
                setUnreadChatCount(0);
                resetTabTitle();
              });

              // 4. Banner flotante in-app (si la ventana del navegador está visible)
              if (!document.hidden) {
                const toastId = `${newMsg.id}-${Date.now()}`;
                setChatToasts((prev) => [
                  ...prev.slice(-2),
                  {
                    id: toastId,
                    groupId: newMsg.grupo_id,
                    groupName,
                    senderName,
                    preview,
                    createdAt: new Date(),
                  },
                ]);

                // Auto-cerrar el toast a los 6 segundos
                setTimeout(() => {
                  setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
                }, 6000);
              }
            }
          } catch (e) {
            console.warn('Error procesando alerta de chat:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeItem, setActiveItem, setTargetGroupId, setUnreadChatCount, t]);

  // 1. Fetch fleet data
  const fetchFleet = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const { data: locations, error: locError } = await supabase
        .from('ubicaciones_usuarios')
        .select('*');

      if (locError) {
        console.error('Error fetching locations:', locError);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nombre, rol, avatar_url, activo');

      const profileMap = new Map<string, Profile>();
      (profiles || []).forEach((p: Profile) => {
        profileMap.set(p.id, p);
      });

      const mergedWorkers: LiveWorker[] = (locations || [])
        .filter((loc: UserLocation) => {
          const prof = profileMap.get(loc.usuario_id);
          return !prof || prof.activo !== false;
        })
        .map((loc: UserLocation) => {
          const prof = profileMap.get(loc.usuario_id);
          const profile: Profile = prof || {
            id: loc.usuario_id,
            nombre: t("Técnico CaboSystems"),
            rol: t("Técnico de Campo"),
            avatar_url: null,
            activo: true,
          };

          const isOffline = isWorkerOffline(loc);
          return {
            profile,
            location: loc,
            isOffline,
            relativeTime: formatRelativeTime(loc.updated_at),
            displayLat: loc.latitud,
            displayLng: loc.longitud,
            targetLat: loc.latitud,
            targetLng: loc.longitud,
          };
        });

      setWorkers(mergedWorkers);
    } catch (err) {
      console.error('Error fetching fleet:', err);
    } finally {
      if (showRefreshIndicator) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  };

  // 2. Realtime Subscription & 1.5s Polling Interval
  useEffect(() => {
    fetchFleet();

    const channel = supabase
      .channel('radar-ubicaciones-en-vivo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ubicaciones_usuarios' },
        (payload) => {
          const newLoc = payload.new as UserLocation;
          if (!newLoc || !newLoc.usuario_id) return;

          setWorkers((prevWorkers) => {
            const index = prevWorkers.findIndex(
              (w) =>
                w.profile.id === newLoc.usuario_id ||
                w.location.usuario_id === newLoc.usuario_id
            );
            if (index !== -1) {
              const updated = [...prevWorkers];
              const current = updated[index];
              const isOffline = isWorkerOffline(newLoc);

              updated[index] = {
                ...current,
                location: newLoc,
                isOffline,
                relativeTime: formatRelativeTime(newLoc.updated_at),
                targetLat: newLoc.latitud,
                targetLng: newLoc.longitud,
              };
              return updated;
            } else {
              fetchFleet();
              return prevWorkers;
            }
          });
        }
      )
      .subscribe();

    const syncInterval = setInterval(() => {
      fetchFleet();
    }, 1500);

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered workers based on search query
  const filteredWorkers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return workers;
    return workers.filter((w) => {
      const name = (w.profile.nombre || w.profile.full_name || '').toLowerCase();
      const email = (w.profile.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [workers, searchQuery]);

  // Statistics counters
  const onlineCount = useMemo(
    () => workers.filter((w) => !w.isOffline).length,
    [workers]
  );
  const offlineCount = useMemo(
    () => workers.filter((w) => w.isOffline).length,
    [workers]
  );
  const movingCount = useMemo(
    () =>
      workers.filter((w) => !w.isOffline && (w.location.velocidad || 0) > 12)
        .length,
    [workers]
  );

  const handleSelectWorker = (id: string) => {
    setSelectedWorkerId(id ? id : null);
    if (id) {
      setFocusTrigger(Date.now());
    }
  };

  // If search query is cleared, dismiss focused card immediately
  // If search query has 1 matching technician, auto-focus
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSelectedWorkerId(null);
    } else if (filteredWorkers.length === 1) {
      setSelectedWorkerId(filteredWorkers[0].profile.id);
      setFocusTrigger(Date.now());
    }
  }, [searchQuery, filteredWorkers]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      <a href="#main-content" className="skip-link">{t("Saltar al contenido")}</a>
      {/* 1. Permanent Fixed Sidebar with Hover Expansion & Admin Profile Card */}
      <AppSidebar />

      {/* 2. Main Content Wrapper (Offset for collapsed icon sidebar) */}
      <div className={`flex flex-1 flex-col h-dvh min-w-0 overflow-hidden transition-[padding] duration-200 ${isExpanded ? 'md:pl-64' : 'md:pl-[72px]'}`}>
        {/* Top Minimalist Header */}
        <AppHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onlineCount={onlineCount}
          movingCount={movingCount}
          offlineCount={offlineCount}
        />

        {/* 3. Main View: GPS Radar Map, Team Group Chat or Projects Management */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 p-3 lg:p-3.5 overflow-hidden relative flex flex-col">
          <Suspense fallback={<div role="status" className="operational-panel flex flex-1 items-center justify-center text-sm text-slate-500">{t('Cargando vista...')}</div>}>
          {activeItem === 'chat' ? (
            <ChatView />
          ) : ['colaboradores', 'invitaciones'].includes(activeItem) ? (
            <TeamManagementView onTeamChanged={fetchFleet} />
          ) : activeItem === 'directorio-proyectos' ? (
            <ProjectDirectoryView key={user?.id} />
          ) : activeItem === 'agenda' ? (
            <CompanyAgenda key={user?.id} />
          ) : activeItem === 'proyectos' ? (
            <ProjectsManagementView mode="tasks" />
          ) : (
            <div className="flex-1 h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden relative isolate">
              <LiveMap
                workers={filteredWorkers}
                selectedWorkerId={selectedWorkerId}
                onSelectWorker={handleSelectWorker}
                focusTrigger={focusTrigger}
                onRefresh={() => fetchFleet(true)}
                isRefreshing={isRefreshing}
              />
            </div>
          )}
          </Suspense>
        </main>
      </div>

      {/* 5. Admin Authentication & Profile Modals */}
      <AdminLoginModal />
      <AdminEditProfileModal />

      {/* 6. Floating In-App Chat Notifications */}
      <ChatNotificationToastContainer
        toasts={chatToasts}
        onDismiss={(id) => setChatToasts((prev) => prev.filter((t) => t.id !== id))}
        onOpenChat={(groupId) => {
          setTargetGroupId(groupId);
          setActiveItem('chat');
          setUnreadChatCount(0);
          setChatToasts([]);
          resetTabTitle();
        }}
      />
    </div>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const { user, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo-cabosystems-icon.svg"
            alt="CaboSystems"
            className="h-12 w-12 animate-pulse object-contain"
          />
          <span className="text-xs font-bold text-slate-400">{t("Cargando CaboSystems...")}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthSplitScreen />;
  }

  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <AdminAuthProvider>
        <AppContent />
      </AdminAuthProvider>
    </LanguageProvider>
  );
}

export default App;
