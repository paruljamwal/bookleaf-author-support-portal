import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@bookleaf/shared";
import axios from "axios";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { defineAbilityFor, type AppAbility } from "@bookleaf/shared";
import { api, loadCsrf } from "./api";

interface AuthState {
  user: AuthUser | null;
  ability: AppAbility | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      await loadCsrf();
      try {
        const response = await api.get<{ user: AuthUser | null }>("/auth/me");
        return response.data.user;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const value = useMemo<AuthState>(
    () => ({
      user: query.data ?? null,
      ability: query.data ? defineAbilityFor(query.data) : null,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: () => {
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      },
    }),
    [query.data, query.isLoading, query.isError, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
