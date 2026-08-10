'use client';

import { useMemo, useState } from 'react';
import type { Attribute, AttributeDataType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Type,
  Hash,
  ToggleLeft,
  Calendar,
  Palette,
  List,
  Image as ImageIcon,
  Link2,
  Mail,
  Phone,
  Braces,
  AlignLeft,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<AttributeDataType, LucideIcon> = {
  TEXT: Type,
  TEXTAREA: AlignLeft,
  NUMBER: Hash,
  DECIMAL: Hash,
  BOOLEAN: ToggleLeft,
  DATE: Calendar,
  DATETIME: Calendar,
  COLOR: Palette,
  SELECT: List,
  MULTISELECT: List,
  IMAGE: ImageIcon,
  FILE: ImageIcon,
  URL: Link2,
  EMAIL: Mail,
  PHONE: Phone,
  JSON: Braces,
  RICHTEXT: AlignLeft,
  REF_PRODUCT: Link2,
  REF_CATEGORY: Link2,
  REF_BRAND: Link2,
  REF_CMS: Link2,
  REF_COLLECTION: Link2,
  REF_CUSTOMER: Link2,
};

export function AttributesGrid({ attributes }: { attributes: Attribute[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attributes;
    return attributes.filter((a) => a.code.toLowerCase().includes(q) || a.label.toLowerCase().includes(q));
  }, [attributes, query]);

  return (
    <div className="mt-6 space-y-4">
      <Input
        placeholder="Search attributes by code or label…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {attributes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attributes yet — create one to start building attribute sets.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attributes match &quot;{query}&quot;.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const Icon = ICONS[a.dataType] ?? Type;
            return (
              <Card key={a.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate font-medium leading-none">{a.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{a.code}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant="outline">{a.dataType}</Badge>
                      <Badge variant="secondary">{a.inputType}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
