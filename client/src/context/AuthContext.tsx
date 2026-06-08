import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/endpoints";
import type { PasswordResetChallengeResponse, RegistrationChallengeResponse } from "../api/endpoints";
import { setAuthToken } from "../api/http";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; matricNumber?: string; department?: string }) => Promise<RegistrationChallengeResponse>;
  verifyRegistration: (challengeId: string, code: string) => Promise<User>;
  forgotPassword: (email: string) => Promise<PasswordResetChallengeResponse>;
  resetPassword: (data: { challengeId: string; code: string; newPassword: string }) => Promise<string>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<string>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const tokenKey = "examsentinel.token";
const userKey = "examsentinel.user";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(userKey);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthToken(token);
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((response) => {
        setUser(response.data.user);
        localStorage.setItem(userKey, JSON.stringify(response.data.user));
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const persist = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(tokenKey, nextToken);
    localStorage.setItem(userKey, JSON.stringify(nextUser));
    setAuthToken(nextToken);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login: async (email, password) => {
        const response = await authApi.login(email, password);
        persist(response.data.token, response.data.user);
        return response.data.user;
      },
      register: async (data) => {
        const response = await authApi.register(data);
        return response.data;
      },
      verifyRegistration: async (challengeId, code) => {
        const response = await authApi.verifyRegistration(challengeId, code);
        persist(response.data.token, response.data.user);
        return response.data.user;
      },
      forgotPassword: async (email) => {
        const response = await authApi.forgotPassword(email);
        return response.data;
      },
      resetPassword: async (data) => {
        const response = await authApi.resetPassword(data);
        return response.data.message;
      },
      changePassword: async (data) => {
        const response = await authApi.changePassword(data);
        return response.data.message;
      },
      logout: () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        setAuthToken(null);
      },
      refresh: async () => {
        const response = await authApi.me();
        setUser(response.data.user);
        localStorage.setItem(userKey, JSON.stringify(response.data.user));
      }
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
