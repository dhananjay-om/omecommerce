import type { CustomerGroupRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import type { CreateCustomerGroupCommand, CustomerGroupView } from './dto.js';

export class CreateCustomerGroup {
  constructor(private readonly groups: CustomerGroupRepository) {}

  async execute(cmd: CreateCustomerGroupCommand): Promise<CustomerGroupView> {
    const code = cmd.code.trim();
    if (await this.groups.findByCode(code)) {
      throw new ConflictError(`customer group code already exists: ${code}`);
    }
    const g = await this.groups.create({ code, name: cmd.name, isDefault: cmd.isDefault });
    return { publicId: g.publicId, code: g.code, name: g.name, isDefault: g.isDefault };
  }
}
