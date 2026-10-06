"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  ShieldCheck,
  Building2,
  ClipboardList,
  Truck,
  Store,
  Wallet,
  Gavel,
  Settings,
  Users,
} from "lucide-react";

const NAV = [
  { href: "/", key: "home", icon: Home },
  { href: "/verification", key: "verification", icon: ShieldCheck },
  { href: "/organizations", key: "organizations", icon: Building2 },
  { href: "/requests", key: "requests", icon: ClipboardList },
  { href: "/orders", key: "orders", icon: Truck },
  { href: "/accounts", key: "accounts", icon: Users },
  { href: "/marketplace", key: "marketplace", icon: Store },
  { href: "/finance", key: "finance", icon: Wallet },
  { href: "/cases", key: "cases", icon: Gavel },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-e border-border bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center border-b border-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
        <img src="/logo-badge.svg" alt="Logix" width={82} height={28} />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-[--radius-button] px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
