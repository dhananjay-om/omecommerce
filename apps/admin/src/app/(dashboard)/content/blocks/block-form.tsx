'use client';

import { useActionState } from 'react';
import { createBlock, updateBlock, type ActionState } from './actions';
import type { CmsBlock } from '@/lib/types';
import { StickyFormActions } from '@/components/sticky-form-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BodyEditor } from '@/components/ui/body-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const initialState: ActionState = { error: null, success: false };

export function CmsBlockForm({ block }: { block?: CmsBlock }) {
  const isEdit = !!block;
  const action = isEdit ? updateBlock : createBlock;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {isEdit ? <input type="hidden" name="publicId" value={block.publicId} /> : null}

      <SectionCard title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cms-block-code">Code</Label>
            <Input id="cms-block-code" name="code" defaultValue={block?.code ?? ''} disabled={isEdit} required placeholder="footer-note" />
            <p className="text-xs text-muted-foreground">{isEdit ? 'Set at creation, not editable.' : 'How other content references this block.'}</p>
          </div>
          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="cms-block-status">Status</Label>
              <Select name="status" defaultValue={block.status}>
                <SelectTrigger id="cms-block-status" className="w-full">
                  <SelectValue>{(value: string) => (value === 'PUBLISHED' ? 'Published' : 'Draft')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Content">
        <BodyEditor id="cms-block-body" name="body" defaultValue={block?.body ?? ''} />
      </SectionCard>

      <StickyFormActions
        pending={pending}
        label={isEdit ? 'Save Block' : 'Create Block'}
        pendingLabel="Saving…"
        error={state.error}
        extra={state.success ? <p className="text-sm text-success">Saved.</p> : null}
      />
    </form>
  );
}
