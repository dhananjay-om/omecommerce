import { apiGet } from '@/lib/api-client';
import { AddressList } from '@/components/account/address-list';
import type { CustomerAddress } from '@/types/customer';

export const metadata = { title: 'Addresses' };

export default async function AddressesPage() {
  const addresses = await apiGet<CustomerAddress[]>('/store/v1/me/addresses', { auth: true });
  return <AddressList initialAddresses={addresses} />;
}
