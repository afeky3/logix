"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginCard() {
  const t = useTranslations("login");

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
          {/* TODO(S1): POST /api/auth/login route handler → backend /admin/auth/login,
              then /mfa step. No client-side auth wired yet — backend admin auth
              endpoints don't exist until S1. */}
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" className="mt-2">
              {t("submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
