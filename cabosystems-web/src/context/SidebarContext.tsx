import React, { createContext, useContext, useState } from 'react';
import { useSessionPreference } from '../hooks/useSessionPreference';
import { isNavigationItem, isStringPreference } from '../lib/sessionPreferences';

interface SidebarContextType {
  targetTaskId: string | null;
  setTargetTaskId: (id: string | null) => void;
  chatSearchQuery: string;
  setChatSearchQuery: (query: string) => void;
  chatCreateVersion: number;
  requestCreateChatGroup: () => void;
  teamSearchQuery: string;
  setTeamSearchQuery: (query: string) => void;
  teamInviteVersion: number;
  requestCreateTeamInvite: () => void;
  agendaSearchQuery: string;
  setAgendaSearchQuery: (query: string) => void;
  agendaCreateVersion: number;
  requestCreateEvent: () => void;
  directorySearchQuery: string;
  setDirectorySearchQuery: (query: string) => void;
  warrantySearchQuery: string;
  setWarrantySearchQuery: (query: string) => void;
  warrantyCreateVersion: number;
  requestCreateWarranty: () => void;
  isExpanded: boolean;
  isHovered: boolean;
  isMobileOpen: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeItem: string;
  unreadChatCount: number;
  targetGroupId: string | null;
  taskSearchQuery: string;
  setTaskSearchQuery: (query: string) => void;
  taskCreateVersion: number;
  requestCreateTask: () => void;
  setIsHovered: (hovered: boolean) => void;
  setActiveItem: (item: string) => void;
  setUnreadChatCount: React.Dispatch<React.SetStateAction<number>>;
  setTargetGroupId: (id: string | null) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default: collapsed into icon strip, expands on hover
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeItem, setActiveItem] = useSessionPreference('csy_active_section', 'radar', isNavigationItem);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useSessionPreference('csy_task_search', '', isStringPreference);
  const [taskCreateVersion, setTaskCreateVersion] = useState(0);
  const [agendaSearchQuery, setAgendaSearchQuery] = useSessionPreference('csy_company_agenda_search', '', isStringPreference);
  const [agendaCreateVersion, setAgendaCreateVersion] = useState(0);
  const [directorySearchQuery, setDirectorySearchQuery] = useSessionPreference('csy_directory_search', '', isStringPreference);
  const [warrantySearchQuery, setWarrantySearchQuery] = useSessionPreference('csy_warranty_search', '', isStringPreference);
  const [warrantyCreateVersion, setWarrantyCreateVersion] = useState(0);
  const [chatSearchQuery, setChatSearchQuery] = useSessionPreference('csy_chat_search', '', isStringPreference);
  const [chatCreateVersion, setChatCreateVersion] = useState(0);
  const [teamSearchQuery, setTeamSearchQuery] = useSessionPreference('csy_team_search', '', isStringPreference);
  const [teamInviteVersion, setTeamInviteVersion] = useState(0);

  return (
    <SidebarContext.Provider
      value={{
        targetTaskId,
        setTargetTaskId,
        chatSearchQuery,
        setChatSearchQuery,
        chatCreateVersion,
        requestCreateChatGroup: () => setChatCreateVersion((version) => version + 1),
        teamSearchQuery,
        setTeamSearchQuery,
        teamInviteVersion,
        requestCreateTeamInvite: () => setTeamInviteVersion((version) => version + 1),
        agendaSearchQuery,
        setAgendaSearchQuery,
        agendaCreateVersion,
        requestCreateEvent: () => setAgendaCreateVersion((version) => version + 1),
        directorySearchQuery,
        setDirectorySearchQuery,
        warrantySearchQuery,
        setWarrantySearchQuery,
        warrantyCreateVersion,
        requestCreateWarranty: () => setWarrantyCreateVersion((version) => version + 1),
        isExpanded,
        isHovered,
        isMobileOpen,
        setIsExpanded,
        setIsMobileOpen,
        activeItem,
        unreadChatCount,
        targetGroupId,
        taskSearchQuery,
        setTaskSearchQuery,
        taskCreateVersion,
        requestCreateTask: () => setTaskCreateVersion((version) => version + 1),
        setIsHovered,
        setActiveItem,
        setUnreadChatCount,
        setTargetGroupId,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
