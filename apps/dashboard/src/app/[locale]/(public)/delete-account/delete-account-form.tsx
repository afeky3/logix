"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeleteAccountContent } from "./content";

type Step = "phone" | "code" | "done";

/** Spaces and dashes go; a leading 0 is a trunk prefix, so it is dropped when the number has no +. The
 * dial code defaults to Saudi Arabia; any other country is typed with its +. */
function toPhone(input: string): string {
  const v = input.replace(/[\s\-()]/g, "");
  if (v.startsWith("+")) return v;
  if (v.startsWith("00")) return `+${v.slice(2)}`;
  return `+966${v.replace(/^0+/, "")}`;
}

export function DeleteAccountForm({ locale, c }: { locale: string; c: DeleteAccountContent }) {
  const [step, setStep] = React.useState<Step>("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const messageFor = (res: Response, body: { error?: { message?: string; code?: string } } | null) => {
    if (res.status === 429) return c.tooMany;
    // A refusal (e.g. work still in progress) comes with its own translated message.
    if (res.status === 409 && body?.error?.message) return body.error.message;
    if (res.status === 400 && body?.error?.code?.startsWith("OTP_")) return c.invalidCode;
    if (res.status === 400) return c.invalidPhone;
    if (body?.error?.code === "OTP_EXPIRED") return c.invalidCode;
    return c.failed;
  };

  async function post(path: string, payload: unknown) {
    const res = await fetch(`/api/public/account-deletion/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-localization": locale },
      body: JSON.stringify(payload),
    });
    return { res, body: await res.json().catch(() => null) };
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (phone.replace(/\D/g, "").length < 7) {
      setError(c.invalidPhone);
      return;
    }
    setBusy(true);
    try {
      const { res, body } = await post("otp", { phone: toPhone(phone) });
      if (!res.ok) {
        setError(messageFor(res, body));
        return;
      }
      setChallengeId(body.challengeId);
      setCode("");
      setStep("code");
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code) || !challengeId) {
      setError(c.invalidCode);
      return;
    }
    setBusy(true);
    try {
      const { res, body } = await post("confirm", { challengeId, code });
      if (!res.ok) {
        setError(messageFor(res, body));
        return;
      }
      setStep("done");
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div role="status" className="mt-4 rounded-md border border-(--success) bg-(--success-bg) p-4 text-(--success)">
        <p className="font-semibold">{c.doneTitle}</p>
        <p className="mt-1">{c.done}</p>
      </div>
    );
  }

  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={step === "phone" ? sendCode : confirm} noValidate>
      {step === "phone" ? (
        <div>
          <label htmlFor="da-phone" className="mb-1 block text-sm font-medium">
            {c.phoneLabel}
          </label>
          <Input
            id="da-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            placeholder={c.phoneHint}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{c.codeSent}</p>
          <div>
            <label htmlFor="da-code" className="mb-1 block text-sm font-medium">
              {c.codeLabel}
            </label>
            <Input
              id="da-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <p className="text-sm font-medium text-destructive">{c.confirmWarning}</p>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={step === "code" ? "destructive" : "default"} disabled={busy}>
          {busy ? c.working : step === "phone" ? c.sendCode : c.confirmDelete}
        </Button>
        {step === "code" && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
          >
            {c.back}
          </Button>
        )}
      </div>
    </form>
  );
}
