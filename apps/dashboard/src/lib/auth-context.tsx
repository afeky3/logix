"use client";

import * as React from "react";

export interface Staff {
  id: string;
  email: string;
  fullName: string;
}

type Status = "loading" | "authenticated" | "unauthenticated";

interface MfaSetupResult {
  otpauthUrl: string;
  secret: string;
  backupCodes: string[];
}

interface AuthContextValue {
  status: Status;
  staff: Staff | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  setupMfa: (mfaToken: string) => Promise<MfaSetupResult>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function postJson<T>(url: string, body: unknown, accessToken?: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Request failed");
  }
  return data as T;
}

/** Access token lives in memory only (React state) — never localStorage,
 * per planning/web_dashboard/md/02-architecture.md §2 and §8. A page reload
 * loses it; the silent refresh below restores it from the HttpOnly cookie. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [staff, setStaff] = React.useState<Staff | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken: token } = await postJson<{ accessToken: string }>(
          "/api/auth/refresh",
          {},
        );
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("me failed");
        const me = (await res.json()) as Staff;
        if (cancelled) return;
        setAccessToken(token);
        setStaff(me);
        setStatus("authenticated");
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await postJson<{ accessToken: string; staff: Staff }>("/api/auth/login", {
      email,
      password,
    });
    setAccessToken(result.accessToken);
    setStaff(result.staff);
    setStatus("authenticated");
  }, []);

  const setupMfa = React.useCallback(
    (mfaToken: string) => postJson<MfaSetupResult>("/api/auth/mfa-setup", { mfaToken }),
    [],
  );

  const verifyMfa = React.useCallback(async (mfaToken: string, code: string) => {
    const result = await postJson<{ accessToken: string; staff: Staff }>("/api/auth/mfa-verify", {
      mfaToken,
      code,
    });
    setAccessToken(result.accessToken);
    setStaff(result.staff);
    setStatus("authenticated");
  }, []);

  const logout = React.useCallback(async () => {
    await postJson("/api/auth/logout", {}, accessToken ?? undefined).catch(() => undefined);
    setAccessToken(null);
    setStaff(null);
    setStatus("unauthenticated");
  }, [accessToken]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, staff, accessToken, login, setupMfa, verifyMfa, logout }),
    [status, staff, accessToken, login, setupMfa, verifyMfa, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
