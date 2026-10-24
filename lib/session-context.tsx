"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface ClientSessionUser {
  username: string;
  name: string;
  position: string;
  role: "admin" | "staff";
  permission?: string;
}

const Ctx = createContext<ClientSessionUser | null>(null);

export function SessionProvider({ user, children }: { user: ClientSessionUser | null; children: ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useSessionUser() {
  return useContext(Ctx);
}
