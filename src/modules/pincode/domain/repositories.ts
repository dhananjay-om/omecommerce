export interface PincodeInfo {
  publicId: string;
  code: string;
  city: string;
  state: string;
  estimatedDays: number;
  codAvailable: boolean;
  isActive: boolean;
  updatedAt: Date;
}

export interface CreatePincodeInput {
  code: string;
  city: string;
  state: string;
  estimatedDays: number;
  codAvailable: boolean;
}

export interface UpdatePincodeInput {
  city?: string;
  state?: string;
  estimatedDays?: number;
  codAvailable?: boolean;
  isActive?: boolean;
}

export interface ListPincodesFilter {
  search?: string;
  state?: string;
  page: number;
  pageSize: number;
}

export interface PincodeListResult {
  total: number;
  page: number;
  pageSize: number;
  pincodes: PincodeInfo[];
}

/** Admin-curated delivery-serviceability lookup — see pincode.prisma's own
 *  header comment for why this is a plain table, not a computed radius. */
export interface PincodeRepository {
  create(input: CreatePincodeInput): Promise<PincodeInfo>;
  findByCode(code: string): Promise<PincodeInfo | null>;
  list(filter: ListPincodesFilter): Promise<PincodeListResult>;
  update(code: string, input: UpdatePincodeInput): Promise<PincodeInfo>;
  /** Insert-or-update by code, in one batch — the admin "Bulk Add" CSV
   *  action. Returns how many rows were newly created vs. updated. */
  bulkUpsert(inputs: CreatePincodeInput[]): Promise<{ created: number; updated: number }>;
}
