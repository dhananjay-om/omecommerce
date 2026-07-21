'use client';

import { useActionState, useState } from 'react';
import { sendOrderEmail, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

const EMAIL_TYPES = [
  { value: 'CONFIRMATION', label: 'Order Confirmation' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'SHIPMENT', label: 'Shipment Notification' },
  { value: 'CANCELLATION', label: 'Cancellation Notice' },
  { value: 'REFUND', label: 'Refund Notice' },
  { value: 'CUSTOM', label: 'Custom Message' },
];

export function SendEmailDialog({ orderPublicId }: { orderPublicId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('CONFIRMATION');
  const action = sendOrderEmail.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Send Email</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-type">Email Type</Label>
            <select
              id="email-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            >
              {EMAIL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {type === 'CUSTOM' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject</Label>
                <Input id="email-subject" name="subject" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-body">Message</Label>
                <Textarea id="email-body" name="body" rows={4} required />
              </div>
            </>
          ) : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
