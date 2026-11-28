import { create } from 'zustand';
import { AuthRepo } from '@/repositories/AuthRepo';
import type { User } from '@/types/database';
import type { LoginCredentials } from '@/types/auth';

interface AuthState {
  user: User | null;
  setup: boolean;
  isAuthenticated: boolean;
  checkAuth: () => Promise<void>;
  login: (credentials: LoginCredentials, replacement?: string) => Promise<boolean>;
  logout: () => Promise<void>;
}
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null, setup: false, isAuthenticated: false,
  async checkAuth() {
    localStorage.removeItem('user');
    const { setup, user } = await AuthRepo.status();
    set({ setup, user, isAuthenticated: Boolean(user) });
  },
  async login(credentials, replacement) {
    const user = get().setup ? await AuthRepo.createUser(credentials, true) : await AuthRepo.login(credentials, replacement);
    set({ user, setup: false, isAuthenticated: true });
    return true;
  },
  async logout() {
    await AuthRepo.logout();
    set({ user: null, isAuthenticated: false });
  },
}));
