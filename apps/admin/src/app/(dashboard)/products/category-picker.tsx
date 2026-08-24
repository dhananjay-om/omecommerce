import type { Category } from '@/lib/types';
import { Label } from '@/components/ui/label';

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
    return (byParent.get(parentKey) ?? []).map((category) => ({ category, children: build(category.publicId) }));
  }
  return build('');
}

function TreeRow({ node, depth, selectedIds }: { node: TreeNode; depth: number; selectedIds: Set<string> }) {
  return (
    <>
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${depth * 20}px` }}>
        <input
          type="checkbox"
          id={`cat-picker-${node.category.publicId}`}
          name="categoryIds"
          value={node.category.publicId}
          defaultChecked={selectedIds.has(node.category.publicId)}
          className="size-4"
        />
        <label htmlFor={`cat-picker-${node.category.publicId}`} className="text-sm">
          {node.category.nameDefault ?? '(untitled)'}
        </label>
      </div>
      {node.children.map((child) => (
        <TreeRow key={child.category.publicId} node={child} depth={depth + 1} selectedIds={selectedIds} />
      ))}
    </>
  );
}

/** Checkbox tree for assigning a product's categories — submits as repeated `categoryIds` fields, read via `formData.getAll('categoryIds')`. */
export function CategoryPicker({ categories, selectedIds }: { categories: Category[]; selectedIds: string[] }) {
  const tree = buildTree(categories);
  const selected = new Set(selectedIds);

  return (
    <div className="space-y-2">
      <Label>Categories</Label>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        // No height cap/inner scroll here — every other section on this page
        // (Attributes, Variants, Pricing) just grows naturally with the
        // page's own scroll instead of getting its own cramped nested
        // scrollbar; capping this one at 256px left a small scrolling box
        // sitting on top of a large empty gap before the sticky Save bar.
        <div className="rounded-md border p-2">
          {tree.map((node) => (
            <TreeRow key={node.category.publicId} node={node} depth={0} selectedIds={selected} />
          ))}
        </div>
      )}
    </div>
  );
}
