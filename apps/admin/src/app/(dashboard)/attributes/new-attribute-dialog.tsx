'use client';

import { useActionState, useState } from 'react';
import { createAttribute, type ActionState } from './actions';
import { OptionsBuilder } from './options-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const DATA_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'COLOR',
  'SELECT',
  'MULTISELECT',
  'IMAGE',
  'FILE',
  'URL',
  'EMAIL',
  'PHONE',
  'JSON',
  'RICHTEXT',
  'REF_PRODUCT',
  'REF_CATEGORY',
  'REF_BRAND',
  'REF_CMS',
  'REF_COLLECTION',
  'REF_CUSTOMER',
];

const INPUT_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DECIMAL',
  'SWITCH',
  'DATE',
  'DATETIME',
  'COLOR_PICKER',
  'DROPDOWN',
  'MULTISELECT',
  'IMAGE_PICKER',
  'FILE_UPLOAD',
  'RICHTEXT',
  'URL',
  'EMAIL',
  'PHONE',
  'JSON_EDITOR',
  'REFERENCE',
];

const OPTION_DATA_TYPES = new Set(['SELECT', 'MULTISELECT']);

const initialState: ActionState = { error: null, success: false };

export function NewAttributeDialog() {
  const [open, setOpen] = useState(false);
  const [dataType, setDataType] = useState('TEXT');
  const [state, formAction, pending] = useActionState(createAttribute, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Attribute</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Attribute</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attr-code">Code</Label>
            <Input id="attr-code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attr-label">Label</Label>
            <Input id="attr-label" name="label" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attr-data-type">Data Type</Label>
            <Select name="dataType" value={dataType} onValueChange={(value) => setDataType(String(value))}>
              <SelectTrigger id="attr-data-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="attr-input-type">Input Type</Label>
            <Select name="inputType" defaultValue="TEXT">
              <SelectTrigger id="attr-input-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INPUT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <input id="attr-required" name="isRequired" type="checkbox" className="size-4" />
              <Label htmlFor="attr-required">Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <input id="attr-filterable" name="isFilterable" type="checkbox" className="size-4" />
              <Label htmlFor="attr-filterable">Filterable</Label>
            </div>
            <div className="flex items-center gap-2">
              <input id="attr-searchable" name="isSearchable" type="checkbox" className="size-4" />
              <Label htmlFor="attr-searchable">Searchable</Label>
            </div>
            <div className="flex items-center gap-2">
              <input id="attr-comparable" name="isComparable" type="checkbox" className="size-4" />
              <Label htmlFor="attr-comparable">Comparable</Label>
            </div>
          </div>
          {OPTION_DATA_TYPES.has(dataType) ? <OptionsBuilder /> : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Attribute'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
