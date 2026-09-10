/** The admin performing a System > Users / Roles & Permissions mutation —
 *  resolved once at the route (auth.module.ts already has `req.adminUser`
 *  + a DB lookup for the email) and threaded into each usecase's
 *  execute(), which records it via AuditLogRepository after a successful
 *  write. `id`/`email` are both nullable for a hypothetical future
 *  system-initiated call (none exist yet). */
export interface AuditActor {
  id: bigint | null;
  email: string | null;
}
