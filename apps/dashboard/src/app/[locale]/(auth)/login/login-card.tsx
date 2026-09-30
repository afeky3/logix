"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function LoginCard() {
  const t = useTranslations("login");

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            L
          </div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
