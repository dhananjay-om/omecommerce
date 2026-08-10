import type { WarehouseRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { UpdateWarehouseCommand, WarehouseView } from './dto.js';

export class UpdateWarehouse {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async execute(cmd: UpdateWarehouseCommand): Promise<WarehouseView> {
    const warehouse = await this.warehouses.findByCode(cmd.code);
    if (!warehouse) throw new NotFoundError('warehouse', cmd.code);

    const w = await this.warehouses.update(warehouse.id, {
      name: cmd.name,
      type: cmd.type,
      priority: cmd.priority,
      isActive: cmd.isActive,
    });
    return { publicId: w.publicId, code: w.code, name: w.name, type: w.type, priority: w.priority, isActive: w.isActive };
  }
}
