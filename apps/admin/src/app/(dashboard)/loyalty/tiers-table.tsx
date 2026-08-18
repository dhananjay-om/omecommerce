import type { LoyaltyTier } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewTierDialog } from './new-tier-dialog';
import { EditTierDialog } from './edit-tier-dialog';
import { DeleteTierDialog } from './delete-tier-dialog';

export function TiersTable({ programPublicId, tiers }: { programPublicId: string; tiers: LoyaltyTier[] }) {
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tiers</h3>
        <NewTierDialog programPublicId={programPublicId} />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Threshold Points</TableHead>
              <TableHead>Earn Multiplier</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No tiers yet — customers earn at the base rate until one is added.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.thresholdPoints}</TableCell>
                  <TableCell>{t.earnMultiplier}×</TableCell>
                  <TableCell>{t.sortOrder}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <EditTierDialog programPublicId={programPublicId} tier={t} />
                      <DeleteTierDialog programPublicId={programPublicId} tierId={t.id} name={t.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
