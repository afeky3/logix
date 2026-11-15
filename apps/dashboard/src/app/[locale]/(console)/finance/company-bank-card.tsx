"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CompanyBank {
  bankName?: string;
  bankNameEn?: string;
  accountHolderName?: string;
  accountHolderNameEn?: string;
  accountNumber?: string;
  iban?: string;
  isPlaceholder: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

const FIELDS = [
  "bankName",
  "bankNameEn",
  "accountHolderName",
  "accountHolderNameEn",
  "accountNumber",
  "iban",
] as const;
type Field = (typeof FIELDS)[number];
type Form = Record<Field, string> & { reason: string };

const LTR_FIELDS: Field[] = ["bankNameEn", "accountHolderNameEn", "accountNumber", "iban"];

function toForm(b: CompanyBank | null): Form {
  const f = { reason: "" } as Form;
  for (const k of FIELDS) f[k] = b?.isPlaceholder ? "" : (b?.[k] ?? "");
  return f;
}

/** The account customers transfer to: shown to them in the app at once, so changing it asks for a reason and a confirmation. */
export function CompanyBankCard() {
  const t = useTranslations("finance.bank");
  const { accessToken, staff } = useAuth();
  const canEdit = (staff?.permissions ?? []).some((p) => p === "*" || p === "finance.bank_account.write");

  const [bank, setBank] = React.useState<CompanyBank | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<Form>(() => toForm(null));
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<Field | "reason", string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const fetchBank = React.useCallback(async (): Promise<CompanyBank | null> => {
    const res = await fetch("/api/admin/settlements/company-bank-account", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok ? ((await res.json()) as CompanyBank) : null;
  }, [accessToken]);

  React.useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchBank()
      .then((b) => {
        if (cancelled) return;
        setBank(b);
        setLoadError(b === null);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [accessToken, fetchBank]);

  function startEditing() {
    setForm(toForm(bank));
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
    setEditing(true);
  }

  async function save() {
    setFieldErrors({});
    setFormError(null);
    if (form.reason.trim().length < 3) {
      setFieldErrors({ reason: t("reasonRequired") });
      return;
    }
    if (!window.confirm(t("confirm"))) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settlements/company-bank-account", {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errors: Partial<Record<Field | "reason", string>> = {};
        for (const d of (data?.error?.details ?? []) as { field: string }[]) {
          errors[d.field as Field | "reason"] = d.field === "iban" ? t("ibanInvalid") : t("fieldInvalid");
        }
        setFieldErrors(errors);
        if (Object.keys(errors).length === 0) setFormError(data?.error?.message ?? t("saveFailed"));
        return;
      }
      setBank(data as CompanyBank);
      setEditing(false);
      setNotice(t("saved"));
    } catch {
      setFormError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const set = (k: Field | "reason") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="rounded-lg border bg-card p-4 text-sm" aria-labelledby="bank-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="bank-title" className="font-medium">
            {t("title")}
          </h2>
          <p className="mt-1 text-muted-foreground">{t("hint")}</p>
        </div>
        {canEdit && !editing && bank && (
          <Button size="sm" variant="outline" onClick={startEditing}>
            {t("edit")}
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-3 rounded-md border border-(--success) bg-(--success-bg) px-3 py-2 text-(--success)">
          {notice}
        </p>
      )}
      {loadError && <p className="mt-3 text-destructive">{t("loadFailed")}</p>}

      {bank?.isPlaceholder && (
        <p className="mt-3 rounded-md border border-(--warning) px-3 py-2 text-(--warning)">{t("placeholderNotice")}</p>
      )}

      {bank && !editing && !bank.isPlaceholder && (
        <>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            {FIELDS.map((k) => (
              <div key={k}>
                <dt className="text-muted-foreground">{t(`fields.${k}`)}</dt>
                <dd className={LTR_FIELDS.includes(k) ? "bidi-isolate font-mono" : ""}>{bank[k] || t("notSet")}</dd>
              </div>
            ))}
          </dl>
          {bank.updatedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("lastUpdated", {
                at: `${new Date(bank.updatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC`,
                name: bank.updatedByName ?? "—",
              })}
            </p>
          )}
        </>
      )}

      {editing && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {FIELDS.map((k) => (
              <div key={k}>
                <label htmlFor={`bank-${k}`} className="mb-1 block text-xs text-muted-foreground">
                  {t(`fields.${k}`)}
                </label>
                <Input
                  id={`bank-${k}`}
                  value={form[k]}
                  onChange={set(k)}
                  dir={LTR_FIELDS.includes(k) ? "ltr" : undefined}
                  className={LTR_FIELDS.includes(k) ? "font-mono" : undefined}
                  aria-invalid={fieldErrors[k] ? true : undefined}
                />
                {fieldErrors[k] && <p className="mt-1 text-xs text-destructive">{fieldErrors[k]}</p>}
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="bank-reason" className="mb-1 block text-xs text-muted-foreground">
              {t("reason")}
            </label>
            <Input id="bank-reason" value={form.reason} onChange={set("reason")} aria-invalid={fieldErrors.reason ? true : undefined} />
            {fieldErrors.reason && <p className="mt-1 text-xs text-destructive">{fieldErrors.reason}</p>}
          </div>
          {formError && <p className="text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
