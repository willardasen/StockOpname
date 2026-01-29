import { invoke } from "@tauri-apps/api/core";
import { getDb } from "./db";
import type { User, UserWithPassword } from "../types/database";
import type { LoginCredentials, CreateUserInput } from "@/types/auth";

export const AuthRepo = {
    /**
     * Login with username and password
     * Password verification happens in Rust backend for security
     */
    async login(credentials: LoginCredentials): Promise<User | null> {
        const db = await getDb();

        // Get user with password hash
        const users = await db.select<UserWithPassword[]>(
            "SELECT * FROM users WHERE username = ?",
            [credentials.username]
        );

        if (users.length === 0) {
            return null;
        }

        const user = users[0];

        // Verify password using Rust backend (bcrypt)
        const isValid = await invoke<boolean>('verify_password', {
            password: credentials.password,
            hash: user.password
        });

        if (!isValid) {
            return null;
        }

        // Return user without password
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    },

    /**
     * Create new user (Admin only)
     * Password is hashed in Rust backend
     */
    async createUser(input: CreateUserInput): Promise<User> {
        const db = await getDb();

        // Hash password using Rust backend
        const hashedPassword = await invoke<string>('hash_password', {
            password: input.password
        });

        // Insert user
        const result = await db.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            [input.username, hashedPassword, input.role]
        );

        // Return created user
        const users = await db.select<User[]>(
            "SELECT id, username, role, created_at FROM users WHERE id = ?",
            [result.lastInsertId]
        );

        return users[0];
    },

    /**
     * Get user by ID
     */
    async getUserById(id: number): Promise<User | null> {
        const db = await getDb();

        const users = await db.select<User[]>(
            "SELECT id, username, role, created_at FROM users WHERE id = ?",
            [id]
        );

        return users.length > 0 ? users[0] : null;
    },

    /**
     * Get all users (Admin only)
     */
    async getAllUsers(): Promise<User[]> {
        const db = await getDb();

        return db.select<User[]>(
            "SELECT id, username, role, created_at FROM users ORDER BY created_at DESC"
        );
    },

    /**
     * Check if username already exists
     */
    async usernameExists(username: string): Promise<boolean> {
        const db = await getDb();

        const result = await db.select<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM users WHERE username = ?",
            [username]
        );

        return result[0].count > 0;
    },

    /**
     * Delete user (Admin only, cannot delete self)
     */
    async deleteUser(id: number): Promise<boolean> {
        const db = await getDb();

        const result = await db.execute(
            "DELETE FROM users WHERE id = ?",
            [id]
        );

        return result.rowsAffected > 0;
    }
};
