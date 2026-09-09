'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AutomationRule, AutomationRuleRun } from '@/lib/types';
import { setAutomationRuleActive, deleteAutomationRule, fetchAutomationRuleRuns } from './actions';
import { TRIGGER_TYPES } from './trigger-fields';
import { DotBadge } from '@/components/dot-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { relativeDate } from '@/lib/relative-date';
import { RuleFormDialog } from './rule-form-dialog';

function triggerLabel(triggerType: string): string {
  return TRIGGER_TYPES.find((t) => t.value === triggerType)?.label ?? triggerType;
}

function RunHistory({ publicId }: { publicId: string }) {
  const [runs, setRuns] = useState<AutomationRuleRun[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (runs === null) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setRuns(await fetchAutomationRuleRuns(publicId));
          setLoading(false);
        }}
      >
        {loading ? 'Loading…' : 'View recent runs'}
      </Button>
    );
  }

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs recorded yet — this fires the next time its trigger event happens.</p>;
  }

  return (
    <div className="space-y-1.5">
      {runs.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <DotBadge variant={r.matched ? 'success' : 'secondary'}>{r.matched ? 'Matched' : 'No match'}</DotBadge>
          <span className="text-muted-foreground">{relativeDate(r.triggeredAt)}</span>
          {r.entityPublicId ? <span className="text-xs text-muted-foreground">({r.entityType})</span> : null}
          {r.actionResults.filter((a) => !a.ok).length > 0 ? (
            <span className="text-xs text-destructive">{r.actionResults.filter((a) => !a.ok).length} action(s) failed</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function RulesTable({ rules, surfaceLabel, maxConditions, maxActions }: { rules: AutomationRule[]; surfaceLabel: string; maxConditions: number; maxActions: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<AutomationRule | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(publicId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }

  function toggleActive(rule: AutomationRule) {
    startTransition(async () => {
      await setAutomationRuleActive(rule.publicId, !rule.isActive);
      router.refresh();
    });
  }

  function remove(publicId: string) {
    startTransition(async () => {
      await deleteAutomationRule(publicId);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Conditions</TableHead>
            <TableHead>Actions</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-64" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No {surfaceLabel.toLowerCase()}s yet.
              </TableCell>
            </TableRow>
          ) : (
            rules.map((rule) => (
              <Fragment key={rule.publicId}>
                <TableRow>
                  <TableCell>
                    <div className="font-medium text-foreground">{rule.name}</div>
                    {rule.description ? <div className="text-xs text-muted-foreground">{rule.description}</div> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{triggerLabel(rule.triggerType)}</TableCell>
                  <TableCell>{rule.conditions.length === 0 ? 'always' : rule.conditions.length}</TableCell>
                  <TableCell>{rule.actions.length}</TableCell>
                  <TableCell>
                    <DotBadge variant={rule.isActive ? 'success' : 'secondary'}>{rule.isActive ? 'Active' : 'Inactive'}</DotBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleExpanded(rule.publicId)}>
                        Runs
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditTarget(rule)}>
                        Edit
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => toggleActive(rule)}>
                        {rule.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={isPending} onClick={() => remove(rule.publicId)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expanded.has(rule.publicId) ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-muted/30">
                      <RunHistory publicId={rule.publicId} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>

      {/* Keyed by the target's publicId (or a fixed key while closed) so
          React remounts this instance — and re-initializes all of its
          internal useState — whenever a different row's Edit is clicked,
          rather than reusing one stale instance across rows the way a
          plain re-render never would (this dialog's fields are fully
          controlled, unlike EditTrackingDialog's uncontrolled
          defaultValue inputs, which don't have this problem). */}
      <RuleFormDialog
        key={editTarget?.publicId ?? 'closed'}
        surfaceLabel={surfaceLabel}
        maxConditions={maxConditions}
        maxActions={maxActions}
        rule={editTarget ?? undefined}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />
    </div>
  );
}
