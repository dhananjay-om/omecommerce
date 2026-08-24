'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import type { Category } from '@/lib/types';
import { deleteCategory } from './actions';
import { Button } from '@/components/ui/button';
import { DotBadge } from '@/components/dot-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface TreeNode {
  category: Category;
  children: TreeNode[];
}

function buildTree(categories: Category[]): TreeNode[] {
  const byParent = new Map<string, Category[]>();
  for (const c of categories) {
    const key = c.parentId ?? '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  function build(parentKey: string): TreeNode[] {
    return (byParent.get(parentKey) ?? []).map((category) => ({
      category,
      children: build(category.publicId),
    }));
  }
  return build('');
}

/** Deterministic hash → one of the 8 categorical chart colors (same
 *  --chart-1..8 tokens used everywhere else in this revamp), so every
 *  category gets a distinct, stable swatch color instead of one flat
 *  color for all of them — matches the mock's own `hashColor()`, which
 *  picks from this exact 8-slot categorical palette. Purely decorative
 *  (not a real per-category "color" field), so it needs no backend data. */
function hashChartColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `var(--chart-${(h % 8) + 1})`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function TreeRow({
  node,
  onDelete,
  deleting,
}: {
  node: TreeNode;
  onDelete: (publicId: string) => void;
  deleting: string | null;
}) {
  const router = useRouter();
  const name = node.category.nameDefault ?? '(untitled)';
  const href = `/categories/${node.category.publicId}/edit`;

  return (
    <li className="py-0.5">
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
        onClick={() => router.push(href)}
      >
        {node.children.length > 0 ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <span className="inline-block size-3.5 shrink-0" />}
        {node.category.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL, per-request/dynamic
          <img src={node.category.imageUrl} alt="" className="size-6 shrink-0 rounded-md object-cover" />
        ) : (
          <div
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
            style={{ background: hashChartColor(node.category.publicId) }}
          >
            {initials(name)}
          </div>
        )}
        <span className="flex-1 truncate font-medium text-foreground">{name}</span>
        <DotBadge variant={node.category.includeInMenu ? 'success' : 'secondary'}>{node.category.includeInMenu ? 'Visible' : 'Hidden'}</DotBadge>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-7" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Actions for {name}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => router.push(href)}>Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" disabled={deleting === node.category.publicId} onClick={() => onDelete(node.category.publicId)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {node.children.length > 0 ? (
        <ul className="ml-4 border-l pl-1.5">
          {node.children.map((child) => (
            <TreeRow key={child.category.publicId} node={child} onDelete={onDelete} deleting={deleting} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CategoryTree({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tree = buildTree(categories);

  function handleDelete(publicId: string) {
    setError(null);
    setDeletingId(publicId);
    startTransition(async () => {
      const result = await deleteCategory(publicId);
      setDeletingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-xl bg-card py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">No categories yet.</div>
    );
  }

  return (
    <div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <ul className="list-none">
          {tree.map((node) => (
            <TreeRow key={node.category.publicId} node={node} onDelete={handleDelete} deleting={isPending ? deletingId : null} />
          ))}
        </ul>
      </div>
    </div>
  );
}
