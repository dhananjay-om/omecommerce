'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Category } from '@/lib/types';
import { deleteCategory } from './actions';
import { Button } from '@/components/ui/button';
import { EditCategoryDialog } from './edit-category-dialog';

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

function TreeRow({ node, depth, onDelete, deleting }: { node: TreeNode; depth: number; onDelete: (publicId: string) => void; deleting: string | null }) {
  return (
    <>
      <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50" style={{ paddingLeft: `${depth * 24 + 12}px` }}>
        <span className="text-sm">{node.category.nameDefault ?? '(untitled)'}</span>
        <div className="flex items-center gap-1">
          <EditCategoryDialog category={node.category} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleting === node.category.publicId}
            onClick={() => onDelete(node.category.publicId)}
          >
            Delete
          </Button>
        </div>
      </div>
      {node.children.map((child) => (
        <TreeRow key={child.category.publicId} node={child} depth={depth + 1} onDelete={onDelete} deleting={deleting} />
      ))}
    </>
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
    return <p className="text-muted-foreground">No categories yet.</p>;
  }

  return (
    <div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="rounded-md border py-1">
        {tree.map((node) => (
          <TreeRow key={node.category.publicId} node={node} depth={0} onDelete={handleDelete} deleting={isPending ? deletingId : null} />
        ))}
      </div>
    </div>
  );
}
