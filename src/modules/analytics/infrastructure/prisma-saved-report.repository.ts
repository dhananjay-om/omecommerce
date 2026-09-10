import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { SavedReportRepository, SavedReportRecord, CreateSavedReportInput } from '../domain/saved-report.repository.js';

const SELECT = {
  publicId: true,
  name: true,
  metricCode: true,
  rangePreset: true,
  customFromDateKey: true,
  customToDateKey: true,
  createdAt: true,
} as const;

export class PrismaSavedReportRepository implements SavedReportRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateSavedReportInput): Promise<SavedReportRecord> {
    return this.db.savedReport.create({
      data: {
        name: input.name,
        metricCode: input.metricCode,
        rangePreset: input.rangePreset,
        customFromDateKey: input.customFromDateKey,
        customToDateKey: input.customToDateKey,
        createdBy: input.createdBy,
      },
      select: SELECT,
    });
  }

  async list(): Promise<SavedReportRecord[]> {
    return this.db.savedReport.findMany({ select: SELECT, orderBy: { createdAt: 'desc' } });
  }

  async findByPublicId(publicId: string): Promise<SavedReportRecord | null> {
    return this.db.savedReport.findFirst({ where: { publicId }, select: SELECT });
  }

  async delete(publicId: string): Promise<void> {
    await this.db.savedReport.delete({ where: { publicId } });
  }
}
