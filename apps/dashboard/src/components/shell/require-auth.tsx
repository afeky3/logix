"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

/** Redirects to /login once the silent refresh resolves to "unauthenticated". */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return null;
  return <>{children}</>;
}
