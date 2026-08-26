/** Mirrors the backend's PincodeCheckResult (pincode/application/dto.ts) — a
 *  pincode that's either not in the admin-curated list or has been toggled
 *  inactive reads identically as `{serviceable: false}`, no extra fields. */
export interface PincodeCheckResult {
  serviceable: boolean;
  city?: string;
  state?: string;
  estimatedDays?: number;
  codAvailable?: boolean;
}
