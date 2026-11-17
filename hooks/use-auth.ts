import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { createTRPCClient } from "@/lib/trpc";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const staffClient = useMemo(() => createTRPCClient(), []);

  const fetchUser = useCallback(async () => {
    console.log("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      const sessionToken = await Auth.getSessionToken();
      const cachedUser = await Auth.getUserInfo();
      if (sessionToken) {
        try {
          const apiUser = await staffClient.auth.me.query() as unknown as Record<string, unknown> | null;
          if (apiUser) {
            const userInfo: Auth.User = {
              id: Number(apiUser.id),
              openId: typeof apiUser.openId === "string" ? apiUser.openId : null,
              name: typeof apiUser.name === "string" ? apiUser.name : null,
              email: typeof apiUser.email === "string" ? apiUser.email : null,
              loginMethod: typeof apiUser.loginMethod === "string" ? apiUser.loginMethod : null,
              lastSignedIn: new Date(String(apiUser.lastSignedIn ?? Date.now())),
              phone: typeof apiUser.phone === "string" ? apiUser.phone : null,
              role: typeof apiUser.role === "string" ? apiUser.role : undefined,
              branchCode: typeof apiUser.branchCode === "string" ? apiUser.branchCode : null,
              branchId: Number.isInteger(Number(apiUser.branchId)) ? Number(apiUser.branchId) : null,
              mustChangePassword: Boolean(apiUser.mustChangePassword),
              points: Number(apiUser.points ?? 0),
            };
            setUser(userInfo);
            await Auth.setUserInfo(userInfo);
            return;
          }
        } catch {
          // Allow a previously authenticated user to see cached account info while offline.
        }
      }
      if (!sessionToken && Platform.OS === "web") {
        await Auth.clearUserInfo();
      }
      setUser(sessionToken ? cachedUser : null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error");
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[useAuth] fetchUser completed, loading:", false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      console.error("[Auth] Logout API call failed");
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[useAuth] useEffect triggered");
    if (autoFetch) {
      if (Platform.OS === "web") {
        // Web: fetch user from API directly (user will login manually if needed)
        console.log("[useAuth] Web: fetching user from API...");
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          if (cachedUser) {
            console.log("[useAuth] Native: setting cached user immediately");
            setUser(cachedUser);
            setLoading(false);
          } else {
            // No cached user, check session token
            fetchUser();
          }
        });
      }
    } else {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
