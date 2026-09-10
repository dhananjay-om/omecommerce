'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AutomationRule, AutomationTriggerType, AutomationActionType } from '@/lib/types';
import { createAutomationRule, updateAutomationRule, testWebhook, type RuleConditionInput, type RuleActionInput, type WebhookTestResult } from './actions';
import { TRIGGER_TYPES, fieldsForTrigger, isOrderTrigger, COMPARATORS_FOR_KIND, ACTION_TYPES, type FieldDef } from './trigger-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function emptyAction(type: AutomationActionType): RuleActionInput {
  return { type, config: {} };
}

/** One shared dialog for both surfaces (see the plan's "one engine, two
 *  framings" decision) — Rules caps conditions/actions at 1 each (a fast
 *  single-condition/single-action quick-create), Workflows allows up to
 *  the same real backend cap (10) either page's rules were ever going to
 *  hit. Field/comparator choices always mirror EvaluateAutomationRules'
 *  own real fields per trigger (trigger-fields.ts) — never offering a
 *  condition the engine can't actually evaluate. */
export function RuleFormDialog({
  surfaceLabel,
  maxConditions,
  maxActions,
  rule,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  surfaceLabel: string;
  maxConditions: number;
  maxActions: number;
  /** When provided, this is an edit dialog for an existing rule — no
   *  trigger button of its own, externally controlled (same pattern as
   *  DeleteCustomerDialog/CreateReturnDialog elsewhere in this app). */
  rule?: AutomationRule;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = rule !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(rule?.triggerType ?? 'ORDER_PLACED');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [conditions, setConditions] = useState<RuleConditionInput[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<RuleActionInput[]>(rule?.actions ?? [emptyAction('EMAIL')]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookTest, setWebhookTest] = useState<Record<number, { pending: boolean; result?: WebhookTestResult }>>({});

  const fields = fieldsForTrigger(triggerType);
  const availableActionTypes = ACTION_TYPES.filter((a) => !a.requiresOrder || isOrderTrigger(triggerType));

  function resetForNewTrigger(nextTrigger: AutomationTriggerType) {
    setTriggerType(nextTrigger);
    setConditions([]); // field choices differ per trigger — start clean rather than carry over a now-invalid field
    if (!isOrderTrigger(nextTrigger)) {
      setActions((prev) => prev.map((a) => (a.type === 'ORDER_NOTE' ? emptyAction('EMAIL') : a)));
    }
  }

  function addCondition() {
    const first = fields[0]!;
    setConditions((prev) => [...prev, { field: first.field, comparator: COMPARATORS_FOR_KIND[first.kind][0]!.value, value: '' }]);
  }
  function updateCondition(i: number, patch: Partial<RuleConditionInput>) {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addAction() {
    setActions((prev) => [...prev, emptyAction(availableActionTypes[0]!.value)]);
  }
  function updateActionType(i: number, type: AutomationActionType) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? emptyAction(type) : a)));
  }
  function updateActionConfig(i: number, key: string, value: string) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, config: { ...a.config, [key]: value } } : a)));
  }
  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  }

  /** Fires right now, through the exact same send path a real rule match
   *  uses (TestWebhook -> the shared postWebhook()) — works before the
   *  rule is ever saved, since this doesn't need a real entity or a
   *  saved rule row, just the URL currently typed in. */
  async function sendTestWebhook(i: number, url: string) {
    if (!url.trim()) {
      setWebhookTest((prev) => ({ ...prev, [i]: { pending: false, result: { ok: false, error: 'Enter a URL first.' } } }));
      return;
    }
    setWebhookTest((prev) => ({ ...prev, [i]: { pending: true } }));
    const result = await testWebhook(url.trim());
    setWebhookTest((prev) => ({ ...prev, [i]: { pending: false, result } }));
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (actions.length === 0) {
      setError('At least one action is required.');
      return;
    }
    setPending(true);
    const result = isEdit
      ? await updateAutomationRule(rule!.publicId, { name: name.trim(), description: description.trim() || null, conditions, actions, isActive })
      : await createAutomationRule({ name: name.trim(), description: description.trim() || undefined, triggerType, conditions, actions, isActive });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? <DialogTrigger render={<Button>New {surfaceLabel}</Button>} /> : null}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${surfaceLabel}` : `New ${surfaceLabel}`}
          </DialogTitle>
          <DialogDescription>WHEN the trigger fires, IF every condition matches, THEN each action runs.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name</Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flag high-value orders" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-description">Description (optional)</Label>
            <Textarea id="rule-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-trigger">WHEN</Label>
            <select
              id="rule-trigger"
              className={nativeSelectClass + ' w-full'}
              value={triggerType}
              disabled={isEdit}
              onChange={(e) => resetForNewTrigger(e.target.value as AutomationTriggerType)}
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {isEdit ? <p className="text-xs text-muted-foreground">The trigger can&apos;t be changed after creation — create a new {surfaceLabel.toLowerCase()} instead.</p> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>IF (all must match — leave empty to always match)</Label>
              {conditions.length < maxConditions ? (
                <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                  + Add condition
                </Button>
              ) : null}
            </div>
            {conditions.map((c, i) => {
              const fieldDef: FieldDef = fields.find((f) => f.field === c.field) ?? fields[0]!;
              return (
                <div key={i} className="flex items-center gap-2">
                  <select className={nativeSelectClass} value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value, comparator: COMPARATORS_FOR_KIND[fields.find((f) => f.field === e.target.value)!.kind][0]!.value })}>
                    {fields.map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select className={nativeSelectClass} value={c.comparator} onChange={(e) => updateCondition(i, { comparator: e.target.value })}>
                    {COMPARATORS_FOR_KIND[fieldDef.kind].map((cmp) => (
                      <option key={cmp.value} value={cmp.value}>
                        {cmp.label}
                      </option>
                    ))}
                  </select>
                  <Input className="flex-1" value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="value" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCondition(i)}>
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>THEN</Label>
              {actions.length < maxActions ? (
                <Button type="button" variant="outline" size="sm" onClick={addAction}>
                  + Add action
                </Button>
              ) : null}
            </div>
            {actions.map((a, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <select className={nativeSelectClass} value={a.type} onChange={(e) => updateActionType(i, e.target.value as AutomationActionType)}>
                    {availableActionTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {actions.length > 1 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAction(i)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                {a.type === 'EMAIL' ? (
                  <>
                    <Input placeholder="Recipient — an email address, or CUSTOMER to use the order's own email" value={a.config.recipient ?? ''} onChange={(e) => updateActionConfig(i, 'recipient', e.target.value)} />
                    <Input placeholder="Subject" value={a.config.subject ?? ''} onChange={(e) => updateActionConfig(i, 'subject', e.target.value)} />
                    <Textarea rows={2} placeholder="Body" value={a.config.body ?? ''} onChange={(e) => updateActionConfig(i, 'body', e.target.value)} />
                  </>
                ) : null}
                {a.type === 'WEBHOOK' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input className="flex-1" placeholder="https://…" value={a.config.url ?? ''} onChange={(e) => updateActionConfig(i, 'url', e.target.value)} />
                      <Button type="button" variant="outline" size="sm" disabled={webhookTest[i]?.pending} onClick={() => sendTestWebhook(i, a.config.url ?? '')}>
                        {webhookTest[i]?.pending ? 'Sending…' : 'Send Test'}
                      </Button>
                    </div>
                    {webhookTest[i]?.result ? (
                      <p className={`text-xs ${webhookTest[i]!.result!.ok ? 'text-success' : 'text-destructive'}`}>
                        {webhookTest[i]!.result!.ok
                          ? `✓ Reached it — responded ${webhookTest[i]!.result!.status}. A sample payload was sent, not a real event.`
                          : `✗ ${webhookTest[i]!.result!.error}`}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {a.type === 'ORDER_NOTE' ? <Textarea rows={2} placeholder="Note text (optional — a default is used if left blank)" value={a.config.note ?? ''} onChange={(e) => updateActionConfig(i, 'note', e.target.value)} /> : null}
                {a.type === 'NOTIFY_ADMINS' ? (
                  <>
                    <Input placeholder="Title (optional — a default is used if left blank)" value={a.config.title ?? ''} onChange={(e) => updateActionConfig(i, 'title', e.target.value)} />
                    <Textarea rows={2} placeholder="Message (optional — a default is used if left blank)" value={a.config.message ?? ''} onChange={(e) => updateActionConfig(i, 'message', e.target.value)} />
                    <p className="text-xs text-muted-foreground">Shows up in every admin&apos;s notification bell — see the topbar or System &gt; Notifications.</p>
                  </>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input id="rule-active" type="checkbox" className="size-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <Label htmlFor="rule-active" className="font-normal">
              Active
            </Label>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : isEdit ? 'Save Changes' : `Create ${surfaceLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
