"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "credentials" | "enroll" | "code";

export function LoginCard() {
  const t = useTranslations("login");
  const router = useRouter();
  const auth = useAuth();

  const [step, setStep] = React.useState<Step>("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [mfaToken, setMfaToken] = React.useState<string | null>(null);
  const [enrollment, setEnrollment] = React.useState<{
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (auth.status === "authenticated") router.replace("/");
  }, [auth.status, router]);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { mfaToken: token, needsEnrollment } = await auth.login(email, password);
      setMfaToken(token);
      if (needsEnrollment) {
        const setup = await auth.setupMfa(token);
        setEnrollment(setup);
        setStep("enroll");
      } else {
        setStep("code");
      }
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      await auth.verifyMfa(mfaToken, code);
      router.push("/");
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
          {step === "credentials" && (
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
          )}

          {step === "enroll" && enrollment && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold">{t("enrollTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("enrollBody")}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("manualKey")}</Label>
                <code className="bidi-isolate rounded-[--radius-field] border border-border bg-muted px-3 py-2 text-sm">
                  {enrollment.secret}
                </code>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("backupCodesTitle")}</Label>
                <p className="text-xs text-muted-foreground">{t("backupCodesBody")}</p>
                <div className="bidi-isolate grid grid-cols-2 gap-1.5 rounded-[--radius-field] border border-border bg-muted p-3 font-mono text-xs">
                  {enrollment.backupCodes.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
              <Button onClick={() => setStep("code")}>{t("continueToCode")}</Button>
            </div>
          )}

          {step === "code" && (
            <form className="flex flex-col gap-4" onSubmit={submitCode}>
              <div>
                <p className="text-sm font-semibold">{t("codeTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("codeSubtitle")}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">{t("codeLabel")}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  required
                  className="bidi-isolate text-center text-lg tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(enrollment ? "enroll" : "credentials")}
                >
                  {t("back")}
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {t("verify")}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
