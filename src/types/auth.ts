import { UserRole } from "./database";

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface CreateUserInput {
    username: string;
    password: string;
    role: UserRole;
}
