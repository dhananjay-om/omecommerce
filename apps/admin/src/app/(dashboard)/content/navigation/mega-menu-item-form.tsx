'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMegaMenuItem, updateMegaMenuItem } from './actions';
import { MegaMenuImageUploadField } from './mega-menu-image-upload-field';
import type { MegaMenuItem, MegaMenuColumn, MegaMenuPromoImagePosition, Category } from '@/lib/types';
import { StickyFormActions } from '@/components/sticky-form-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-2">{children}</CardContent>
    </Card>
  );
}

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** Fills label+href from a real category — a convenience, not a live
 *  link: the stored href is a plain string same as every other link in
 *  this form, not a foreign key, so a category rename afterward won't
 *  retroactively update it (same "snapshot, not FK" reasoning already
 *  used elsewhere in this app for e.g. OrderLine.sku). */
function CategoryPicker({ categories, onPick }: { categories: Category[]; onPick: (label: string, href: string) => void }) {
  if (categories.length === 0) return null;
  return (
    <select
      className={nativeSelectClass}
      value=""
      onChange={(e) => {
        const cat = categories.find((c) => c.publicId === e.target.value);
        if (cat) onPick(cat.nameDefault ?? cat.slug, `/collections/${cat.slug}`);
      }}
    >
      <option value="">Fill from a category…</option>
      {categories.map((c) => (
        <option key={c.publicId} value={c.publicId}>
          {c.nameDefault ?? c.slug}
        </option>
      ))}
    </select>
  );
}

/** Controlled, not FormData/useActionState like most forms in this app
 *  (see banners/banner-form.tsx for that shape) — `columns` is a nested
 *  structure (columns -> links, each an object) that doesn't encode
 *  cleanly into plain form fields the way this app's other forms'
 *  flat-field shapes do. Same "controlled state, call the action
 *  directly" pattern already used for Automation's rule-form-dialog.tsx. */
