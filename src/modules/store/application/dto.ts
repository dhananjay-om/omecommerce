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
}

export interface UpdateWebsiteTaxSettingsCommand {
  code: string;
  gstin?: string | null;
  originStateCode?: string | null;
  pricesIncludeTax?: boolean;
}
