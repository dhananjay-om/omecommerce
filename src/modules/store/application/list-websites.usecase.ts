import type { WebsiteRepository } from '../domain/repositories.js';
import { toWebsiteView } from './website-view.js';
import type { WebsiteView } from './dto.js';

export class ListWebsites {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(): Promise<WebsiteView[]> {
    const rows = await this.websites.list();
    return Promise.all(rows.map(toWebsiteView));
  }
}
