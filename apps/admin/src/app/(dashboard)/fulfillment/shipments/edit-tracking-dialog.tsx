'use client';

import { useActionState, useState } from 'react';
import { updateShipmentTracking, type ActionState } from './actions';
import type { FulfillmentListItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** Fixing/adding tracking after the fact — the one real gap Shipments'
 *  own cross-order view exists to close (see actions.ts's own doc
 *  comment: FulfillOrder only ever sets these once, at creation). */
export function EditTrackingDialog({ fulfillment }: { fulfillment: FulfillmentListItem }) {
  const [open, setOpen] = useState(false);
  const action = updateShipmentTracking.bind(null, fulfillment.publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit tracking</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit Tracking — Order #{fulfillment.orderNumber}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-carrier">Carrier</Label>
              <Input id="edit-carrier" name="carrier" defaultValue={fulfillment.carrier ?? ''} placeholder="e.g. FedEx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tracking-number">Tracking Number</Label>
              <Input id="edit-tracking-number" name="trackingNumber" defaultValue={fulfillment.trackingNumber ?? ''} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tracking-url">Carrier Tracking URL</Label>
            <Input
              id="edit-tracking-url"
              name="carrierTrackingUrl"
              type="url"
              placeholder="https://…"
              defaultValue={fulfillment.carrierTrackingUrl ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-eta">Estimated Delivery</Label>
            <Input
              id="edit-eta"
              name="estimatedDeliveryAt"
              type="date"
              defaultValue={fulfillment.estimatedDeliveryAt ? fulfillment.estimatedDeliveryAt.slice(0, 10) : ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Shipping Notes</Label>
            <Textarea id="edit-notes" name="shippingNotes" rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">Leaving a field blank keeps its current value — it won&apos;t be cleared.</p>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
