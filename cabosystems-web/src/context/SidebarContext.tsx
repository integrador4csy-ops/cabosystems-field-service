import React, { createContext, useContext, useState } from 'react';

interface SidebarContextType {
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
  const [activeItem, setActiveItem] = useState<string>('radar');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskCreateVersion, setTaskCreateVersion] = useState(0);

  return (
    <SidebarContext.Provider
      value={{
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
