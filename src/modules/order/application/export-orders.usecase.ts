import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import type { OrderRepository } from '../domain/repositories.js';
import type { OrderStatus, FinancialStatus, FulfillmentStatus } from '@prisma/client';
import { endOfDayIfDateOnly } from './list-orders.usecase.js';

/**
 * plan/15 §1.5 decision: csv-stringify for CSV, exceljs for Excel (Excel
 * needs real cell formatting — a currency column — that plain CSV can't
 * express). Reuses ListOrders' exact filter set so "export what you're
 * looking at" matches the grid 1:1.
 *
 * No-silent-cap: exports are bounded at MAX_EXPORT_ROWS — an export beyond
 * that is truncated and `truncated: true` is returned so the caller can
 * surface it, rather than silently dropping rows with no signal.
 */
const MAX_EXPORT_ROWS = 10_000;

const COLUMNS = ['Order #', 'Email', 'Customer Name', 'Payment Method', 'Status', 'Financial Status', 'Fulfillment Status', 'Grand Total', 'Currency', 'Created At'];

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportOrdersQuery {
  status?: OrderStatus;
  financialStatus?: FinancialStatus;
  fulfillmentStatus?: FulfillmentStatus;
  email?: string;
  orderId?: string;
  customerName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportOrdersResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
  truncated: boolean;
}

export class ExportOrders {
  constructor(private readonly orders: OrderRepository) {}

  async execute(query: ExportOrdersQuery, format: ExportFormat): Promise<ExportOrdersResult> {
    const result = await this.orders.list({
      ...query,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? endOfDayIfDateOnly(query.dateTo) : undefined,
      page: 1,
      pageSize: MAX_EXPORT_ROWS,
    });
    const truncated = result.total > result.orders.length;
    const rows = result.orders.map((o) => [
      o.orderNumber,
      o.email,
      o.customerName,
      o.paymentMethod ?? '',
      o.status,
      o.financialStatus,
      o.fulfillmentStatus,
      o.grandTotal,
      o.currency,
      o.createdAt.toISOString(),
    ]);

    if (format === 'csv') {
      const csv = stringify([COLUMNS, ...rows]);
      return { buffer: Buffer.from(csv), contentType: 'text/csv', filename: 'orders.csv', truncated };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');
    sheet.columns = COLUMNS.map((header) => ({ header, width: 18 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
    const gradTotalColIdx = COLUMNS.indexOf('Grand Total') + 1;
    sheet.getColumn(gradTotalColIdx).numFmt = '#,##0.0000';
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'orders.xlsx',
      truncated,
    };
  }
}
