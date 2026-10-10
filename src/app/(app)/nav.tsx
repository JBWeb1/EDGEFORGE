"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trades", label: "Journal" },
  { href: "/import", label: "Import" },
  { href: "/accounts", label: "Accounts" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-electric/15 text-white ring-1 ring-electric/40" : "text-navy-300 hover:bg-navy-800 hover:text-white",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
