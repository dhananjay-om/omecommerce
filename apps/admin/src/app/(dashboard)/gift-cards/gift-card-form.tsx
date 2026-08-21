'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { issueGiftCard, type IssueGiftCardState } from './actions';
import type { Website, GiftCardKind } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StickyFormActions } from '@/components/sticky-form-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KIND_LABELS: Record<GiftCardKind, string> = { DIGITAL: 'Digital', PHYSICAL: 'Physical' };

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">{children}</CardContent>
    </Card>
  );
}

function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

const initialState: IssueGiftCardState = { error: null, success: false, issued: null };

export function GiftCardForm({ websites }: { websites: Website[] }) {
  const [state, formAction, pending] = useActionState(issueGiftCard, initialState);

  // See actions.ts's IssueGiftCardState doc comment for why this replaces the
  // usual redirect-on-create: the raw code is shown here exactly once.
  if (state.issued) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="rounded-md border border-warning bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Copy this code now — it cannot be shown again.</p>
          <p className="mt-1 text-muted-foreground">
            Only a hash of the code is stored. The gift card itself (balance, status, ledger) stays fully
            manageable from its detail page either way — this is the one and only chance to see the
            redeemable code itself.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={state.issued.code} className="font-mono text-lg" onFocus={(e) => e.target.select()} />
          <CopyCodeButton text={state.issued.code} />
        </div>
        <Link href={`/gift-cards/${state.issued.publicId}`} className={buttonVariants({ variant: 'outline' })}>
          View Gift Card
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <SectionCard title="Amount & Website">
        <div className="space-y-2">
          <Label htmlFor="gc-websiteCode">Website</Label>
          <Select name="websiteCode" defaultValue={websites[0]?.code}>
            <SelectTrigger id="gc-websiteCode" className="w-full">
              <SelectValue>{(value: string) => websites.find((w) => w.code === value)?.name ?? 'Select a website'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {websites.map((w) => (
                <SelectItem key={w.code} value={w.code}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gc-amount">Amount</Label>
          <Input id="gc-amount" name="amount" required placeholder="e.g. 50.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gc-kind">Kind</Label>
          <Select name="kind" defaultValue="DIGITAL">
            <SelectTrigger id="gc-kind" className="w-full">
              <SelectValue>{(value: GiftCardKind) => KIND_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABELS) as GiftCardKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <SectionCard title="Recipient (optional)">
        <div className="space-y-2">
          <Label htmlFor="gc-recipientEmail">Email</Label>
          <Input id="gc-recipientEmail" name="recipientEmail" type="email" placeholder="friend@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gc-recipientName">Name</Label>
          <Input id="gc-recipientName" name="recipientName" placeholder="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gc-message">Message</Label>
          <Textarea id="gc-message" name="message" rows={3} placeholder="Optional gift message" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gc-expiresAt">Expires</Label>
          <Input id="gc-expiresAt" name="expiresAt" type="date" />
          <p className="text-xs text-muted-foreground">Leave blank for no expiry.</p>
        </div>
      </SectionCard>

      <StickyFormActions pending={pending} label="Issue Gift Card" pendingLabel="Issuing…" error={state.error} />
    </form>
  );
}