export function MegaMenuItemForm({ item, categories }: { item?: MegaMenuItem; categories: Category[] }) {
  const router = useRouter();
  const isEdit = !!item;

  const [label, setLabel] = useState(item?.label ?? '');
  const [href, setHref] = useState(item?.href ?? '');
  const [position, setPosition] = useState(item?.position ?? 0);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [columns, setColumns] = useState<MegaMenuColumn[]>(item?.columns ?? []);
  const [promoImageMediaKey, setPromoImageMediaKey] = useState(item?.promoImageMediaKey ?? '');
  const [promoImageUrl, setPromoImageUrl] = useState(item?.promoImageUrl ?? null);
  const [promoHref, setPromoHref] = useState(item?.promoHref ?? '');
  const [promoCaption, setPromoCaption] = useState(item?.promoCaption ?? '');
  // Layout controls — kept as strings ('' == "use the default") rather
  // than number|null directly, since a controlled number <input> can't
  // represent "empty" any other way without fighting the DOM.
  const [panelWidth, setPanelWidth] = useState(item?.panelWidth != null ? String(item.panelWidth) : '');
  const [columnGap, setColumnGap] = useState(item?.columnGap != null ? String(item.columnGap) : '');
  const [promoImageWidth, setPromoImageWidth] = useState(item?.promoImageWidth != null ? String(item.promoImageWidth) : '');
  const [promoImageHeight, setPromoImageHeight] = useState(item?.promoImageHeight != null ? String(item.promoImageHeight) : '');
  const [promoImagePosition, setPromoImagePosition] = useState<MegaMenuPromoImagePosition>(item?.promoImagePosition ?? 'right');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addColumn() {
    setColumns((prev) => [...prev, { heading: '', links: [] }]);
  }
  function updateColumnHeading(i: number, heading: string) {
    setColumns((prev) => prev.map((c, idx) => (idx === i ? { ...c, heading } : c)));
  }
  function removeColumn(i: number) {
    setColumns((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addLink(colIdx: number) {
    setColumns((prev) => prev.map((c, idx) => (idx === colIdx ? { ...c, links: [...c.links, { label: '', href: '' }] } : c)));
  }
  function updateLink(colIdx: number, linkIdx: number, patch: Partial<{ label: string; href: string }>) {
    setColumns((prev) =>
      prev.map((c, idx) => (idx === colIdx ? { ...c, links: c.links.map((l, li) => (li === linkIdx ? { ...l, ...patch } : l)) } : c)),
    );
  }
  function removeLink(colIdx: number, linkIdx: number) {
    setColumns((prev) => prev.map((c, idx) => (idx === colIdx ? { ...c, links: c.links.filter((_, li) => li !== linkIdx) } : c)));
  }

  async function submit() {
    setError(null);
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    if (!href.trim()) {
      setError('Link is required.');
      return;
    }
    const cleanColumns = columns
      .map((c) => ({ heading: c.heading.trim(), links: c.links.filter((l) => l.label.trim() && l.href.trim()) }))
      .filter((c) => c.heading);

    setPending(true);
    const payload = {
      label: label.trim(),
      href: href.trim(),
      position,
      isActive,
      columns: cleanColumns,
      promoImageMediaKey: promoImageMediaKey || null,
      promoHref: promoHref.trim() || null,
      promoCaption: promoCaption.trim() || null,
      panelWidth: panelWidth.trim() ? Number(panelWidth) : null,
      columnGap: columnGap.trim() ? Number(columnGap) : null,
      promoImageWidth: promoImageWidth.trim() ? Number(promoImageWidth) : null,
      promoImageHeight: promoImageHeight.trim() ? Number(promoImageHeight) : null,
      promoImagePosition,
    };
    const result = isEdit ? await updateMegaMenuItem(item!.publicId, payload) : await createMegaMenuItem(payload);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push('/content/navigation');
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="max-w-3xl space-y-6"
    >
      <SectionCard title="Top-Level Link" description="What shows in the header nav itself.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <CategoryPicker
              categories={categories}
              onPick={(l, h) => {
                setLabel(l);
                setHref(h);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-label">Label</Label>
            <Input id="menu-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Electronics" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-href">Link</Label>
            <Input id="menu-href" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/collections/electronics" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-position">Position</Label>
            <Input id="menu-position" type="number" value={position} onChange={(e) => setPosition(Number(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">Lower numbers show first.</p>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="menu-active" type="checkbox" className="size-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <Label htmlFor="menu-active" className="font-normal">
              Active
            </Label>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Dropdown Columns" description="Optional — leave empty for a plain top-level link with no dropdown.">
        <div className="space-y-4">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Input className="flex-1" value={col.heading} onChange={(e) => updateColumnHeading(colIdx, e.target.value)} placeholder="Column heading" />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeColumn(colIdx)}>
                  Remove column
                </Button>
              </div>
              <div className="space-y-2 pl-3">
                {col.links.map((link, linkIdx) => (
                  <div key={linkIdx} className="flex items-center gap-2">
                    <Input className="flex-1" value={link.label} onChange={(e) => updateLink(colIdx, linkIdx, { label: e.target.value })} placeholder="Link label" />
                    <Input className="flex-1" value={link.href} onChange={(e) => updateLink(colIdx, linkIdx, { href: e.target.value })} placeholder="/collections/…" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLink(colIdx, linkIdx)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <CategoryPicker categories={categories} onPick={(l, h) => setColumns((prev) => prev.map((c, idx) => (idx === colIdx ? { ...c, links: [...c.links, { label: l, href: h }] } : c)))} />
                  <Button type="button" variant="outline" size="sm" onClick={() => addLink(colIdx)}>
                    + Add link
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addColumn}>
            + Add column
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Dropdown Layout"
        description="Optional — leave blank to use the panel's normal size and spacing. Only matters when this item has columns and/or a promo image."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="menu-panel-width">Panel width (px)</Label>
            <Input id="menu-panel-width" type="number" min={1} value={panelWidth} onChange={(e) => setPanelWidth(e.target.value)} placeholder="Default (448)" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-column-gap">Spacing between columns (px)</Label>
            <Input id="menu-column-gap" type="number" min={0} value={columnGap} onChange={(e) => setColumnGap(e.target.value)} placeholder="Default (24)" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Promo Panel" description="Optional — an image shown alongside the columns above.">
        <MegaMenuImageUploadField
          imageUrl={promoImageUrl}
          onChange={(key, preview) => {
            setPromoImageMediaKey(key);
            setPromoImageUrl(preview);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="menu-promo-href">Image links to</Label>
            <Input id="menu-promo-href" value={promoHref} onChange={(e) => setPromoHref(e.target.value)} placeholder="/collections/sale" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-promo-caption">Caption</Label>
            <Input id="menu-promo-caption" value={promoCaption} onChange={(e) => setPromoCaption(e.target.value)} placeholder="Up to 30% off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-promo-position">Image position</Label>
            <select
              id="menu-promo-position"
              className={nativeSelectClass + ' w-full'}
              value={promoImagePosition}
              onChange={(e) => setPromoImagePosition(e.target.value as MegaMenuPromoImagePosition)}
            >
              <option value="right">Right of columns</option>
              <option value="left">Left of columns</option>
              <option value="top">Above columns</option>
              <option value="bottom">Below columns</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="menu-promo-width">Image width (px)</Label>
              <Input id="menu-promo-width" type="number" min={1} value={promoImageWidth} onChange={(e) => setPromoImageWidth(e.target.value)} placeholder="Default" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-promo-height">Image height (px)</Label>
              <Input id="menu-promo-height" type="number" min={1} value={promoImageHeight} onChange={(e) => setPromoImageHeight(e.target.value)} placeholder="Default" />
            </div>
          </div>
        </div>
      </SectionCard>

      <StickyFormActions pending={pending} label={isEdit ? 'Save Item' : 'Create Item'} pendingLabel="Saving…" error={error} />
    </form>
  );
}
