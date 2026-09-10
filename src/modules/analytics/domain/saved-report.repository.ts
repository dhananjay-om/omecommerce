export interface SavedReportRecord {
  publicId: string;
  name: string;
  metricCode: string;
  rangePreset: string;
  customFromDateKey: number | null;
  customToDateKey: number | null;
  createdAt: Date;
}

export interface CreateSavedReportInput {
  name: string;
  metricCode: string;
  rangePreset: string;
  customFromDateKey?: number | null;
  customToDateKey?: number | null;
  createdBy?: bigint | null;
}

export interface SavedReportRepository {
  create(input: CreateSavedReportInput): Promise<SavedReportRecord>;
  list(): Promise<SavedReportRecord[]>;
  findByPublicId(publicId: string): Promise<SavedReportRecord | null>;
  delete(publicId: string): Promise<void>;
}
