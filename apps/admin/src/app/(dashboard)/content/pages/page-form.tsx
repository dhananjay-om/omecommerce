'use client';

import { useActionState, useState } from 'react';
import { createPage, updatePage, type ActionState } from './actions';
import { slugifyHandle } from './slugify';
import type { CmsPage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

/** Edit/Preview toggle for the raw-HTML body — no rich-text editor dependency
 *  (see the Content Management plan's confirmed v1 scope), just a sandboxed
 *  render of the same HTML the storefront will eventually dangerouslySetInnerHTML. */
function BodyEditor({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [body, setBody] = useState(defaultValue);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Body (HTML)</Label>
        <div className="flex gap-1">
          <Button type="button" size="xs" variant={mode === 'edit' ? 'secondary' : 'ghost'} onClick={() => setMode('edit')}>
            Edit
          </Button>
          <Button type="button" size="xs" variant={mode === 'preview' ? 'secondary' : 'ghost'} onClick={() => setMode('preview')}>
            Preview
          </Button>
        </div>
      </div>
      {mode === 'edit' ? (
        <Textarea
          id={id}
          name={name}
          rows={16}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-xs"
          placeholder="<h2>Heading</h2>&#10;<p>Body copy…</p>"
          required
        />
      ) : (
        <>
          {/* Hidden so the value still submits with the form while Preview is showing. */}
          <input type="hidden" name={name} value={body} />
          <div
            className="min-h-16 rounded-lg border bg-muted/20 p-4 [&_a]:text-primary [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_p]:my-2"
            // admin-authored content only — same trust boundary as the storefront's eventual render of this same body
            dangerouslySetInnerHTML={{ __html: body || '<p class="text-muted-foreground">Nothing to preview yet.</p>' }}
          />
        </>
      )}
    </div>
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

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : isEdit ? 'Save Page' : 'Create Page'}
      </Button>
    </form>
  );
}
