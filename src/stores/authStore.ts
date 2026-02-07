import { create } from 'zustand';
import { AuthRepo } from '@/repositories/AuthRepo';
import type { User } from '@/types/database';
import type { LoginCredentials } from '@/types/auth';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (credentials: LoginCredentials) => Promise<boolean>;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    isAuthenticated: !!localStorage.getItem('user'),
    isLoading: false,
    error: null,

    login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
            const user = await AuthRepo.login(credentials);
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                set({ user, isAuthenticated: true, isLoading: false });
                return true;
            } else {
                set({ error: 'Invalid credentials', isLoading: false });
                return false;
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Login failed',
                isLoading: false
            });
            return false;
        }
    },

    logout: () => {
        localStorage.removeItem('user');
        set({ user: null, isAuthenticated: false });
    },

    checkAuth: () => {
        const user = localStorage.getItem('user');
        if (user) {
            set({ user: JSON.parse(user), isAuthenticated: true });
        } else {
            set({ user: null, isAuthenticated: false });
        }
    }
}));
