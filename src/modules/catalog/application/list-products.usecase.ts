import type { ProductRepository } from '../domain/repositories.js';
import type { ListProductsQuery, ProductListView } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Admin browse (plan/12 Admin UI) — a real gap this pass fills: there was no way to list products via the API at all before. */
export class ListProducts {
  constructor(private readonly products: ProductRepository) {}

  async execute(query: ListProductsQuery): Promise<ProductListView> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    const result = await this.products.list({ page, pageSize, status: query.status, search: query.search });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      products: result.products.map((p) => ({
        publicId: p.publicId,
        sku: p.sku,
        name: p.name,
        type: p.type,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }
}
