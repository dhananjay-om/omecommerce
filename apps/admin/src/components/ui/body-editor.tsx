'use client';

import { useState } from 'react';
import { Button } from './button';
import { Label } from './label';
import { Textarea } from './textarea';
import { RichTextEditor } from './rich-text-editor';

/**
 * Visual/HTML toggle for an HTML body field — "Visual" is the Tiptap
 * WYSIWYG editor (default), "HTML" is a raw textarea for admins who want
 * to hand-edit markup directly. Mirrors Magento's own "Show/Hide Editor"
 * toggle, just inverted default (WYSIWYG-first). Both modes read/write the
 * same underlying HTML string, so switching back and forth never loses
 * content — shared by Content > Pages and Content > Blocks.
 */
export function BodyEditor({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [body, setBody] = useState(defaultValue);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Body</Label>
        <div className="flex gap-1">
          <Button type="button" size="xs" variant={mode === 'visual' ? 'secondary' : 'ghost'} onClick={() => setMode('visual')}>
            Visual
          </Button>
          <Button type="button" size="xs" variant={mode === 'html' ? 'secondary' : 'ghost'} onClick={() => setMode('html')}>
            HTML
          </Button>
        </div>
      </div>
      <input type="hidden" name={name} value={body} />
      {mode === 'visual' ? (
        <RichTextEditor id={id} content={body} onChange={setBody} />
      ) : (
        <Textarea
          id={id}
          rows={16}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-xs"
          placeholder="<h2>Heading</h2>&#10;<p>Body copy…</p>"
        />
      )}
    </div>
  );
}
