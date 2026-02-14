import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import {
    getStudentProfile,
    getUserProfile,
    logoutStudent as logoutStudentApi,
    logoutUser as logoutUserApi
} from "../services/api";

type Role = "student" | "user" | null;

interface AuthContextType {
    user: any | null;
    role: Role;
    isLoading: boolean;
    login: (roleType: Role, userData: any, accessToken: string, refreshToken: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

const clearStoredAuth = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("role");
    await SecureStore.deleteItemAsync("user");
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        void bootstrapAuth();
    }, []);

    const bootstrapAuth = async () => {
        try {
            const token = await SecureStore.getItemAsync("token");
            const refreshToken = await SecureStore.getItemAsync("refreshToken");
            const savedRole = await SecureStore.getItemAsync("role");

            if ((!token && !refreshToken) || !savedRole) {
                return;
            }

            const normalizedRole = savedRole as Role;
            if (normalizedRole !== "student" && normalizedRole !== "user") {
                await clearStoredAuth();
                return;
            }

            const response =
                normalizedRole === "student"
                    ? await getStudentProfile()
                    : await getUserProfile();

            const profile = response?.data?.data;
            if (!response?.data?.success || !profile) {
                await clearStoredAuth();
                return;
            }

            setRole(normalizedRole);
            setUser(profile);
            await SecureStore.setItemAsync("user", JSON.stringify(profile));
        } catch (error) {
            await clearStoredAuth();
            setRole(null);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (roleType: Role, userData: any, accessToken: string, refreshToken: string) => {
        if (!roleType || !accessToken || !refreshToken) {
            throw new Error("Invalid login payload");
        }

        setRole(roleType);
        setUser(userData);

        await SecureStore.setItemAsync("token", accessToken);
        await SecureStore.setItemAsync("refreshToken", refreshToken);
        await SecureStore.setItemAsync("role", roleType);
        await SecureStore.setItemAsync("user", JSON.stringify(userData));

        if (roleType === "student") {
            router.replace("/(student)/dashboard" as any);
        } else {
            router.replace("/(user)/dashboard" as any);
        }
    };

    const logout = async () => {
        try {
            if (role === "student") {
                await logoutStudentApi();
            } else if (role === "user") {
                await logoutUserApi();
            }
        } catch (error) {
            // Best effort API logout; local cleanup still required.
        } finally {
            await clearStoredAuth();
            setUser(null);
            setRole(null);
            router.replace("/(auth)/login" as any);
        }
    };

    return (
        <AuthContext.Provider value={{ user, role, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
