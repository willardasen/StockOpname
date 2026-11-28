import { invoke } from '@tauri-apps/api/core';
import type { User } from '@/types/database';
import type { LoginCredentials, CreateUserInput } from '@/types/auth';
import { readData } from './db';

export const AuthRepo = {
  status: () => invoke<{ setup: boolean; user: User | null }>('auth_status'),
  login: (credentials: LoginCredentials, newPassword?: string) =>
    invoke<User>('login', { ...credentials, newPassword }),
  logout: () => invoke<void>('logout'),
  createUser: (input: CreateUserInput, first = false) =>
    invoke<User>('create_account', { ...input, first }),
  getAllUsers: () => readData<User>('users'),
  async getUserById(id: number) { return (await this.getAllUsers()).find(user => user.id === id) ?? null; },
  async usernameExists(name: string) { return (await this.getAllUsers()).some(user => user.username === name); },
  deleteUser: (id: number) => invoke<boolean>('delete_account', { id }),
};
