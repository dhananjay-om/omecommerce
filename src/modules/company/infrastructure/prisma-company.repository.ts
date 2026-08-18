import type { CompanyStatus, CompanyMemberRole, Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  CompanyRepository,
  CompanyRecord,
  CreateCompanyInput,
  UpdateCompanyInput,
  ListCompaniesFilter,
  CompanyListResult,
  CompanyMemberRecord,
} from '../domain/repositories.js';

const COMPANY_SELECT = {
  id: true,
  publicId: true,
  websiteId: true,
  code: true,
  name: true,
  status: true,
  customerGroupId: true,
  taxExempt: true,
  taxExemptionRef: true,
  gstin: true,
  billingContactName: true,
  billingContactEmail: true,
  billingContactPhone: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCompanyInput): Promise<CompanyRecord> {
    return this.db.company.create({
      data: {
        websiteId: input.websiteId,
        code: input.code,
        name: input.name,
        customerGroupId: input.customerGroupId ?? null,
        taxExempt: input.taxExempt ?? false,
        taxExemptionRef: input.taxExemptionRef ?? null,
        gstin: input.gstin ?? null,
        billingContactName: input.billingContactName ?? null,
        billingContactEmail: input.billingContactEmail ?? null,
        billingContactPhone: input.billingContactPhone ?? null,
        createdBy: input.createdBy,
      },
      select: COMPANY_SELECT,
    });
  }

  async findByPublicId(publicId: string): Promise<CompanyRecord | null> {
    return this.db.company.findFirst({ where: { publicId, deletedAt: null }, select: COMPANY_SELECT });
  }

  async findById(id: bigint): Promise<CompanyRecord | null> {
    return this.db.company.findFirst({ where: { id, deletedAt: null }, select: COMPANY_SELECT });
  }

  async findByWebsiteAndCode(websiteId: bigint, code: string): Promise<CompanyRecord | null> {
    return this.db.company.findFirst({ where: { websiteId, code, deletedAt: null }, select: COMPANY_SELECT });
  }

  async list(filter: ListCompaniesFilter): Promise<CompanyListResult> {
    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(filter.websiteId ? { websiteId: filter.websiteId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { OR: [{ code: { contains: filter.q, mode: 'insensitive' } }, { name: { contains: filter.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, companies] = await this.db.$transaction([
      this.db.company.count({ where }),
      this.db.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        select: COMPANY_SELECT,
      }),
    ]);
    return { total, companies };
  }

  async update(id: bigint, input: UpdateCompanyInput): Promise<CompanyRecord> {
    return this.db.company.update({
      where: { id },
      data: {
        name: input.name,
        customerGroupId: input.customerGroupId,
        taxExempt: input.taxExempt,
        taxExemptionRef: input.taxExemptionRef,
        gstin: input.gstin,
        billingContactName: input.billingContactName,
        billingContactEmail: input.billingContactEmail,
        billingContactPhone: input.billingContactPhone,
        updatedBy: input.updatedBy,
        version: { increment: 1 },
      },
      select: COMPANY_SELECT,
    });
  }

  async setStatus(id: bigint, status: CompanyStatus): Promise<CompanyRecord> {
    return this.db.company.update({ where: { id }, data: { status, version: { increment: 1 } }, select: COMPANY_SELECT });
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.company.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addMember(companyId: bigint, customerId: bigint, role: CompanyMemberRole): Promise<CompanyMemberRecord> {
    const row = await this.db.companyCustomer.create({
      data: { companyId, customerId, role },
      include: { customer: { select: { publicId: true, email: true } } },
    });
    return { customerId: row.customerId, customerPublicId: row.customer.publicId, customerEmail: row.customer.email, role: row.role, createdAt: row.createdAt };
  }

  async removeMember(companyId: bigint, customerId: bigint): Promise<void> {
    await this.db.companyCustomer.delete({ where: { customerId, companyId } });
  }

  async updateMemberRole(companyId: bigint, customerId: bigint, role: CompanyMemberRole): Promise<CompanyMemberRecord> {
    const row = await this.db.companyCustomer.update({
      where: { customerId, companyId },
      data: { role },
      include: { customer: { select: { publicId: true, email: true } } },
    });
    return { customerId: row.customerId, customerPublicId: row.customer.publicId, customerEmail: row.customer.email, role: row.role, createdAt: row.createdAt };
  }

  async listMembers(companyId: bigint): Promise<CompanyMemberRecord[]> {
    const rows = await this.db.companyCustomer.findMany({
      where: { companyId },
      include: { customer: { select: { publicId: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({ customerId: row.customerId, customerPublicId: row.customer.publicId, customerEmail: row.customer.email, role: row.role, createdAt: row.createdAt }));
  }

  async findMembershipByCustomerId(customerId: bigint): Promise<{ companyId: bigint; role: CompanyMemberRole } | null> {
    const row = await this.db.companyCustomer.findUnique({ where: { customerId }, select: { companyId: true, role: true } });
    return row;
  }
}
