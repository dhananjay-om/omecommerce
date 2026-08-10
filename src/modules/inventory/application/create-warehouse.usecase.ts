import type { WarehouseRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import type { CreateWarehouseCommand, WarehouseView } from './dto.js';

export class CreateWarehouse {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async execute(cmd: CreateWarehouseCommand): Promise<WarehouseView> {
    const code = cmd.code.trim();
    if (await this.warehouses.findByCode(code)) {
      throw new ConflictError(`warehouse code already exists: ${code}`);
    }
    const w = await this.warehouses.create({
      code,
      name: cmd.name,
      type: cmd.type,
      priority: cmd.priority,
    });
    return { publicId: w.publicId, code: w.code, name: w.name, type: w.type, priority: w.priority, isActive: w.isActive };
  }
}
