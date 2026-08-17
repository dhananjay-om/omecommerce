export interface CreateCurrencyCommand {
  code: string;
  symbol: string;
  name: string;
  minorUnits?: number;
}

export interface UpdateCurrencyCommand {
  code: string;
  symbol?: string;
  name?: string;
  minorUnits?: number;
  isDefault?: boolean;
}

export interface CurrencyView {
  code: string;
  symbol: string;
  name: string;
  minorUnits: number;
  isDefault: boolean;
}

export interface WebsiteView {
  publicId: string;
  code: string;
  name: string;
  gstin: string | null;
  originStateCode: string | null;
  pricesIncludeTax: boolean;
  address: string | null;
  logoMediaKey: string | null;
  /** Presigned GET URL for logoMediaKey, resolved live on every read (15-minute
   *  expiry, same as every other presigned URL in this codebase) — null when no logo is set. */
  logoUrl: string | null;
  supportEmail: string | null;
}

/** GST Settings page — GST registration only, nothing else. */
export interface UpdateWebsiteTaxSettingsCommand {
  code: string;
  gstin?: string | null;
  originStateCode?: string | null;
  pricesIncludeTax?: boolean;
}

/** General Settings page — store branding, nothing GST-specific. */
export interface UpdateWebsiteGeneralSettingsCommand {
  code: string;
  address?: string | null;
  logoMediaKey?: string | null;
  supportEmail?: string | null;
}

export interface RequestLogoUploadCommand {
  code: string;
  filename: string;
  mimeType: string;
}

export interface LogoUploadUrl {
  uploadUrl: string;
  logoMediaKey: string;
}
