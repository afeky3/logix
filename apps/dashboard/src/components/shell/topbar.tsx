"use client";

import { Bell, LogOut, Search } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function Topbar() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === "ar" ? "en" : "ar";
  const { staff, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="LX-, PO-, CASE-…" className="ps-8" />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { locale: other })}
        >
          {other.toUpperCase()}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        {staff && (
          <div
            className="ms-1 flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium"
            title={staff.email}
          >
            {initials(staff.fullName)}
          </div>
        )}
        <Button variant="ghost" size="icon" aria-label="Log out" onClick={handleLogout}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
