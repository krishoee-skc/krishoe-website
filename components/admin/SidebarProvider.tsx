"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type SidebarContextType = {
  isCollapsed: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

/**
 * Wraps the admin shell and owns whether the sidebar is collapsed. It also
 * renders the layout grid itself, because the grid's first column has to track
 * the sidebar's width: expanded it is 240px, collapsed it is the 80px (w-20)
 * rail. When the grid column stayed a fixed 240px, collapsing the sidebar left a
 * ~160px empty strip beside the narrowed rail instead of handing that width to
 * the page. Driving the column from the same state fixes that — the page grows
 * to fill the freed space the moment the rail collapses.
 *
 * The grid lives here (a client component) rather than in the async layout so it
 * can read the collapse state; `children` is still the server-rendered page.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      <div
        className={`grid min-h-screen w-full print:block ${
          isCollapsed ? "lg:grid-cols-[80px_1fr]" : "lg:grid-cols-[240px_1fr]"
        }`}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
