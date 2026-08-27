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
  baseCurrency: string;
  gstin: string | null;
  originStateCode: string | null;
  pricesIncludeTax: boolean;
  address: string | null;
  logoMediaKey: string | null;
  /** Presigned GET URL for logoMediaKey, resolved live on every read (15-minute
   *  expiry, same as every other presigned URL in this codebase) — null when no logo is set. */
  logoUrl: string | null;
  supportEmail: string | null;
  walletEnabled: boolean;
  walletMaxPercentOfOrder: string | null;
  walletMinOrderValue: string | null;
  walletMaxAmountPerOrder: string | null;
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

/** Wallet Settings page (plan/17) — checkout-tender rules only, nothing else. */
export interface UpdateWebsiteWalletSettingsCommand {
  code: string;
  walletEnabled?: boolean;
  walletMaxPercentOfOrder?: string | null;
  walletMinOrderValue?: string | null;
  walletMaxAmountPerOrder?: string | null;
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

/** Storefront-safe subset of WebsiteView — just enough to render a header/
 *  footer logo, nothing admin-internal (gstin, address, wallet rules, etc). */
export interface PublicWebsiteView {
  name: string;
  logoUrl: string | null;
}

/** Admin "Create Store" — one combined write, not raw Website/Store/
 *  StoreView fields (see WebsiteRepository.createStore's own doc comment
 *  for why). storeCode/storeViewCode are optional — the use case defaults
 *  them, they're never a form field. */
export interface CreateStoreCommand {
  websiteCode: string;
  websiteName: string;
  currency: string;
  storeCode?: string;
  storeViewCode?: string;
}

/** Storefront's public store switcher — one row per active StoreView. */
export interface PublicStoreView {
  websiteCode: string;
  websiteName: string;
  storeViewId: string;
  storeViewCode: string;
  currency: string;
  isDefault: boolean;
}
