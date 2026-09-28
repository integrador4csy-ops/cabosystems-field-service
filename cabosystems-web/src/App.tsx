import { useEffect, useState, useMemo } from 'react';
import './App.css';
import { supabase } from './lib/supabase';
import type { LiveWorker, Profile, UserLocation } from './types/fleet';
import { formatRelativeTime, isWorkerOffline } from './lib/timeAgo';
import { LiveMap } from './components/LiveMap';
import { CollaboratorsModal } from './components/modals/CollaboratorsModal';
import { InvitationsModal } from './components/modals/InvitationsModal';
import { InviteUserModal } from './components/modals/InviteUserModal';
import { AdminLoginModal } from './components/modals/AdminLoginModal';
import { AdminEditProfileModal } from './components/modals/AdminEditProfileModal';
import { SidebarProvider } from './context/SidebarContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppHeader } from './components/layout/AppHeader';

function DashboardContent() {
  const [workers, setWorkers] = useState<LiveWorker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCollaboratorsModalOpen, setIsCollaboratorsModalOpen] = useState(false);
  const [isInvitationsModalOpen, setIsInvitationsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);

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
            nombre: 'Técnico CaboSystems',
            rol: 'Técnico de Campo',
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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      {/* 1. Permanent Fixed Sidebar with Hover Expansion & Admin Profile Card */}
      <AppSidebar
        onOpenCollaboratorsModal={() => setIsCollaboratorsModalOpen(true)}
        onOpenInvitationsModal={() => setIsInvitationsModalOpen(true)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        workersCount={workers.length}
      />

      {/* 2. Main Content Wrapper (Offset for collapsed icon sidebar) */}
      <div className="flex flex-1 flex-col h-screen min-w-0 overflow-hidden pl-[72px]">
        {/* Top Minimalist Header */}
        <AppHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onlineCount={onlineCount}
          movingCount={movingCount}
          offlineCount={offlineCount}
        />

        {/* 3. 100% Full-Screen GPS Radar Map (Dominant Hero Component) */}
        <main className="flex-1 min-h-0 p-3 lg:p-3.5 overflow-hidden relative flex flex-col">
          <div className="flex-1 h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden relative">
            <LiveMap
              workers={filteredWorkers}
              selectedWorkerId={selectedWorkerId}
              onSelectWorker={handleSelectWorker}
              focusTrigger={focusTrigger}
              onRefresh={() => fetchFleet(true)}
              isRefreshing={isRefreshing}
            />
          </div>
        </main>
      </div>

      {/* 4. Dedicated Modals */}
      <CollaboratorsModal
        isOpen={isCollaboratorsModalOpen}
        onClose={() => setIsCollaboratorsModalOpen(false)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onUserListChanged={fetchFleet}
      />

      <InvitationsModal
        isOpen={isInvitationsModalOpen}
        onClose={() => setIsInvitationsModalOpen(false)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
      />

      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInviteCreated={fetchFleet}
      />

      {/* 5. Admin Authentication & Profile Modals */}
      <AdminLoginModal />
      <AdminEditProfileModal />
    </div>
  );
}

export function App() {
  return (
    <AdminAuthProvider>
      <SidebarProvider>
        <DashboardContent />
      </SidebarProvider>
    </AdminAuthProvider>
  );
}

export default App;
