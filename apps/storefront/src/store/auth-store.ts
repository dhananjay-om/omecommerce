import { create } from 'zustand';
import { getSessionInfo, login as loginRequest, logout as logoutRequest } from '@/services/customer.service';

interface AuthState {
  isLoggedIn: boolean;
  firstName: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/** Never holds the raw token — just the display-safe bits the header needs, hydrated from GET /api/session. */
export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  firstName: null,
  hydrated: false,
  hydrate: async () => {
    const info = await getSessionInfo();
    set({ isLoggedIn: info.isLoggedIn, firstName: info.firstName ?? null, hydrated: true });
  },
  login: async (email, password) => {
    await loginRequest(email, password);
    const info = await getSessionInfo();
    set({ isLoggedIn: info.isLoggedIn, firstName: info.firstName ?? null });
  },
  logout: async () => {
    await logoutRequest();
    set({ isLoggedIn: false, firstName: null });
  },
}));
