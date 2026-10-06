import React, { createContext, useContext, useState } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  isHovered: boolean;
  activeItem: string;
  unreadChatCount: number;
  targetGroupId: string | null;
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
  const [isExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeItem, setActiveItem] = useState<string>('radar');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        isHovered,
        activeItem,
        unreadChatCount,
        targetGroupId,
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
