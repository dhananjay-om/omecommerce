'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  ImageIcon,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Button } from './button';
import { requestCmsImageUpload } from '@/app/actions/cms-image-upload';

/** Adds a `data-media-key` attribute to the default Image extension — the
 *  raw S3 key an inserted image was uploaded to, distinct from `src` (a
 *  short-lived local/presigned preview). See the backend's
 *  resolve-inline-images.ts: the saved body only needs this key; a fresh
 *  `src` is re-presigned server-side on every read so the image never
 *  goes stale. Without declaring it here, Tiptap would silently drop any
 *  attribute it doesn't know about when serializing to HTML. */
const ImageWithMediaKey = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-media-key': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-media-key'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['data-media-key'] ? { 'data-media-key': attributes['data-media-key'] } : {},
      },
    };
  },
});

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-xs"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** WYSIWYG body editor (Tiptap) — Bold/Italic/Headings/Lists/Blockquote/
 *  Link/Image/Undo/Redo, output as HTML via `onChange`. Used inside
 *  ui/body-editor.tsx's Visual/HTML toggle, not directly by page forms. */
export function RichTextEditor({ id, content, onChange }: { id?: string; content: string; onChange: (html: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, TiptapLink.configure({ openOnClick: false }), ImageWithMediaKey],
    content,
    immediatelyRender: false, // avoids an SSR/hydration mismatch — Tiptap only renders once mounted client-side
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        // No @tailwindcss/typography plugin in this app — same hand-rolled
        // element-selector overrides already used for the old raw-HTML
        // preview and the storefront's /pages/:handle route, not `prose`
        // (which would silently no-op without that plugin installed).
        class:
          'min-h-48 rounded-b-lg border border-t-0 p-3 text-sm focus:outline-none ' +
          '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-lg [&_h3]:font-bold ' +
          '[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
          '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground ' +
          '[&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md',
      },
    },
  });

  async function handleInsertImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;

    setUploading(true);
    try {
      const presign = await requestCmsImageUpload(file.name, file.type);
      if (presign.error || !presign.uploadUrl || !presign.imageMediaKey) return;
      const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) return;
      // Instant local preview for this editing session (same pattern as
      // every other image-upload field in this app) — a fresh presigned
      // URL replaces it automatically the next time this content is loaded.
      editor.chain().focus().setImage({ src: URL.createObjectURL(file), 'data-media-key': presign.imageMediaKey } as never).run();
    } finally {
      setUploading(false);
    }
  }

  function handleSetLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previousUrl ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  if (!editor) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 bg-muted/30 p-1.5">
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered List"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive('link')} onClick={handleSetLink}>
          <LinkIcon className="size-3.5" />
        </ToolbarButton>
        <label
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          title="Insert Image"
        >
          <ImageIcon className="size-3.5" />
          <input type="file" accept="image/*" className="sr-only" onChange={handleInsertImage} disabled={uploading} />
        </label>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-3.5" />
        </ToolbarButton>
        {uploading ? <span className="ml-1 text-xs text-muted-foreground">Uploading…</span> : null}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
