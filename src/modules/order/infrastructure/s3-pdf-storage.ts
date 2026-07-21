import type { PdfStorage } from '../domain/ports.js';
import { putObject } from '../../../shared/infrastructure/storage/s3-client.js';

/** Thin adapter over the shared S3 client module's server-side putObject — mirrors S3MediaUrlResolver's own thin-adapter shape. */
export class S3PdfStorage implements PdfStorage {
  store(key: string, body: Buffer): Promise<void> {
    return putObject(key, body, 'application/pdf');
  }
}
