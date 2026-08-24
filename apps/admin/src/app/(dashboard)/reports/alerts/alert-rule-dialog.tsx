'use client';

import { useActionState, useState } from 'react';
import { createAlertRule, updateAlertRule, type ActionState } from './actions';
import type { AlertRuleView, AlertMetricCode, AlertComparator } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

const METRIC_LABELS: Record<AlertMetricCode, string> = {
  REVENUE_DROP: 'Revenue drop',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  PAYMENT_FAILURE_RATE: 'Payment failure rate',
  RETURN_RATE: 'Return rate',
  ORDER_STUCK: 'Order stuck',
};

const COMPARATOR_LABELS: Record<AlertComparator, string> = {
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal',
  lte: 'less than or equal',
};

const initialState: ActionState = { error: null, success: false };

/**
 * Single form for both creating and editing an alert rule — same shape as
 * content/widgets/widget-form.tsx's create/edit split, just packaged as a
 * dialog instead of a full page. metricCode is immutable after creation
 * (mirrors Widget's "type" field), so it's only ever submitted on create.
 */
export function AlertRuleDialog({ rule }: { rule?: AlertRuleView }) {
  const isEdit = !!rule;
  const action = isEdit ? updateAlertRule : createAlertRule;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);
  const [metricCode, setMetricCode] = useState<AlertMetricCode>(rule?.metricCode ?? 'REVENUE_DROP');

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const idSuffix = rule?.publicId ?? 'new';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? 'outline' : 'default'} size="sm">
            {isEdit ? 'Edit' : 'New Rule'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Alert Rule — ${METRIC_LABELS[rule.metricCode]}` : 'New Alert Rule'}</DialogTitle>
          <DialogDescription>
            Evaluated automatically by the nightly analytics refresh — there is nothing to trigger manually.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {isEdit ? <input type="hidden" name="publicId" value={rule.publicId} /> : null}

          <div className="space-y-2">
            <Label htmlFor={`ar-metric-${idSuffix}`}>Metric</Label>
            {isEdit ? (
              <Input id={`ar-metric-${idSuffix}`} value={METRIC_LABELS[rule.metricCode]} disabled />
            ) : (
              <>
                <input type="hidden" name="metricCode" value={metricCode} />
                <Select value={metricCode} onValueChange={(v) => setMetricCode((v as AlertMetricCode) ?? 'REVENUE_DROP')}>
                  <SelectTrigger id={`ar-metric-${idSuffix}`} className="w-full">
                    <SelectValue>{(value: AlertMetricCode) => METRIC_LABELS[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(METRIC_LABELS) as AlertMetricCode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {METRIC_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <p className="text-xs text-muted-foreground">{isEdit ? 'Set at creation, not editable.' : 'Which metric this rule watches.'}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`ar-comparator-${idSuffix}`}>Comparator</Label>
              <Select name="comparator" defaultValue={rule?.comparator ?? 'gt'}>
                <SelectTrigger id={`ar-comparator-${idSuffix}`} className="w-full">
                  <SelectValue>{(value: AlertComparator) => COMPARATOR_LABELS[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COMPARATOR_LABELS) as AlertComparator[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {COMPARATOR_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ar-threshold-${idSuffix}`}>Threshold</Label>
              <Input id={`ar-threshold-${idSuffix}`} name="thresholdValue" required defaultValue={rule?.thresholdValue ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ar-window-${idSuffix}`}>Window (days)</Label>
            <Input id={`ar-window-${idSuffix}`} name="windowDays" type="number" min="1" step="1" defaultValue={rule?.windowDays ?? 1} />
            <p className="text-xs text-muted-foreground">How many days of data the metric is evaluated over.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ar-emails-${idSuffix}`}>Recipient emails</Label>
            <Textarea
              id={`ar-emails-${idSuffix}`}
              name="recipientEmails"
              rows={3}
              placeholder={'ops@example.com, alerts@example.com'}
              defaultValue={rule?.recipientEmails.join('\n') ?? ''}
            />
            <p className="text-xs text-muted-foreground">Comma- or newline-separated.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`ar-active-${idSuffix}`}
              name="isActive"
              type="checkbox"
              defaultChecked={rule?.isActive ?? true}
              className="size-4 rounded border-input"
            />
            <Label htmlFor={`ar-active-${idSuffix}`}>Active</Label>
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
