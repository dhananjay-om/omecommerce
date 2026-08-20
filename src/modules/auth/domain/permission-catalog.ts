/**
 * The single source of truth for every registered permission code, and which
 * role gets them (today, that's just 'super-admin' getting all of them — no
 * other role/permission-management UI exists yet). Both `prisma/seed.ts` and
 * SyncPermissions import this same list, so a new `authorize('x:manage')`
 * call anywhere in the codebase has exactly one place to also register in —
 * no separate, driftable copy of the list to remember to update.
 *
 * Why this matters in practice: a permission added here after a database was
 * already seeded does NOT retroactively reach existing admins — seeding only
 * ever adds rows, never revokes, and an admin's JWT is only as fresh as their
 * last login. SyncPermissions (run via the admin UI's Stores > Admin
 * Permissions page, or automatically by `db:seed`) is what closes that gap;
 * the admin still needs to log out and back in afterward to get a JWT that
 * reflects the newly granted permission.
 */
export const SUPER_ADMIN_ROLE_CODE = 'super-admin';

export interface PermissionDefinition {
  code: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  { code: 'admin:manage', description: 'Create/manage admin users' },
  { code: 'orders:view', description: 'View orders, order history, and add order notes' },
  { code: 'orders:fulfill', description: 'Create shipments/fulfillments for orders' },
  { code: 'orders:refund', description: 'Issue order refunds' },
  { code: 'orders:cancel', description: 'Cancel orders' },
  { code: 'orders:invoice', description: 'Create, view, and email order invoices' },
  { code: 'orders:email', description: 'Send order-related emails to customers' },
  { code: 'orders:close', description: 'Close completed orders' },
  { code: 'orders:export', description: 'Export the order grid to CSV/Excel' },
  { code: 'inventory:adjust', description: 'Adjust warehouse stock levels' },
  { code: 'catalog:manage', description: 'Manage attribute sets, attributes, and bulk product import' },
  { code: 'cms:manage', description: 'Manage CMS pages and blocks' },
  { code: 'banner:manage', description: 'Manage marketing banners (hero slider, promo grid)' },
  { code: 'widget:manage', description: 'Manage placeable content widgets and their layout placement' },
  { code: 'wallet:manage', description: 'Manage customer wallets, store credit, and gift cards' },
  { code: 'loyalty:manage', description: 'Manage loyalty programs, tiers, and customer point balances' },
  { code: 'referral:manage', description: 'Manage referral programs' },
  { code: 'coupon:manage', description: 'Manage discount coupons' },
  { code: 'company:manage', description: 'Manage B2B companies and their members' },
];
