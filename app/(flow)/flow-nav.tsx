'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [{ href: "/upload", label: "Upload" }];

export function FlowNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="flex w-full items-center justify-between px-4 py-4 sm:px-8 lg:px-16">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.4em] text-indigo-200">
          Lexsy
        </Link>
        <div className="flex items-center gap-2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "rounded-full px-4 py-2 text-sm font-medium transition " +
                  (isActive
                    ? "bg-white text-slate-900"
                    : "border border-white/20 text-white/80 hover:border-white/40 hover:text-white")
                }
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
