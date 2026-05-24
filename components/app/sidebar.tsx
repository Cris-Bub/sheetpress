'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Users, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="inline-flex items-baseline gap-1">
          <span className="font-serif text-2xl leading-none tracking-tight">sheet</span>
          <span className="font-serif text-2xl leading-none tracking-tight italic text-muted-foreground">press</span>
        </Link>
      </div>

      <div className="px-3">
        <Button render={<Link href="/invoices/new" />} className="w-full justify-start gap-2 h-9 shadow-none">
          <Plus className="size-4" />
          New invoice
        </Button>
      </div>

      <nav className="mt-6 flex-1 px-2">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
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
      </nav>

      <div className="p-4 text-xs text-muted-foreground">
        <p>Your data lives on this device.</p>
        <Link href="/settings" className="underline-offset-4 hover:underline">
          Back up now →
        </Link>
      </div>
    </aside>
  );
}
