'use server';

import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api-client';
import type { Notification } from '@/lib/types';

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const { count } = await apiGet<{ count: number }>('/admin/v1/notifications/unread-count');
    return count;
  } catch (err) {
    // The bell polls this every ~30s from every page — a transient
    // failure here must never surface as a crash, just show 0 for a beat.
    if (err instanceof ApiError) return 0;
    throw err;
  }
}

export async function listRecentNotifications(): Promise<Notification[]> {
  return apiGet<Notification[]>('/admin/v1/notifications?limit=10');
}

export async function markNotificationRead(publicId: string): Promise<void> {
  await apiPatch(`/admin/v1/notifications/${publicId}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiPost('/admin/v1/notifications/mark-all-read');
}
