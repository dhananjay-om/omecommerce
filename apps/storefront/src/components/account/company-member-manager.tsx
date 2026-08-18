'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrashIcon } from '@heroicons/react/24/outline';
import type { CompanyMember, CompanyMemberRole } from '@/types/company';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  role: z.enum(['BUYER', 'ADMIN']),
});

type FormValues = z.infer<typeof schema>;

/** Member management for an ADMIN-role buyer only — a BUYER never sees this
 *  panel (the account/company page gates it on myRole, see page.tsx). */
export function CompanyMemberManager({ initialMembers, ownCustomerPublicId }: { initialMembers: CompanyMember[]; ownCustomerPublicId: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'BUYER' } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api.post<CompanyMember>('/account/company/members', values);
      setMembers((prev) => [...prev, res.data]);
      reset({ email: '', role: 'BUYER' });
      setShowForm(false);
      toast.success('Member added');
    } catch (err) {
      const message = isAxiosError(err) ? (err.response?.data?.error ?? 'Could not add member.') : 'Could not add member.';
      toast.error(message);
    }
  });

  async function remove(customerPublicId: string) {
    try {
      await api.delete(`/account/company/members/${customerPublicId}`);
      setMembers((prev) => prev.filter((m) => m.customerPublicId !== customerPublicId));
      toast.success('Member removed');
    } catch {
      toast.error('Could not remove member.');
    }
  }

  async function changeRole(customerPublicId: string, role: CompanyMemberRole) {
    try {
      const res = await api.put<CompanyMember>(`/account/company/members/${customerPublicId}`, { role });
      setMembers((prev) => prev.map((m) => (m.customerPublicId === customerPublicId ? res.data : m)));
      toast.success('Role updated');
    } catch {
      toast.error('Could not update role.');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Members</h3>
        {!showForm ? (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Add Member
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <div key={member.customerPublicId} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">{member.email}</p>
              <p className="text-xs text-muted-foreground">Added {new Date(member.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {member.customerPublicId === ownCustomerPublicId ? (
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{member.role} (you)</span>
              ) : (
                <>
                  <select
                    className="rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                    value={member.role}
                    onChange={(e) => changeRole(member.customerPublicId, e.target.value as CompanyMemberRole)}
                  >
                    <option value="BUYER">BUYER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove member" onClick={() => remove(member.customerPublicId)}>
                    <TrashIcon className="size-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <select id="role" className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm" {...register('role')}>
              <option value="BUYER">BUYER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="cta" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
