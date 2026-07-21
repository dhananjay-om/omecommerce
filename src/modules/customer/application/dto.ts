export interface RegisterCustomerCommand {
  websiteCode: string;
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface CustomerView {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface LoginCustomerCommand {
  websiteCode: string;
  email: string;
  password: string;
}

export interface LoginCustomerResult {
  token: string;
  customerPublicId: string;
}

export interface AddCustomerAddressCommand {
  customerPublicId: string;
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface CustomerAddressView {
  publicId: string;
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface ListCustomersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CustomerListItemView {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerListView {
  total: number;
  page: number;
  pageSize: number;
  customers: CustomerListItemView[];
}

export interface CustomerDetailView {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  addresses: CustomerAddressView[];
}

export interface CustomerOrderView {
  publicId: string;
  orderNumber: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  grandTotal: string;
  currency: string;
  placedAt: string;
  /** plan/15 Phase 11 — total line quantity, for the My Orders "Items" column. */
  itemsCount: number;
}

export interface ListCustomerOrdersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CustomerOrderListDto {
  total: number;
  page: number;
  pageSize: number;
  orders: CustomerOrderView[];
}
