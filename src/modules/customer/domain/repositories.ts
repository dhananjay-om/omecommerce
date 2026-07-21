export interface CustomerRecord {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateCustomerInput {
  websiteId: bigint;
  email: string;
  passwordHash: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface CustomerListItem {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ListCustomersFilter {
  page: number;
  pageSize: number;
  search?: string;
}

export interface CustomerListResult {
  total: number;
  page: number;
  pageSize: number;
  customers: CustomerListItem[];
}

export interface CustomerRepository {
  findByWebsiteAndEmail(websiteId: bigint, email: string): Promise<CustomerRecord | null>;
  findByPublicId(publicId: string): Promise<CustomerRecord | null>;
  create(input: CreateCustomerInput): Promise<CustomerRecord>;
  list(filter: ListCustomersFilter): Promise<CustomerListResult>;
}

export interface CustomerAddressRecord {
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

export interface CreateCustomerAddressInput {
  customerId: bigint;
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

export interface CustomerAddressRepository {
  create(input: CreateCustomerAddressInput): Promise<CustomerAddressRecord>;
  listByCustomerId(customerId: bigint): Promise<CustomerAddressRecord[]>;
  /** Scoped to (customerId, publicId) so a customer can never delete another's address. Returns false if no matching row existed. */
  deleteByPublicId(customerId: bigint, addressPublicId: string): Promise<boolean>;
}

/** Read-only cross-module lookup: resolves a website's code to its internal id (own trivial copy, matching pricing's PrismaWebsiteLookup). */
export interface WebsiteLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
}

export interface CustomerOrderSummary {
  publicId: string;
  orderNumber: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  grandTotal: string;
  currency: string;
  placedAt: Date;
  itemsCount: number;
}

export interface ListCustomerOrdersFilter {
  page: number;
  pageSize: number;
  /** Matches order_number (exact or text-prefix) — plan/15 Phase 11. */
  search?: string;
}

export interface CustomerOrderListResult {
  total: number;
  page: number;
  pageSize: number;
  orders: CustomerOrderSummary[];
}

/** Read-only cross-module lookup: a customer's own order history (trivial read, not the full Order module repository). */
export interface CustomerOrderLookup {
  list(customerId: bigint, filter: ListCustomerOrdersFilter): Promise<CustomerOrderListResult>;
}
