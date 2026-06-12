import { createContext, useContext } from 'react';

export interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const LayoutContext = createContext<LayoutContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
});

export const useLayout = () => useContext(LayoutContext);
