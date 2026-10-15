"use client";

import Link from "next/link";
import { useState } from "react";
import { LayoutDashboard, School, Plus, Menu, X, Sparkles } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard#projects", label: "School projects", icon: School },
];

export function DashboardNavigation({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="pf-app-shell min-h-screen">
      <header className="pf-topbar sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="pf-icon-button hidden lg:inline-flex" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} onClick={() => setSidebarOpen(v => !v)}>
              <Menu size={19} />
            </button>
            <button type="button" className="pf-icon-button lg:hidden" aria-expanded={mobileOpen} aria-controls="mobile-navigation" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(v => !v)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <span className="pf-brand-mark"><Sparkles size={19} /></span>
              <span className="truncate text-[15px] font-extrabold tracking-tight sm:text-base">PrintForge <span className="pf-brand-accent">ID Studio</span></span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">Workspace</span>
            <SignOutButton />
          </div>
        </div>
        {mobileOpen && <nav id="mobile-navigation" aria-label="Main navigation" className="pf-mobile-menu lg:hidden">
          {navItems.map(item => <Link key={item.href} className="pf-nav-link" href={item.href} onClick={() => setMobileOpen(false)}><item.icon size={18} />{item.label}</Link>)}
          <Link className="pf-nav-link" href="/dashboard#new-project" onClick={() => setMobileOpen(false)}><Plus size={18} />New project</Link>
        </nav>}
      </header>

      <div className={"mx-auto flex max-w-[1600px] items-start " + (sidebarOpen ? "lg:gap-6" : "")}>
        {sidebarOpen && <aside className="hidden w-60 shrink-0 px-4 pt-6 lg:block" aria-label="Workspace sidebar">
          <nav className="pf-sidebar sticky top-24 space-y-2">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p>
            {navItems.map(item => <Link key={item.href} className="pf-nav-link" href={item.href}><item.icon size={18} />{item.label}</Link>)}
            <Link className="pf-nav-link pf-nav-primary" href="/dashboard#new-project"><Plus size={18} />Create project</Link>
            <div className="pf-sidebar-tip mt-7">
              <span className="pf-tip-icon"><Sparkles size={17} /></span>
              <p className="mt-3 text-sm font-bold text-slate-800">Your card studio</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">One simple workspace for templates, student data, photos and print-ready cards.</p>
            </div>
          </nav>
        </aside>}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-10 sm:pt-8">{children}</main>
      </div>

      <nav className="pf-bottom-nav lg:hidden" aria-label="Quick navigation">
        <Link href="/dashboard" className="pf-bottom-link"><LayoutDashboard size={20} /><span>Home</span></Link>
        <Link href="/dashboard#projects" className="pf-bottom-link"><School size={20} /><span>Projects</span></Link>
        <Link href="/dashboard#new-project" className="pf-bottom-link pf-bottom-create"><span className="pf-bottom-plus"><Plus size={19} /></span><span>New project</span></Link>
      </nav>
    </div>
  );
}
