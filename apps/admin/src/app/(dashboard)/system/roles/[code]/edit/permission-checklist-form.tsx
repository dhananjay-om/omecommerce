'use client';

import { useActionState } from 'react';
import { updateRolePermissions, type ActionState } from '../../actions';
import type { Permission } from '@/lib/types';
import { StickyFormActions } from '@/components/sticky-form-actions';

const initialState: ActionState = { error: null, success: false };

/** One checkbox per registered permission, grouped by the category
 *  prefix before ":" (orders:*, catalog:*, ...) — 29 permissions across
 *  ~10 categories reads far better as a grouped checklist than one flat
 *  list, without needing a real category field anywhere in the schema. */
function groupByCategory(permissions: Permission[]): Array<{ category: string; items: Permission[] }> {
  const groups = new Map<string, Permission[]>();
  for (const p of permissions) {
    const category = p.code.split(':')[0] ?? p.code;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(p);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => ({ category, items }));
}

export function PermissionChecklistForm({ code, permissions, grantedCodes }: { code: string; permissions: Permission[]; grantedCodes: string[] }) {
  // No manual router.refresh() needed — updateRolePermissions' own
  // revalidatePath() calls (server-side) are picked up automatically by
  // the framework once this Server Action resolves.
  const [state, formAction, pending] = useActionState(updateRolePermissions, initialState);
  const granted = new Set(grantedCodes);
  const groups = groupByCategory(permissions);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <input type="hidden" name="code" value={code} />
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.category} className="rounded-md border p-4">
            <div className="mb-2 text-sm font-semibold capitalize">{g.category}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.items.map((p) => (
                <label key={p.code} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="permissionCodes" value={p.code} defaultChecked={granted.has(p.code)} className="mt-0.5 size-4" />
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                    <br />
                    {p.description}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <StickyFormActions pending={pending} label="Save Permissions" pendingLabel="Saving…" error={state.error} />
    </form>
  );
}
