import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Sparkles,
  Bot,
  Radar,
  Target,
  ShoppingCart,
  Package,
  FolderTree,
  Layers,
  Users,
  Tag,
  Gift,
  Award,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  FileText,
  Truck,
  SlidersHorizontal,
  PackageCheck,
  Send,
  Map,
  Undo2,
  CreditCard,
  LineChart,
  Percent,
  ClipboardList,
  Megaphone,
  Wallet,
  Workflow,
  ListChecks,
  Clock,
  ShieldCheck,
  Plug,
  Bell,
  ScrollText,
  Settings,
  Store,
  Coins,
  Receipt,
  Banknote,
  Mail,
  Landmark,
  RefreshCw,
  LayoutTemplate,
  Image,
  LayoutGrid,
  Building2,
} from 'lucide-react';

/**
 * Single source of truth for the admin nav — plan (admin UI revamp,
 * "Meridian Commerce OS" mock replication). Every consumer (the sidebar,
 * the breadcrumb, the command palette, and every `ComingSoon` placeholder
 * page) reads off THIS file, so a route's live/not-live status and its
 * description live in exactly one place.
 *
 * Phase 0/1 simplification (deliberate, documented — not an oversight):
 * the mock's `NAV_ALIAS` mechanism presents several items as CLIENT-SIDE
 * TABS of a sibling view (e.g. "Collections" is a tab of "Categories").
 * Reproducing that exactly would mean redesigning several existing real
 * pages' route structure into shared tabbed layouts — that's genuine Phase
 * 2 restyle work (see the plan's "3-sub-nav-to-Tabs migration" risk flag),
 * not something to improvise while just getting every link to resolve.
 * For now, every nav item gets its own real, distinct href: items that
 * already have a real page point straight at it (never a duplicate);
 * items the mock treats as a tab of something with NO real page yet get
 * their own standalone placeholder route at a sensible URL, so Phase 2/3
 * can later fold them into a proper tabbed layout — or not — without an
 * IA change either way.
 */

