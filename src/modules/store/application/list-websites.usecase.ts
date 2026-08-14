import type { WebsiteRepository } from '../domain/repositories.js';
import type { WebsiteView } from './dto.js';

export class ListWebsites {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(): Promise<WebsiteView[]> {
    const rows = await this.websites.list();
    return rows.map((w) => ({ publicId: w.publicId, code: w.code, name: w.name, gstin: w.gstin, originStateCode: w.originStateCode }));
  }
}
