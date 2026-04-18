import { createContext, useContext } from "react";

export type AppStateUser = {
  id: string;
  name: string;
  role: string;
} | null;

export type AppStateTenant = {
  id: string;
  name: string;
} | null;

export type AppStateContextValue = {
  currentUser: AppStateUser;
  currentTenant: AppStateTenant;
  leads: Array<{ id: string }>;
  invoices: Array<{ id: string }>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  value,
  children,
}: {
  value: AppStateContextValue;
  children: React.ReactNode;
}) {
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return ctx;
}
