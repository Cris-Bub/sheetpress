'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, FileText, Users, Settings, Plus, Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AccountFooter({ userEmail, onNavigate }: { userEmail: string; onNavigate?: () => void }) {
  return (
    <div className="p-4 border-t border-sidebar-border space-y-2">
      <p className="text-xs text-muted-foreground truncate" title={userEmail}>
        {userEmail || 'Signed in'}
      </p>
      <form action="/auth/sign-out" method="post" onSubmit={onNavigate}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </form>
    </div>
  );
}

function SidebarContent({
  pathname,
  userEmail,
  onNavigate,
}: {
  pathname: string;
  userEmail: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-5 pt-6 pb-4">
        <Link href="/" onClick={onNavigate} className="inline-flex items-baseline gap-1">
          <span className="font-serif text-2xl leading-none tracking-tight">sheet</span>
          <span className="font-serif text-2xl leading-none tracking-tight italic text-muted-foreground">press</span>
        </Link>
      </div>

      <div className="px-3">
        <Button
          render={<Link href="/invoices/new" onClick={onNavigate} />}
          className="w-full justify-start gap-2 h-9 shadow-none"
        >
          <Plus className="size-4" />
          New invoice
        </Button>
      </div>

      <nav className="mt-6 flex-1 px-2">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <AccountFooter userEmail={userEmail} onNavigate={onNavigate} />
    </>
  );
}

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between h-12 px-3 border-b border-border bg-background/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="size-9 inline-flex items-center justify-center rounded-md hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="inline-flex items-baseline gap-1">
          <span className="font-serif text-xl leading-none tracking-tight">sheet</span>
          <span className="font-serif text-xl leading-none tracking-tight italic text-muted-foreground">press</span>
        </Link>
        <Button render={<Link href="/invoices/new" />} size="sm" className="h-8 px-2.5">
          <Plus className="size-3.5" />
        </Button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in-0"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[260px] max-w-[80vw] flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-2.5 right-2.5 size-8 inline-flex items-center justify-center rounded-md hover:bg-sidebar-accent"
            >
              <X className="size-4" />
            </button>
            <SidebarContent pathname={pathname} userEmail={userEmail} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <SidebarContent pathname={pathname} userEmail={userEmail} />
      </aside>
    </>
  );
}
