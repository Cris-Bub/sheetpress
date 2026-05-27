'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createPublicLinkAction,
  listPublicLinksAction,
  revokePublicLinkAction,
} from '@/lib/server/actions/public-invoices';
import { formatDate } from '@/lib/format';

const EXPIRY_PRESETS = [
  { value: 'never', label: 'Never expires' },
  { value: '7', label: 'Expires in 7 days' },
  { value: '30', label: 'Expires in 30 days' },
  { value: '90', label: 'Expires in 90 days' },
];

function publicUrl(token: string): string {
  if (typeof window === 'undefined') return `/pay/${token}`;
  return `${window.location.origin}/pay/${token}`;
}

export function ShareLinkDialog({
  invoiceId,
  open,
  onOpenChange,
}: {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryKey = ['public-links', invoiceId];
  const queryClient = useQueryClient();
  const [expiry, setExpiry] = useState('never');
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: links, isPending } = useQuery({
    queryKey,
    queryFn: () => listPublicLinksAction(invoiceId),
    enabled: open,
  });

  useEffect(() => {
    if (!copiedToken) return;
    const t = setTimeout(() => setCopiedToken(null), 1500);
    return () => clearTimeout(t);
  }, [copiedToken]);

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(token));
      setCopiedToken(token);
    } catch {
      toast.error('Could not copy. Long-press the link to copy manually.');
    }
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const expiresInDays =
        expiry === 'never' ? undefined : Number(expiry);
      const link = await createPublicLinkAction(invoiceId, expiresInDays);
      await queryClient.invalidateQueries({ queryKey });
      await copy(link.token);
      toast.success('Link copied.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create link');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (linkId: string) => {
    try {
      await revokePublicLinkAction(linkId);
      await queryClient.invalidateQueries({ queryKey });
      toast.success('Link revoked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke');
    }
  };

  const activeLinks = (links ?? []).filter((l) => !l.revokedAt);
  const revokedLinks = (links ?? []).filter((l) => l.revokedAt);

  const hasActive = activeLinks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this invoice</DialogTitle>
          <DialogDescription>
            Anyone with the link can view the invoice and the amount due. They can&apos;t
            edit anything. Revoke a link any time.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <label className="text-xs font-normal text-muted-foreground">Expiration</label>
              <Select value={expiry} onValueChange={(v) => setExpiry(v ?? 'never')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={create}
              disabled={creating}
              variant={hasActive ? 'outline' : 'default'}
              className="shrink-0"
            >
              <Link2 className="size-4" />
              {creating ? 'Creating…' : hasActive ? 'New link' : 'Create link'}
            </Button>
          </div>

          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activeLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active links. Create one to share this invoice.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeLinks.map((link) => {
                const isCopied = copiedToken === link.token;
                return (
                  <li
                    key={link.id}
                    className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1"
                  >
                    <div className="flex items-center gap-1">
                      <code
                        className="flex-1 min-w-0 text-xs font-mono truncate"
                        title={publicUrl(link.token)}
                      >
                        {publicUrl(link.token)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 shrink-0"
                        onClick={() => copy(link.token)}
                        title="Copy link"
                      >
                        {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => revoke(link.id)}
                        title="Revoke"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {link.expiresAt
                        ? `Expires ${formatDate(link.expiresAt.slice(0, 10))}`
                        : 'Never expires'}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {revokedLinks.length > 0 ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">
                {revokedLinks.length} revoked link{revokedLinks.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 space-y-1">
                {revokedLinks.map((link) => (
                  <li key={link.id} className="font-mono truncate" title={publicUrl(link.token)}>
                    {publicUrl(link.token)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
