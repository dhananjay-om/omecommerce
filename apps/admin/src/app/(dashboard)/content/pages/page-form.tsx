'use client';

import { useActionState, useState } from 'react';
import { createPage, updatePage, type ActionState } from './actions';
import { slugifyHandle } from './slugify';
import type { CmsPage } from '@/lib/types';
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

export function CmsPageForm({ page }: { page?: CmsPage }) {
  const isEdit = !!page;
  const action = isEdit ? updatePage : createPage;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handle, setHandle] = useState(page?.handle ?? '');
  const [handleTouched, setHandleTouched] = useState(isEdit);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {isEdit ? <input type="hidden" name="publicId" value={page.publicId} /> : null}

      <SectionCard title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cms-page-title">Title</Label>
            <Input
              id="cms-page-title"
              name="title"
              defaultValue={page?.title ?? ''}
              required
              onChange={(e) => {
                if (!handleTouched) setHandle(slugifyHandle(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cms-page-handle">Handle</Label>
            <Input
              id="cms-page-handle"
              name="handle"
              value={handle}
              disabled={isEdit}
              onChange={(e) => {
                setHandleTouched(true);
                setHandle(slugifyHandle(e.target.value));
              }}
              required
            />
            <p className="text-xs text-muted-foreground">
              {isEdit ? 'Set at creation, not editable.' : 'Auto-filled from the title — edit before saving if you want something else.'} Renders at{' '}
              <span className="font-mono">/pages/{handle || ':handle'}</span>.
            </p>
          </div>
          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="cms-page-status">Status</Label>
              <Select name="status" defaultValue={page.status}>
                <SelectTrigger id="cms-page-status" className="w-full">
                  <SelectValue>{(value: string) => (value === 'PUBLISHED' ? 'Published' : 'Draft')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
              {page.publishedAt ? (
                <p className="text-xs text-muted-foreground">Last published {new Date(page.publishedAt).toLocaleString()}.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Content">
        <BodyEditor id="cms-page-body" name="body" defaultValue={page?.body ?? ''} />
      </SectionCard>

      <StickyFormActions
        pending={pending}
        label={isEdit ? 'Save Page' : 'Create Page'}
        pendingLabel="Saving…"
        error={state.error}
        extra={state.success ? <p className="text-sm text-success">Saved.</p> : null}
      />
    </form>
  );
}
