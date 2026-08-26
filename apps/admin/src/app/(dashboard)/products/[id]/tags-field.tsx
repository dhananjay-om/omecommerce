'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * A controlled tag-chip editor — type + Enter/comma to add, click the x (or
 * Backspace on an empty draft) to remove. Renders one hidden `name="tags"`
 * input per chip so the surrounding native `<form>` submits the current
 * full set exactly as-is (products/actions.ts's updateProduct reads it back
 * via `formData.getAll('tags')`) — no extra plumbing needed for Save
 * Changes to pick this up.
 */
export function TagsField({ tags, onTagsChange }: { tags: string[]; onTagsChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function addTag(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (!tags.includes(value)) onTagsChange([...tags, value]);
    setDraft('');
  }

  function removeTag(value: string) {
    onTagsChange(tags.filter((t) => t !== value));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]!);
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex">
          <input type="hidden" name="tags" value={t} />
          <Badge variant="secondary" className="gap-1 pr-1">
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="rounded-full p-0.5 hover:bg-foreground/10"
              aria-label={`Remove tag ${t}`}
            >
              <X className="size-2.5" />
            </button>
          </Badge>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : 'Add another…'}
        className="min-w-28 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
