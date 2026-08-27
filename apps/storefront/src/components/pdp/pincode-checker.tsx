'use client';

import { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon, TruckIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/axios';
import type { PincodeCheckResult } from '@/types/pincode';

/** Per-viewer convenience only, not synced to any account — same posture as
 *  this app's other localStorage-only state (sidebar-collapse etc.). */
const STORAGE_KEY = 'ome_last_pincode';

export function PincodeChecker() {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PincodeCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private window, blocked site data) — skip the convenience.
    }
    if (saved) void check(saved);
  }, []);

  async function check(value: string) {
    setCode(value);
    if (!/^\d{6}$/.test(value)) {
      setError('Enter a valid 6-digit pincode.');
      setResult(null);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const { data } = await api.get<PincodeCheckResult>(`/pincodes/${value}`);
      setResult(data);
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // fine if it can't persist — this is a convenience, not a requirement.
      }
    } catch {
      setError('Could not check that pincode right now. Please try again.');
      setResult(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-ghost p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-jet">
        <TruckIcon className="size-4 text-champagne" />
        Check Delivery
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && check(code)}
          placeholder="Enter pincode"
          className="max-w-[160px]"
          maxLength={6}
          inputMode="numeric"
        />
        <Button variant="outline" size="sm" disabled={pending} onClick={() => check(code)}>
          {pending ? 'Checking…' : 'Check'}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {result ? (
        result.serviceable ? (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-charcoal">
            <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-green-600" />
            <span>
              Delivering to {result.city}, {result.state} in ~{result.estimatedDays} day{result.estimatedDays === 1 ? '' : 's'}.{' '}
              {result.codAvailable ? 'Cash on Delivery available.' : 'Cash on Delivery not available.'}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-charcoal">
            <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>Sorry, we don&apos;t currently deliver to this pincode.</span>
          </div>
        )
      ) : null}
    </div>
  );
}
