'use client';

import { useActionState, useState } from 'react';
import { createCompany, updateCompany, type ActionState } from './actions';
import type { Company, Website } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialState: ActionState = { error: null, success: false };

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

/** A full page, not a dialog — same "dedicated page" pattern coupon-form.tsx
 *  and products/new use, not a one-off. Shared by both /companies/new and
 *  /companies/[id]/edit — `company` present means edit mode. */
export function CompanyForm({ company, websites }: { company?: Company; websites: Website[] }) {
  const isEdit = !!company;
  const action = isEdit ? updateCompany : createCompany;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [taxExempt, setTaxExempt] = useState(company?.taxExempt ?? false);

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      {isEdit ? <input type="hidden" name="publicId" value={company.publicId} /> : null}

      <SectionCard title="Company">
        <div className="space-y-2">
          <Label htmlFor="cmp-websiteCode">Website</Label>
          {isEdit ? (
            <p className="flex h-9 items-center text-sm font-medium">
              {company.websiteCode} <span className="ml-2 text-xs font-normal text-muted-foreground">(can&apos;t be changed)</span>
            </p>
          ) : (
            <Select name="websiteCode" defaultValue={websites[0]?.code}>
              <SelectTrigger id="cmp-websiteCode" className="w-full">
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
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmp-code">Code</Label>
          {isEdit ? (
            <p className="flex h-9 items-center text-sm font-medium">
              {company.code} <span className="ml-2 text-xs font-normal text-muted-foreground">(can&apos;t be changed)</span>
            </p>
          ) : (
            <Input id="cmp-code" name="code" required placeholder="e.g. ACME-CORP" />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmp-name">Name</Label>
          <Input id="cmp-name" name="name" required defaultValue={company?.name} placeholder="e.g. Acme Corporation" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmp-customerGroupCode">Customer group code</Label>
          <Input
            id="cmp-customerGroupCode"
            name="customerGroupCode"
            defaultValue={company?.customerGroupCode ?? ''}
            placeholder="Optional — e.g. WHOLESALE"
          />
          <p className="text-xs text-muted-foreground">Controls which price list this company&apos;s buyers see.</p>
        </div>
      </SectionCard>

      <SectionCard title="Tax">
        <div className="space-y-2">
          <Label htmlFor="cmp-taxExempt">Tax exempt</Label>
          <Select name="taxExempt" value={taxExempt ? 'true' : 'false'} onValueChange={(v) => setTaxExempt(v === 'true')}>
            <SelectTrigger id="cmp-taxExempt" className="w-full">
              <SelectValue>{(value: string) => (value === 'true' ? 'Yes — exempt from tax' : 'No')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes — exempt from tax</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmp-taxExemptionRef">Tax exemption reference</Label>
          <Input
            id="cmp-taxExemptionRef"
            name="taxExemptionRef"
            required={taxExempt}
            disabled={!taxExempt}
            defaultValue={company?.taxExemptionRef ?? ''}
            placeholder={taxExempt ? 'e.g. exemption certificate number' : 'Only available when tax exempt'}
          />
          <p className="text-xs text-muted-foreground">Required whenever tax exempt is Yes.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmp-gstin">GSTIN</Label>
          <Input id="cmp-gstin" name="gstin" maxLength={15} defaultValue={company?.gstin ?? ''} placeholder="e.g. 27AAAAA0000A1Z5" />
        </div>
      </SectionCard>

      <SectionCard title="Billing Contact (optional)">
        <div className="space-y-2">
          <Label htmlFor="cmp-billingContactName">Name</Label>
          <Input id="cmp-billingContactName" name="billingContactName" defaultValue={company?.billingContactName ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmp-billingContactEmail">Email</Label>
          <Input
            id="cmp-billingContactEmail"
            name="billingContactEmail"
            type="email"
            defaultValue={company?.billingContactEmail ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmp-billingContactPhone">Phone</Label>
          <Input id="cmp-billingContactPhone" name="billingContactPhone" defaultValue={company?.billingContactPhone ?? ''} />
        </div>
      </SectionCard>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Company'}
      </Button>
    </form>
  );
}
