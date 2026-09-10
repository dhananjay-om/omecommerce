const WEBHOOK_TIMEOUT_MS = 5000;

export interface WebhookResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** The actual HTTP call — shared by runAction's real WEBHOOK action and
 *  TestWebhook (the admin's on-demand "Send Test" button), so a test
 *  really proves what a live rule would do, not a separate check that
 *  could drift from it. Never throws — every failure mode (unreachable
 *  host, timeout, non-2xx) comes back as a real, readable result. */
export async function postWebhook(url: string, payload: unknown): Promise<WebhookResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `webhook responded ${res.status}` };
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
