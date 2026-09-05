import { DomainError } from '../../../shared/domain/errors.js';
import type { MigrationChannel } from '../domain/repositories.js';
import type { SourceCatalogClient, SourceCustomerClient, SourceOrderClient } from '../domain/source-client.js';
import { ShopifyClient } from './shopify-client.js';

const MAGENTO_NOT_CONNECTED = new DomainError(
  'Magento is not connected yet — Shopify ships first, Magento is the next channel added to this same engine.',
  'https://errors.ome/migration-channel-not-supported',
  501,
);

/** The one place that knows which channel maps to which SourceCatalogClient
 *  implementation — everything else in this module (AnalyzeCatalog, the
 *  migration worker) is channel-agnostic. Magento becomes a second `case`
 *  here, not a rewrite of anything that calls this. */
export function buildSourceClient(channel: MigrationChannel, storeUrl: string, apiToken: string): SourceCatalogClient {
  switch (channel) {
    case 'SHOPIFY':
      return new ShopifyClient(storeUrl, apiToken);
    case 'MAGENTO':
      throw MAGENTO_NOT_CONNECTED;
  }
}

/** Same one-place-decides-the-implementation shape as buildSourceClient,
 *  for the Customer migration's own port — kept as a separate function
 *  (not a shared generic) since the two ports are genuinely independent
 *  (see SourceCustomerClient's own doc comment). */
export function buildCustomerSourceClient(channel: MigrationChannel, storeUrl: string, apiToken: string): SourceCustomerClient {
  switch (channel) {
    case 'SHOPIFY':
      return new ShopifyClient(storeUrl, apiToken);
    case 'MAGENTO':
      throw MAGENTO_NOT_CONNECTED;
  }
}

/** Same shape again, for the Order migration's own port. */
export function buildOrderSourceClient(channel: MigrationChannel, storeUrl: string, apiToken: string): SourceOrderClient {
  switch (channel) {
    case 'SHOPIFY':
      return new ShopifyClient(storeUrl, apiToken);
    case 'MAGENTO':
      throw MAGENTO_NOT_CONNECTED;
  }
}