export type NavStatus = 'live' | 'comingSoon';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  status: NavStatus;
  /** One-sentence description of what this section is/will be — feeds the
   *  breadcrumb tooltip today and the ComingSoon page body for anything
   *  not live yet. */
  description: string;
  /** Only present on comingSoon items — a short list of what will actually
   *  live here once built, shown on the ComingSoon page so it reads as a
   *  real roadmap item rather than a dead end. */
  planned?: string[];
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Special styling hook for the AI group (gradient label, glow) —
   *  mirrors the mock's `ai:true` flag. */
  accent?: 'ai';
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, status: 'live', description: 'Store-wide command center — revenue, orders, and what needs attention today.' },
    ],
  },
  {
    key: 'ai',
    label: 'AI',
    icon: Sparkles,
    accent: 'ai',
    items: [
      {
        key: 'ai-insights', label: 'AI Insights', href: '/ai/insights', icon: Sparkles, status: 'live',
        description: 'Explainable, data-grounded insights generated nightly from your real business data.',
      },
      {
        key: 'ai-assistant', label: 'AI Assistant', href: '/ai/assistant', icon: Bot, status: 'comingSoon',
        description: 'Ask questions about your store in plain language and get data-backed answers.',
        planned: ['A chat interface answering questions like "what\'s my best-selling category this week?"', 'Suggested questions grounded in your actual current data', 'Direct links from an answer into the relevant report or record'],
      },
      {
        key: 'forecasting', label: 'Forecasting', href: '/ai/forecasting', icon: Radar, status: 'comingSoon',
        description: 'AI-projected demand per SKU, and which ones are at risk of stocking out.',
        planned: ['Actual-vs-projected demand charting per SKU', 'A stockout-risk ranking with predicted days-of-cover', 'One-click purchase order creation from a forecasted shortfall'],
      },
      {
        key: 'recommendations', label: 'Recommendations', href: '/ai/recommendations', icon: Target, status: 'comingSoon',
        description: 'Ranked, confidence-scored suggestions for pricing, restocking, and merchandising.',
        planned: ['A ranked list of suggested actions with an estimated impact and confidence score', 'One-click apply for the safe/reversible suggestions'],
      },
      {
        key: 'ai-settings', label: 'AI Settings', href: '/ai/settings', icon: Settings, status: 'live',
        description: 'Configure the LLM provider key (OpenAI) used by AI features.',
      },
    ],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    icon: ShoppingCart,
    items: [
      { key: 'orders', label: 'Orders', href: '/orders', icon: ShoppingCart, status: 'live', description: 'Every order across all channels and warehouses.' },
      { key: 'products', label: 'Products', href: '/products', icon: Package, status: 'live', description: 'Your product catalog — variants, pricing, media, and channel visibility.' },
      { key: 'categories', label: 'Categories', href: '/categories', icon: FolderTree, status: 'live', description: 'The category tree products are organized under.' },
      {
        key: 'collections', label: 'Collections', href: '/categories/collections', icon: Layers, status: 'comingSoon',
        description: 'Curated, named product groupings distinct from the category tree.',
        planned: ['A flat list of named collections with product counts and visibility', 'Manual and rule-based (auto) collection membership'],
      },
      { key: 'customers', label: 'Customers', href: '/customers', icon: Users, status: 'live', description: 'Everyone who has an account or has placed an order.' },
      { key: 'discounts', label: 'Discounts', href: '/coupons', icon: Tag, status: 'live', description: 'Coupon codes and their performance.' },
      { key: 'gift-cards', label: 'Gift Cards', href: '/gift-cards', icon: Gift, status: 'live', description: 'Issued gift cards, balances, and redemption history.' },
      { key: 'loyalty', label: 'Loyalty & Referrals', href: '/loyalty', icon: Award, status: 'live', description: 'Loyalty program tiers, points, and the referral program.' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    items: [
      { key: 'inventory-overview', label: 'Inventory Overview', href: '/inventory', icon: Boxes, status: 'live', description: 'Stock levels across every warehouse and SKU.' },
      { key: 'warehouses', label: 'Warehouses', href: '/inventory/warehouses', icon: Warehouse, status: 'live', description: 'Warehouse locations and their stock.' },
      {
        key: 'transfers', label: 'Transfers', href: '/inventory/transfers', icon: ArrowLeftRight, status: 'comingSoon',
        description: 'Stock moved between warehouses.',
        planned: ['Create and track transfers between warehouses, with in-transit status'],
      },
      {
        key: 'purchase-orders', label: 'Purchase Orders', href: '/inventory/purchase-orders', icon: FileText, status: 'comingSoon',
        description: 'Restock orders placed with suppliers.',
        planned: ['Create POs against a supplier, track receiving and partial fulfillment', 'Auto-draft a PO from a low-stock or forecasted-shortfall alert'],
      },
      {
        key: 'suppliers', label: 'Suppliers', href: '/inventory/suppliers', icon: Truck, status: 'comingSoon',
        description: 'The suppliers you purchase inventory from.',
        planned: ['A supplier directory with lead time, terms, and active PO count'],
      },
      { key: 'stock-adjustments', label: 'Stock Adjustments', href: '/inventory/bulk-update', icon: SlidersHorizontal, status: 'live', description: 'Manually correct on-hand stock counts.' },
    ],
  },
  {
    key: 'fulfillment',
    label: 'Fulfillment',
    icon: PackageCheck,
    items: [
      {
        key: 'pick-pack', label: 'Pick & Pack', href: '/fulfillment/pick-pack', icon: PackageCheck, status: 'comingSoon',
        description: 'The warehouse picking and packing queue.',
        planned: ['A pick list by bin location for orders ready to fulfill', 'A pack station view with package type/weight capture'],
      },
      {
        key: 'shipments', label: 'Shipments', href: '/fulfillment/shipments', icon: Send, status: 'comingSoon',
        description: 'Every shipment across every order, in one list.',
        planned: ['A cross-order shipment list with courier and tracking status', 'Sourced from the fulfillment records already created per-order today'],
      },
      {
        key: 'delivery', label: 'Delivery', href: '/fulfillment/delivery', icon: Map, status: 'comingSoon',
        description: 'Delivery status and SLA tracking across shipments.',
        planned: ['Delivered/in-transit/delayed breakdown with SLA-breach flags'],
      },
      {
        key: 'returns', label: 'Returns', href: '/fulfillment/returns', icon: Undo2, status: 'comingSoon',
        description: 'Every return request across every order, in one list.',
        planned: ['A cross-order returns list with reason, condition, and restock status', 'Sourced from the return records already created per-order today'],
      },
      {
        key: 'refunds', label: 'Refunds', href: '/fulfillment/refunds', icon: CreditCard, status: 'comingSoon',
        description: 'Every refund issued, in one list.',
        planned: ['A cross-order refund ledger, filterable by reason and method'],
      },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: LineChart,
    items: [
      { key: 'analytics-overview', label: 'Overview', href: '/reports', icon: LineChart, status: 'live', description: 'The executive summary dashboard.' },
      { key: 'analytics-sales', label: 'Sales Analytics', href: '/reports/sales', icon: LineChart, status: 'live', description: 'Revenue, discounts, tax, and shipping over time.' },
      { key: 'analytics-product', label: 'Product Analytics', href: '/reports/products', icon: Package, status: 'live', description: 'Best-sellers and category performance.' },
      { key: 'analytics-customer', label: 'Customer Analytics', href: '/reports/customers', icon: Users, status: 'live', description: 'New vs. returning customers and RFM segments.' },
      { key: 'analytics-inventory', label: 'Inventory Analytics', href: '/reports/inventory', icon: Boxes, status: 'live', description: 'Stock levels and low-stock trend over time.' },
      {
        key: 'analytics-marketing', label: 'Marketing Analytics', href: '/reports/marketing', icon: Megaphone, status: 'comingSoon',
        description: 'Channel and campaign performance.',
        planned: ['Attribution by channel/campaign — blocked on a marketing-source data model (an open question in this project\'s own analytics plan)'],
      },
      {
        key: 'analytics-financial', label: 'Financial Analytics', href: '/reports/financial', icon: Wallet, status: 'comingSoon',
        description: 'Profit & loss, margin, and cost analysis.',
        planned: ['True margin/P&L reporting — blocked on a product-cost (COGS) data source (an open question in this project\'s own analytics plan)'],
      },
      {
        key: 'reports-builder', label: 'Reports', href: '/reports/builder', icon: ClipboardList, status: 'comingSoon',
        description: 'A general-purpose report builder — pick a metric, group by, and date range.',
        planned: ['Ad hoc metric/group-by/date-range reports, saved and scheduled', 'CSV/Excel/PDF export — order export already works today from the Orders list'],
      },
    ],
  },
  {
    key: 'automation',
    label: 'Automation',
    icon: Workflow,
    items: [
      {
        key: 'workflows', label: 'Workflows', href: '/automation/workflows', icon: Workflow, status: 'comingSoon',
        description: 'Automated WHEN/IF/THEN rules that run without manual intervention.',
        planned: ['A visual workflow builder (auto-reorder on low stock, high-value order approval, delayed-shipment escalation, and similar)'],
      },
      {
        key: 'rules', label: 'Rules', href: '/automation/rules', icon: ListChecks, status: 'comingSoon',
        description: 'Standalone conditional rules outside the workflow builder.',
        planned: ['Simple condition → action rules for cases that don\'t need a full workflow'],
      },
      {
        key: 'jobs', label: 'Scheduled Jobs', href: '/automation/jobs', icon: Clock, status: 'comingSoon',
        description: 'Recurring background jobs and their run history.',
        planned: ['Visibility into this store\'s existing background jobs (reservation sweeps, analytics refresh, alert evaluation) with run history and health'],
      },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: ShieldCheck,
    items: [
      {
        key: 'users-admin', label: 'Users', href: '/system/users', icon: Users, status: 'comingSoon',
        description: 'Admin team members and their access.',
        planned: ['Invite/list/deactivate admin users', 'The underlying admin-user and role data already exists — this is a UI gap, not a data gap'],
      },
      {
        key: 'roles', label: 'Roles & Permissions', href: '/system/roles', icon: ShieldCheck, status: 'comingSoon',
        description: 'Roles and their permission grants.',
        planned: ['A role × permission matrix editor', 'Until then, use Stores > Admin Permissions to sync the Super Admin role'],
      },
      { key: 'tax', label: 'Tax', href: '/stores/tax-classes', icon: Percent, status: 'live', description: 'Tax classes and rates.' },
      {
        key: 'integrations', label: 'Integrations', href: '/system/integrations', icon: Plug, status: 'comingSoon',
        description: 'Third-party connections — payments, shipping, marketplaces, and more.',
        planned: ['A connect/manage marketplace for payment gateways, couriers, ERPs, and marketing tools'],
      },
      {
        key: 'notifications', label: 'Notifications', href: '/system/notifications', icon: Bell, status: 'comingSoon',
        description: 'A persistent notification center.',
        planned: ['A durable, filterable notification log — today\'s toasts are ephemeral, in-session only'],
      },
      {
        key: 'audit-logs', label: 'Audit Logs', href: '/system/audit-logs', icon: ScrollText, status: 'comingSoon',
        description: 'Who changed what, and when.',
        planned: ['A searchable audit trail of admin actions with before/after values'],
      },
      { key: 'settings', label: 'Settings', href: '/stores/general', icon: Settings, status: 'live', description: 'Store configuration — see the Stores section below.' },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    icon: FileText,
    items: [
      { key: 'content-pages', label: 'Pages', href: '/content/pages', icon: FileText, status: 'live', description: 'CMS pages.' },
      { key: 'content-blocks', label: 'Blocks', href: '/content/blocks', icon: LayoutTemplate, status: 'live', description: 'Reusable CMS content blocks.' },
      { key: 'content-banners', label: 'Banners', href: '/content/banners', icon: Image, status: 'live', description: 'Storefront marketing banners.' },
      { key: 'content-widgets', label: 'Widgets', href: '/content/widgets', icon: LayoutGrid, status: 'live', description: 'Placeable homepage content widgets.' },
    ],
  },
  {
    key: 'b2b',
    label: 'B2B',
    icon: Building2,
    items: [
      { key: 'companies', label: 'Companies', href: '/companies', icon: Building2, status: 'live', description: 'B2B company accounts and their members.' },
    ],
  },
  {
    key: 'stores',
    label: 'Stores',
    icon: Store,
    items: [
      { key: 'stores-general', label: 'General', href: '/stores/general', icon: Store, status: 'live', description: 'Store name, logo, and general settings.' },
      { key: 'stores-currencies', label: 'Currency Setup', href: '/stores/currencies', icon: Coins, status: 'live', description: 'Supported currencies.' },
      { key: 'stores-tax-classes', label: 'Tax Classes', href: '/stores/tax-classes', icon: Receipt, status: 'live', description: 'Tax classes and rates.' },
      { key: 'stores-shipping', label: 'Shipping Methods', href: '/stores/shipping-methods', icon: Truck, status: 'live', description: 'Available shipping methods and rates.' },
      { key: 'stores-payment', label: 'Payment Methods', href: '/stores/payment-methods', icon: Banknote, status: 'live', description: 'Available payment methods.' },
      { key: 'stores-email', label: 'Email (SMTP)', href: '/stores/email-settings', icon: Mail, status: 'live', description: 'Outbound email/SMTP configuration.' },
      { key: 'stores-gst', label: 'GST Settings', href: '/stores/gst-settings', icon: Landmark, status: 'live', description: 'GST configuration per website.' },
      { key: 'stores-wallet', label: 'Wallet Settings', href: '/stores/wallet-settings', icon: Wallet, status: 'live', description: 'Store credit / wallet configuration.' },
      { key: 'stores-search', label: 'Search Index', href: '/stores/search-index', icon: RefreshCw, status: 'live', description: 'Rebuild the storefront search index.' },
      { key: 'stores-permissions', label: 'Admin Permissions', href: '/stores/permissions', icon: ShieldCheck, status: 'live', description: 'Sync permission grants to the Super Admin role.' },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

/** The most specific href matching this pathname — same "longest match
 *  wins" logic the old icon-rail nav used, so e.g. /inventory/warehouses
 *  highlights only "Warehouses" and not also "Inventory Overview". */
export function bestMatchingNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
}

export function sectionLabelForPath(pathname: string): string {
  return bestMatchingNavItem(pathname)?.label ?? 'Dashboard';
}

export function navItemByHref(href: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.href === href);
}
