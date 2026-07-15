import { Client } from '@opensearch-project/opensearch';
import { env } from '../../../config/env.js';

let client: Client | undefined;

export function getOpenSearchClient(): Client {
  client ??= new Client({ node: env.OPENSEARCH_URL });
  return client;
}
