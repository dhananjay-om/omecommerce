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
}

export interface CurrencyView {
  code: string;
  symbol: string;
  name: string;
  minorUnits: number;
}
