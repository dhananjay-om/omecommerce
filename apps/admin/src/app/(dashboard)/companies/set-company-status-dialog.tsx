'use client';

import { useActionState, useState } from 'react';
import { setCompanyStatus, type ActionState } from './actions';
import type { CompanyStatus } from '@/lib/types';
import { Button, type buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { VariantProps } from 'class-variance-authority';

const initialState: ActionState = { error: null, success: false };

export function SetCompanyStatusDialog({
  publicId,
  targetStatus,
  triggerLabel,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
}: {
  publicId: string;
  targetStatus: CompanyStatus;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: VariantProps<typeof buttonVariants>['variant'];
}) {
  const [open, setOpen] = useState(false);
  const action = setCompanyStatus.bind(null, publicId, targetStatus);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">{triggerLabel}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant={confirmVariant} disabled={pending}>
              {pending ? 'Saving…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
