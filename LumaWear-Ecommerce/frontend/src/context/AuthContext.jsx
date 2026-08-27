import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/env";

const AuthContext = createContext(null);
const TOKEN_KEY = "lumawear-auth-token";

async function readResponse(response) {
  return response.json().catch(() => ({}));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };
  const completeAuth = ({ accessToken, token: legacyToken, user: account }) => {
    const nextToken = accessToken || legacyToken;
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(account);
    return account;
  };
  const fetchJson = async (path, options = {}, requestToken = token) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}), ...options.headers },
    });
    const data = await readResponse(response);
    return { response, data };
  };
  const refreshSession = async () => {
    const { response, data } = await fetchJson("/auth/refresh", { method: "POST" }, undefined);
    if (!response.ok) throw new Error(data.message || "Your session expired. Please sign in again.");
    return completeAuth(data);
  };
  const request = async (path, options = {}, requestToken = token, allowRefresh = true) => {
    const { response, data } = await fetchJson(path, options, requestToken);
    if (response.ok) return data;
    if (response.status === 401 && allowRefresh && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/register") {
      try {
        const nextToken = await refreshSession();
        const retried = await fetchJson(path, options, localStorage.getItem(TOKEN_KEY) || nextToken);
        if (retried.response.ok) return retried.data;
        throw new Error(retried.data.message || "Something went wrong. Please try again.");
      } catch (error) {
        clearAuth();
        throw new Error(error.message || "Your session expired. Please sign in again.");
      }
    }
    throw new Error(data.message || "Something went wrong. Please try again.");
  };
  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    request("/auth/me", {}, token)
      .then(({ user: account }) => {
        if (active) setUser(account);
      })
      .catch(() => {
        if (active) clearAuth();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const signIn = async (credentials) => completeAuth(await request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }, undefined, false));
  const signUp = async (details) => completeAuth(await request("/auth/register", { method: "POST", body: JSON.stringify(details) }, undefined, false));
  const signOut = async () => {
    try {
      await request("/auth/logout", { method: "POST" }, token, false);
    } catch {
      // Clear local state even if the server session is already gone.
    }
    clearAuth();
  };
  const api = (path, options) => request(path, options, token);
  const logActivity = async (activity) => {
    if (!token || !user) return null;
    try {
      return await request("/activity", { method: "POST", body: JSON.stringify(activity) }, token, true);
    } catch {
      return null;
    }
  };

  const value = {
    user,
    token,
    loading,
    signIn,
    signUp,
    signOut,
    api,
    logActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
