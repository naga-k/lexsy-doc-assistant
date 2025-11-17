'use client';

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/upload", label: "Upload", step: "01" },
  { href: "/fill", label: "Fill", step: "02" },
  { href: "/preview", label: "Preview", step: "03" },
];

export function FlowNav() {
  const pathname = usePathname();

  const renderLinks = (extraClasses?: string) => (
    <div className={clsx("flex flex-wrap items-center gap-2", extraClasses)}>
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              isActive
                ? "border-white bg-white text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.35)]"
                : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/60">
              {link.step}
            </span>
            {link.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <nav className="border-b border-white/10 bg-slate-950/80 shadow-[0_20px_60px_rgba(2,6,23,0.65)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-4 md:px-6">
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-sm font-semibold tracking-[0.3em] text-white">
            LX
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Lexsy Document Studio</p>
            <p className="text-xs text-slate-300">Upload · Fill · Preview & export</p>
          </div>
        </Link>
        <div className="hidden flex-1 justify-center md:flex">{renderLinks()}</div>
        <div className="ml-auto hidden items-center gap-3 text-xs text-slate-300 md:flex">
          <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-emerald-100">
            Live sync on
          </span>
          <a
            href="https://lexsy.ai"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
          >
            View product
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 pb-4 md:hidden">{renderLinks("mt-4")}</div>
    </nav>
  );
}
