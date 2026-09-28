import React, { createContext, useContext, useState } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  isHovered: boolean;
  activeItem: string;
  setIsHovered: (hovered: boolean) => void;
  setActiveItem: (item: string) => void;
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

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        isHovered,
        activeItem,
        setIsHovered,
        setActiveItem,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
