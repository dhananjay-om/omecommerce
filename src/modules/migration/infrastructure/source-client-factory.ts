import { DomainError } from '../../../shared/domain/errors.js';
import type { MigrationChannel } from '../domain/repositories.js';
import type { SourceCatalogClient } from '../domain/source-client.js';
import { ShopifyClient } from './shopify-client.js';

/** The one place that knows which channel maps to which SourceCatalogClient
 *  implementation — everything else in this module (AnalyzeCatalog, the
 *  migration worker) is channel-agnostic. Magento becomes a second `case`
 *  here, not a rewrite of anything that calls this. */
export function buildSourceClient(channel: MigrationChannel, storeUrl: string, apiToken: string): SourceCatalogClient {
  switch (channel) {
    case 'SHOPIFY':
      return new ShopifyClient(storeUrl, apiToken);
    case 'MAGENTO':
      throw new DomainError(
        'Magento is not connected yet — Shopify ships first, Magento is the next channel added to this same engine.',
        'https://errors.ome/migration-channel-not-supported',
        501,
      );
  }
}
