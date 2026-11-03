import { create } from "zustand";
import type { User } from "../api/types";

export type AuthStatus = "unknown" | "authenticated" | "anonymous" | "expired";

export interface AuthState {
  user: User | null;
  csrfToken: string | null;
  status: AuthStatus;
  setSession: (user: User, csrfToken: string) => void;
  clear: () => void;
  expire: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  csrfToken: null,
  status: "unknown",
  setSession: (user, csrfToken) => set({ user, csrfToken, status: "authenticated" }),
  clear: () => set({ user: null, csrfToken: null, status: "anonymous" }),
  expire: () => set({ status: "expired" }),
}));
