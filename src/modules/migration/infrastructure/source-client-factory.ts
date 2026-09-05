import type { MigrationChannel } from '../domain/repositories.js';
import type { SourceCatalogClient, SourceCustomerClient, SourceOrderClient } from '../domain/source-client.js';
import { ShopifyClient } from './shopify-client.js';
import { MagentoClient } from './magento-client.js';

/** The one place that knows which channel maps to which SourceCatalogClient
 *  implementation — everything else in this module (AnalyzeCatalog, the
 *  migration worker) is channel-agnostic. */
export function buildSourceClient(channel: MigrationChannel, storeUrl: string, apiToken: string): SourceCatalogClient {
  switch (channel) {
    case 'SHOPIFY':
      return new ShopifyClient(storeUrl, apiToken);
    case 'MAGENTO':
      return new MagentoClient(storeUrl, apiToken);
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
      return new MagentoClient(storeUrl, apiToken);
  }
}

/** Same shape again, for the Order migration's own port. */
export function buildOrderSourceClient(channel: MigrationChannel, storeUrl: string, apiToken: string): SourceOrderClient {
  switch (channel) {
    case 'SHOPIFY':
      return new ShopifyClient(storeUrl, apiToken);
    case 'MAGENTO':
      return new MagentoClient(storeUrl, apiToken);
  }
}
