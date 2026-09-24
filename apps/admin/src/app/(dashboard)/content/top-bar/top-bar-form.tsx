'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { saveTopBar, resetTopBar } from './actions';
import type { TopBarLink, TopBarSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MAX_LINKS = 6;

function Check({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 rounded border-input accent-primary" />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function TopBarForm({ websiteCode, initial }: { websiteCode: string; initial: TopBarSettings }) {
  const [isEnabled, setIsEnabled] = useState(initial.isEnabled);
  const [showStoreSwitcher, setShowStoreSwitcher] = useState(initial.showStoreSwitcher);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [message, setMessage] = useState(initial.message ?? '');
  const [links, setLinks] = useState<TopBarLink[]>(initial.links);
  const [customized, setCustomized] = useState(initial.isCustomized);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const id = (s: string) => `topbar-${websiteCode}-${s}`;

  function updateLink(i: number, patch: Partial<TopBarLink>) {
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function moveLink(i: number, dir: -1 | 1) {
    setLinks((ls) => {
      const j = i + dir;
      if (j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveTopBar(websiteCode, { isEnabled, showStoreSwitcher, phone: phone.trim() || null, message: message.trim() || null, links });
      if (result.error) setFeedback({ kind: 'error', text: result.error });
      else {
        setCustomized(true);
        setFeedback({ kind: 'ok', text: 'Saved — the storefront top bar is updated.' });
      }
    });
  }

  function reset() {
    if (!window.confirm('Reset this store’s top bar to the original defaults? Your custom text and links will be lost.')) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await resetTopBar(websiteCode);
      if (result.error || !result.settings) {
        setFeedback({ kind: 'error', text: result.error ?? 'Could not reset.' });
        return;
      }
      const s = result.settings;
      setIsEnabled(s.isEnabled);
      setShowStoreSwitcher(s.showStoreSwitcher);
      setPhone(s.phone ?? '');
      setMessage(s.message ?? '');
      setLinks(s.links);
      setCustomized(false);
      setFeedback({ kind: 'ok', text: 'Reset to the defaults.' });
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      {!customized ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Showing the built-in defaults. Edit anything below and save to make it yours.
        </p>
      ) : null}

      <Check id={id('enabled')} checked={isEnabled} onChange={setIsEnabled} label="Show the top bar" hint="Untick to hide the whole strip on this store." />

      <div className={isEnabled ? 'space-y-5' : 'pointer-events-none space-y-5 opacity-50'}>
        <Check id={id('switcher')} checked={showStoreSwitcher} onChange={setShowStoreSwitcher} label="Show the store switcher" hint="The “Shipping to …” dropdown on the left (lets visitors switch between your stores)." />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={id('phone')}>Phone number</Label>
            <Input id={id('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder="e.g. +91 98765 43210" />
            <p className="text-xs text-muted-foreground">Tapping it calls on phones. Leave blank to hide.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={id('message')}>Promo / shipping message</Label>
            <Input id={id('message')} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} placeholder="e.g. Free shipping on orders over ₹999" />
            <p className="text-xs text-muted-foreground">Shown on larger screens. Leave blank to hide.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Links on the right</Label>
          <div className="space-y-2">
            {links.length === 0 ? <p className="text-xs text-muted-foreground">No links — nothing shows on the right.</p> : null}
            {links.map((link, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input value={link.label} onChange={(e) => updateLink(i, { label: e.target.value })} maxLength={40} placeholder="Label, e.g. Track Order" aria-label={`Link ${i + 1} label`} className="w-44" />
                <Input value={link.href} onChange={(e) => updateLink(i, { href: e.target.value })} placeholder="/orders/track or https://…" aria-label={`Link ${i + 1} address`} className="min-w-52 flex-1" />
                <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => moveLink(i, -1)} aria-label="Move up">
                  <ArrowUp className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === links.length - 1} onClick={() => moveLink(i, 1)} aria-label="Move down">
                  <ArrowDown className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))} aria-label="Remove link">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" disabled={links.length >= MAX_LINKS} onClick={() => setLinks((ls) => [...ls, { label: '', href: '' }])}>
            <Plus className="size-4" /> Add link
          </Button>
          <p className="text-xs text-muted-foreground">
            Use <code>/orders/track</code> style addresses for pages on your store, or a full <code>https://…</code>, <code>mailto:</code> or <code>tel:</code> address. Up to {MAX_LINKS} links.
          </p>
        </div>
      </div>

      {feedback ? <p className={feedback.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-success'}>{feedback.text}</p> : null}
      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {customized ? (
          <Button type="button" variant="outline" onClick={reset} disabled={pending}>
            Reset to defaults
          </Button>
        ) : null}
      </div>
    </div>
  );
}
