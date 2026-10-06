"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginCard() {
  const t = useTranslations("login");
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (auth.status === "authenticated") router.replace("/");
  }, [auth.status, router]);

  // Password only for now (MFA is switched off); a success flips the auth
  // status and the effect above takes the user to the dashboard.
  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.login(email, password);
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-[--radius] border border-border bg-card shadow-sm">
        {/* Navy hero header, same treatment as the app's A01 welcome screen
            (logic-app/lib/features/onboarding/ui/widgets/welcome_hero.dart). */}
        <div className="flex flex-col items-center gap-3 bg-[--navy] px-6 py-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
          <img src="/logo-full.svg" alt="Logix" className="h-8 w-auto" />
          <div>
            <p className="text-base font-semibold text-white">{t("title")}</p>
            <p className="mt-1 text-sm text-white/60">{t("subtitle")}</p>
          </div>
        </div>

        <div className="p-6">
          <form className="flex flex-col gap-4" onSubmit={submitCredentials}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="mt-2" disabled={loading}>
              {t("submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
