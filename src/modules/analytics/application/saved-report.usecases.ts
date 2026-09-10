import type { SavedReportRepository } from '../domain/saved-report.repository.js';
import { findReportMetric } from '../domain/report-metrics.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';

export interface SavedReportView {
  publicId: string;
  name: string;
  metricCode: string;
  metricLabel: string;
  rangePreset: string;
  customFromDateKey: number | null;
  customToDateKey: number | null;
  createdAt: string;
}

function toView(r: {
  publicId: string;
  name: string;
  metricCode: string;
  rangePreset: string;
  customFromDateKey: number | null;
  customToDateKey: number | null;
  createdAt: Date;
}): SavedReportView {
  return { ...r, metricLabel: findReportMetric(r.metricCode)?.label ?? r.metricCode, createdAt: r.createdAt.toISOString() };
}

export interface CreateSavedReportCommand {
  name: string;
  metricCode: string;
  rangePreset: string;
  customFromDateKey?: number | null;
  customToDateKey?: number | null;
  createdBy?: bigint | null;
}

export class CreateSavedReport {
  constructor(private readonly savedReports: SavedReportRepository) {}

  async execute(cmd: CreateSavedReportCommand): Promise<SavedReportView> {
    if (!findReportMetric(cmd.metricCode)) {
      throw new ValidationError(`Unknown report metric: ${cmd.metricCode}`);
    }
    const row = await this.savedReports.create(cmd);
    return toView(row);
  }
}

export class ListSavedReports {
  constructor(private readonly savedReports: SavedReportRepository) {}

  async execute(): Promise<SavedReportView[]> {
    const rows = await this.savedReports.list();
    return rows.map(toView);
  }
}

export class DeleteSavedReport {
  constructor(private readonly savedReports: SavedReportRepository) {}

  async execute(publicId: string): Promise<void> {
    if (!(await this.savedReports.findByPublicId(publicId))) {
      throw new NotFoundError('saved report', publicId);
    }
    await this.savedReports.delete(publicId);
  }
}
