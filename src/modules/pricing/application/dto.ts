import type { PriceListType } from '@prisma/client';

export interface CreateCustomerGroupCommand {
  code: string;
  name: string;
  isDefault?: boolean;
}

export interface CustomerGroupView {
  publicId: string;
  code: string;
  name: string;
  isDefault: boolean;
}

export interface CreatePriceListCommand {
  code: string;
  name: string;
  currency: string;
  type?: PriceListType;
  priority?: number;
  customerGroupCode?: string | null;
  websiteCode?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface PriceListView {
  publicId: string;
  code: string;
  name: string;
  currency: string;
  type: PriceListType;
  priority: number;
  isActive: boolean;
}

export interface UpdatePriceListCommand {
  code: string;
  name?: string;
  currency?: string;
  type?: PriceListType;
  priority?: number;
  isActive?: boolean;
}

export interface VariantPriceView {
  priceListCode: string;
  priceListName: string;
  currency: string;
  price: string | null;
  mrp: string | null;
}

export interface SetProductPriceCommand {
  priceListCode: string;
  variantPublicId: string;
  price: string;
  mrp?: string | null;
}

export interface SetPriceTierCommand {
  priceListCode: string;
  variantPublicId: string;
  minQty: number;
  price: string;
}

export interface ResolvePriceQuery {
  variantPublicId: string;
  qty: number;
  currency: string;
  customerGroupCode?: string | null;
  websiteCode?: string | null;
}

export interface ResolvedPriceView {
  price: string;
  priceListCode: string;
  source: 'tier' | 'base';
  mrp: string | null;
}
