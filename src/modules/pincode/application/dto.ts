export interface PincodeView {
  publicId: string;
  code: string;
  city: string;
  state: string;
  estimatedDays: number;
  codAvailable: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface PincodeListView {
  total: number;
  page: number;
  pageSize: number;
  pincodes: PincodeView[];
}

export interface CreatePincodeCommand {
  code: string;
  city: string;
  state: string;
  estimatedDays: number;
  codAvailable?: boolean;
}

export interface UpdatePincodeCommand {
  city?: string;
  state?: string;
  estimatedDays?: number;
  codAvailable?: boolean;
  isActive?: boolean;
}

export interface ListPincodesQuery {
  search?: string;
  state?: string;
  page?: number;
  pageSize?: number;
}

export interface BulkUpsertPincodesCommand {
  rows: CreatePincodeCommand[];
}

export interface BulkUpsertPincodesResult {
  total: number;
  created: number;
  updated: number;
}

/** What the storefront's pincode checker actually needs — never the
 *  admin-only publicId/updatedAt. */
export interface PincodeCheckResult {
  serviceable: boolean;
  city?: string;
  state?: string;
  estimatedDays?: number;
  codAvailable?: boolean;
}
