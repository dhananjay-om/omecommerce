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

export interface CustomerOrderView {
  publicId: string;
  orderNumber: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  grandTotal: string;
  currency: string;
  placedAt: string;
}
