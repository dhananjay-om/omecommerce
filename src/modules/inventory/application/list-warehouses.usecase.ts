import type { WarehouseRepository } from '../domain/repositories.js';
import type { WarehouseView } from './dto.js';

export class ListWarehouses {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async execute(): Promise<WarehouseView[]> {
    const rows = await this.warehouses.list();
    return rows.map((w) => ({
      publicId: w.publicId,
      code: w.code,
      name: w.name,
      type: w.type,
      priority: w.priority,
      isActive: w.isActive,
    }));
  }
}
