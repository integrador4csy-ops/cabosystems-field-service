import { useEffect, useState, useMemo, useRef, useCallback, lazy } from 'react';
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
import { RetainedView } from './components/layout/RetainedView';
import { preloadModules } from './lib/modulePreload';
import { loadLiveMap, loadChat, loadTasks, loadAgenda, loadDirectory, loadTeam } from './lib/viewModules';
import { SectionResourcesProvider, useSectionResources, canSpeculate } from './context/SectionResources';
import { fleetSnapshot } from './lib/fleetSnapshot';
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

const LiveMap = lazy(() => loadLiveMap().then((module) => ({ default: module.LiveMap })));

const ChatView = lazy(() => loadChat().then((module) => ({ default: module.ChatView })));

const ProjectsManagementView = lazy(() => loadTasks().then((module) => ({ default: module.ProjectsManagementView })));
const CompanyAgenda = lazy(() => loadAgenda().then((module) => ({ default: module.CompanyAgenda })));
const ProjectDirectoryView = lazy(() => loadDirectory().then((module) => ({ default: module.ProjectDirectoryView })));

const TeamManagementView = lazy(() => loadTeam().then((module) => ({ default: module.TeamManagementView })));

function DashboardContent() {
  const resources = useSectionResources();
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
  const fleetRequest = useRef(0);
  const fleetLoaded = useRef(false);



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

    void resources.ready.then(() => { if (isMounted) void checkInitialUnread(); });
    return () => {
      isMounted = false;
    };
  }, [user?.id, activeItem, setUnreadChatCount, resources]);

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
          resources.queries.invalidate('chat-groups');
          resources.queries.invalidate(`conversation:${newMsg.grupo_id}`);

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
  }, [user?.id, activeItem, setActiveItem, setTargetGroupId, setUnreadChatCount, t, resources]);

  // 1. Fetch fleet data
  const fetchFleet = useCallback(async (showRefreshIndicator = false, force = true) => {
    const request = ++fleetRequest.current;
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const { locations, profiles } = await resources.queries.load('fleet', fleetSnapshot, force, 10_000);
      if (request !== fleetRequest.current) return;

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

      fleetLoaded.current = true;
      setWorkers(mergedWorkers);
    } catch (err) {
      console.error('Error fetching fleet:', err);
    } finally {
      resources.markReady();
      if (showRefreshIndicator) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  }, [resources, t]);

  useEffect(() => {
    let cancelled = false;
    let stop = () => {};
    void resources.ready.then(() => {
      if (cancelled) return;
      // First paint/data have priority. Only the two common next views warm their code.
      stop = preloadModules([
        () => canSpeculate() && !resources.queries.busy ? fetchFleet(false, false) : Promise.resolve(),
        () => canSpeculate() && !resources.queries.busy ? loadTasks() : Promise.resolve(),
        () => canSpeculate() && !resources.queries.busy ? loadAgenda() : Promise.resolve(),
      ]);
    });
    return () => { cancelled = true; stop(); };
  }, [resources, fetchFleet]);

  // Realtime stays available; polling is a visible-radar fallback only.
  useEffect(() => {

    const channel = supabase
      .channel('radar-ubicaciones-en-vivo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ubicaciones_usuarios' },
        (payload) => {
          const newLoc = payload.new as UserLocation;
          if (!newLoc || !newLoc.usuario_id) return;
          resources.queries.invalidate('fleet');

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
              if (fleetLoaded.current) void fetchFleet(false, false);
              return prevWorkers;
            }
          });
        }
      )
      .subscribe();

    return () => {
      fleetRequest.current++;
      supabase.removeChannel(channel);
    };
  }, [fetchFleet, resources]);

  useEffect(() => {
    if (activeItem !== 'radar') return;
    const refresh = () => { if (document.visibilityState === 'visible') void fetchFleet(); };
    void fetchFleet(false, false);
    const interval = setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [activeItem, fetchFleet]);

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
          <RetainedView active={activeItem === 'chat'} fallback={<ViewLoading />}>
            <ChatView />
          </RetainedView>
          <RetainedView active={['colaboradores', 'invitaciones'].includes(activeItem)} fallback={<ViewLoading />}>
            <TeamManagementView onTeamChanged={fetchFleet} />
          </RetainedView>
          <RetainedView active={activeItem === 'directorio-proyectos'} fallback={<ViewLoading />}>
            <ProjectDirectoryView key={user?.id} />
          </RetainedView>
          <RetainedView active={activeItem === 'agenda'} fallback={<ViewLoading />}>
            <CompanyAgenda key={user?.id} />
          </RetainedView>
          <RetainedView active={activeItem === 'proyectos'} fallback={<ViewLoading />}>
            <ProjectsManagementView mode="tasks" />
          </RetainedView>
          <RetainedView active={!['chat', 'colaboradores', 'invitaciones', 'directorio-proyectos', 'agenda', 'proyectos'].includes(activeItem)} fallback={<ViewLoading />}>
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
          </RetainedView>
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
  const { user, loading, adminProfile } = useAdminAuth();

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
    <SectionResourcesProvider key={`${user.id}/${adminProfile?.rol}/${adminProfile?.activo}`}>
      <SidebarProvider>
        <DashboardContent />
      </SidebarProvider>
    </SectionResourcesProvider>
  );
}

function ViewLoading() {
  const { t } = useTranslation();
  return <div role="status" className="operational-panel flex flex-1 items-center justify-center text-sm text-slate-500">{t('Cargando vista...')}</div>;
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
