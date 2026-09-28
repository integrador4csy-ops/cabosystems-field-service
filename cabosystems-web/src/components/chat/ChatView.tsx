import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getMyChatGroups } from '../../lib/chatApi';
import type { ChatGroup } from '../../types/chat';
import { GroupList } from './GroupList';
import { ChatConversation } from './ChatConversation';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupInfoDrawer } from './GroupInfoDrawer';
import { MessageSquare, Plus } from 'lucide-react';

export const ChatView: React.FC = () => {
  const { user, adminProfile } = useAdminAuth();
  const currentUserId = user?.id || '';
  const isGlobalAdmin =
    adminProfile?.rol === 'admin' ||
    adminProfile?.rol === 'supervisor_instalacion';

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals / Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await getMyChatGroups(currentUserId);
      setGroups(data);
      // Auto-select first group if none is selected or selected group no longer exists
      setSelectedGroupId((prev) => {
        if (prev && data.some((g) => g.id === prev)) return prev;
        return data.length > 0 ? data[0].id : null;
      });
    } catch (err) {
      console.error('Error loading groups in ChatView:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      loadGroups();

      // Realtime subscription for chat_grupos & chat_miembros to auto-refresh group list
      const channel = supabase
        .channel('chat_groups_list_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_grupos' },
          () => {
            loadGroups();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_miembros' },
          () => {
            loadGroups();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUserId, loadGroups]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  return (
    <div className="flex h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* 1. Left Sidebar: Group Conversations List */}
      <GroupList
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        onOpenCreateGroup={() => setIsCreateModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isGlobalAdmin={isGlobalAdmin}
        loading={loading}
      />

      {/* 2. Main Area: Active Chat Conversation or Empty Welcome State */}
      {selectedGroup ? (
        <ChatConversation
          key={selectedGroup.id}
          group={selectedGroup}
          currentUserId={currentUserId}
          isGlobalAdmin={isGlobalAdmin}
          onOpenInfo={() => setIsInfoDrawerOpen(true)}
          onGroupChanged={loadGroups}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-[#f78c26] mb-4 shadow-xs">
            <MessageSquare size={32} />
          </div>
          <h3 className="text-base font-bold text-[#343e48]">
            Chat Grupal CaboSystems
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 max-w-sm leading-relaxed">
            Selecciona un grupo de trabajo en la columna izquierda o crea uno nuevo para coordinar instalaciones, compartir evidencias fotográficas y videos técnicos con el equipo de campo.
          </p>
          {isGlobalAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-5 flex items-center gap-2 rounded-xl bg-[#f78c26] hover:bg-[#ea580c] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Crear Primer Grupo</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        creatorId={currentUserId}
        onGroupCreated={(newGrp) => {
          loadGroups();
          setSelectedGroupId(newGrp.id);
        }}
      />

      {/* 4. Group Info & Members Drawer */}
      <GroupInfoDrawer
        isOpen={isInfoDrawerOpen}
        onClose={() => setIsInfoDrawerOpen(false)}
        group={selectedGroup}
        currentUserId={currentUserId}
        isGlobalAdmin={isGlobalAdmin}
        onGroupUpdated={loadGroups}
        onGroupDeleted={() => {
          setIsInfoDrawerOpen(false);
          loadGroups();
        }}
      />
    </div>
  );
};
