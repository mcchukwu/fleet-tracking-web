import { create } from "zustand";
import type { User } from "../api/types";

export type AuthStatus = "unknown" | "authenticated" | "anonymous" | "expired";

export interface AuthState {
  user: User | null;
  csrfToken: string | null;
  status: AuthStatus;
  /** True only after the server confirmed the session with `/me` or login. */
  sessionVerified: boolean;
  setSession: (user: User, csrfToken: string) => void;
  setOfflineProfile: (user: User) => void;
  clear: () => void;
  expire: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  csrfToken: null,
  status: "unknown",
  sessionVerified: false,
  setSession: (user, csrfToken) =>
    set({ user, csrfToken, status: "authenticated", sessionVerified: true }),
  setOfflineProfile: (user) =>
    set({ user, csrfToken: null, status: "authenticated", sessionVerified: false }),
  clear: () =>
    set({ user: null, csrfToken: null, status: "anonymous", sessionVerified: false }),
  expire: () => set({ status: "expired", csrfToken: null, sessionVerified: false }),
}));
