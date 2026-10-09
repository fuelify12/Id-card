"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function DashboardNavigation({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return <>
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#070b12]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="pf-button-secondary hidden lg:inline-flex" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"} onClick={() => setSidebarOpen(v => !v)}>{sidebarOpen ? "Hide menu" : "Show menu"}</button>
          <button type="button" className="pf-button-secondary lg:hidden" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(v => !v)}>{mobileOpen ? "Close menu" : "Menu"}</button>
          <Link href="/dashboard" className="truncate font-bold tracking-wide">PRINTFORGE <span className="text-blue-300">ID STUDIO</span></Link>
        </div>
        <div className="shrink-0"><SignOutButton /></div>
      </div>
      {mobileOpen && <nav id="mobile-navigation" aria-label="Main navigation" className="border-t border-slate-800 p-3 lg:hidden">
        <Link className="pf-nav-link" href="/dashboard" onClick={() => setMobileOpen(false)}>Projects home</Link>
      </nav>}
    </header>
    <div className={"mx-auto flex max-w-[1600px] items-start " + (sidebarOpen ? "lg:gap-5" : "")}>
      {sidebarOpen && <aside className="hidden w-56 shrink-0 px-3 pt-6 lg:block" aria-label="Workspace sidebar">
        <nav className="sticky top-24 space-y-1">
          <Link className="pf-nav-link" href="/dashboard">Projects home</Link>
          <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Production workflow</p>
          <p className="px-3 py-2 text-xs text-slate-400">Open a project to access template, data, photos, validation and exports.</p>
        </nav>
      </aside>}
      <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-7">{children}</main>
    </div>
  </>;
}
