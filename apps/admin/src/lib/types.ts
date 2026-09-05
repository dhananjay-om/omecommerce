export type ProductType = 'SIMPLE' | 'CONFIGURABLE' | 'BUNDLE' | 'DIGITAL' | 'VIRTUAL';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ProductVisibility = 'BOTH' | 'CATALOG' | 'SEARCH' | 'NOT_VISIBLE';

export interface ProductListItem {
  publicId: string;
  sku: string;
  name: string | null;
  type: ProductType;
  status: ProductStatus;
  createdAt: string;
  quantity: number;
  salableQuantity: number;
  thumbnailUrl: string | null;
  hasTaxClass: boolean;
}

export interface ProductList {
  total: number;
  page: number;
  pageSize: number;
  products: ProductListItem[];
}

export interface VariantAxisValue {
  attributeCode: string;
  attributeLabel: string;
  optionLabel: string;
}

export interface Variant {
  publicId: string;
  sku: string;
  status: string;
  position: number;
  axisValues: VariantAxisValue[];
}

export type ProductMediaRole = 'GALLERY' | 'THUMBNAIL' | 'SWATCH' | 'VIDEO' | 'DOCUMENT';

export interface ProductMedia {
  productMediaId: string;
  url: string;
  role: ProductMediaRole;
  position: number;
  altText: string | null;
}

export interface ProductReview {
  publicId: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  /** Resolved presigned GET URLs (900s) — a customer's own uploaded photos. */
  images: string[];
  isApproved: boolean;
  createdAt: string;
}

/** Cross-product admin queue row (GET /admin/v1/reviews) — the same shape
 *  as ProductReview, plus which product it belongs to. */
export interface AdminReviewListItem extends ProductReview {
  productPublicId: string;
  productName: string;
}

export interface PaginatedAdminReviews {
  total: number;
  page: number;
  pageSize: number;
  reviews: AdminReviewListItem[];
}

export interface ProductDetail {
  publicId: string;
  sku: string;
  /** Storefront canonical URL is /{slug}.html — auto-generated once at creation, never editable afterward. */
  slug: string;
  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  name: string | null;
  weight: string | null;
  attributeSetId: string;
  taxClassId: string | null;
  hsnCode: string | null;
  variants: Variant[];
  attributes: Record<string, unknown>;
  categoryIds: string[];
  media: ProductMedia[];
  tags: string[];
}

/** AI Product Assistant (product edit page) response shapes — mirrors
 *  src/modules/ai/infrastructure/product-assistant-openai.ts's own return
 *  types exactly. */
export interface ProductImageAnalysis {
  title: string;
  description: string;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  dominantColor: string;
  productTypeGuess: string;
}

export interface ProductPriceSuggestion {
  suggestedPrice: number;
  rationale: string;
}

export interface ProductCategorySuggestion {
  category: string;
  rationale: string;
}

export interface ProductAttributeSuggestion {
  code: string;
  label: string;
  suggestedValue: string;
}

export type CategoryType = 'MANUAL' | 'DYNAMIC';
export type CategorySortMode = 'POSITION' | 'NAME' | 'PRICE' | 'NEWEST';

export interface Category {
  publicId: string;
  parentId: string | null;
  slug: string;
  type: CategoryType;
  sortMode: CategorySortMode;
  position: number;
  nameDefault: string | null;
  description: string | null;
  imageMediaKey: string | null;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  includeInMenu: boolean;
  createdAt: string;
}

export interface Brand {
  publicId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface AttributeSet {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
}

export type AttributeDataType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'COLOR'
  | 'SELECT'
  | 'MULTISELECT'
  | 'IMAGE'
  | 'FILE'
  | 'URL'
  | 'EMAIL'
  | 'PHONE'
  | 'JSON'
  | 'RICHTEXT'
  | 'REF_PRODUCT'
  | 'REF_CATEGORY'
  | 'REF_BRAND'
  | 'REF_CMS'
  | 'REF_COLLECTION'
  | 'REF_CUSTOMER';

export interface AttributeOption {
  /** The AttributeOption row's own id — SELECT attribute values are submitted/read as this id, not `value` below. */
  id: string;
  value: string;
  label: string;
  swatch: string | null;
  sortOrder: number;
}

export interface AttributeSetAttribute {
  code: string;
  label: string;
  dataType: AttributeDataType;
  isRequired: boolean;
  isVariantForming: boolean;
  sortOrder: number;
  options: AttributeOption[];
}

export interface AttributeSetGroupDetail {
  id: string;
  name: string;
  sortOrder: number;
  attributes: AttributeSetAttribute[];
}

export interface AttributeSetDetail extends AttributeSet {
  groups: AttributeSetGroupDetail[];
}

export type AttributeInputType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DECIMAL'
  | 'SWITCH'
  | 'DATE'
  | 'DATETIME'
  | 'COLOR_PICKER'
  | 'DROPDOWN'
  | 'MULTISELECT'
  | 'IMAGE_PICKER'
  | 'FILE_UPLOAD'
  | 'RICHTEXT'
  | 'URL'
  | 'EMAIL'
  | 'PHONE'
  | 'JSON_EDITOR'
  | 'REFERENCE';

/** The reusable-attribute library (plan/13 Phase L) — one row per Attribute definition, independent of any set. */
export interface Attribute {
  id: string;
  code: string;
  label: string;
  dataType: AttributeDataType;
  inputType: AttributeInputType;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isComparable: boolean;
  isSortable: boolean;
  isVisiblePdp: boolean;
  isVisiblePlp: boolean;
  usedInSearch: boolean;
  usedInLayeredNav: boolean;
  isVariantForming: boolean;
}

export type WarehouseType = 'PHYSICAL' | 'VIRTUAL' | 'DROPSHIP';

export interface Warehouse {
  publicId: string;
  code: string;
  name: string;
  type: WarehouseType;
  priority: number;
  isActive: boolean;
}

export interface WarehouseStockItem {
  variantPublicId: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
}

/** Row-level result of a bulk stock (or product) import job — same shape
 *  for both job types, matching the backend's BulkStockRowError/
 *  BulkImportRowError. */
export interface BulkJobRowError {
  row: number;
  sku: string;
  message: string;
}

export interface BulkJobResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: BulkJobRowError[];
}

/** Result shape of the Magento-style "Add/Update" product CSV import job —
 *  created/updated instead of a single succeeded count, since telling the
 *  two apart matters to an admin reviewing the outcome. */
export interface BulkProductImportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: BulkJobRowError[];
}

/** Mirrors GET /admin/v1/jobs/:jobId's response — the generic BullMQ
 *  job-status reader shared by every job type on the bulk-jobs queue.
 *  Generic over the result shape since different job types return
 *  different summary fields (BulkJobResult vs BulkProductImportResult). */
export interface BulkJobStatus<TResult = BulkJobResult> {
  jobId: string;
  status: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed' | 'paused' | 'unknown' | string;
  progress: number | object;
  result?: TResult;
  error?: string;
}

export interface CustomerGroup {
  publicId: string;
  code: string;
  name: string;
  isDefault: boolean;
}

export type PriceListType = 'BASE' | 'WHOLESALE' | 'B2B' | 'SPECIAL';

export interface PriceList {
  publicId: string;
  code: string;
  name: string;
  currency: string;
  type: PriceListType;
  priority: number;
  isActive: boolean;
}

/** One price list's price for a single variant — powers the product-edit page's Pricing & Inventory section. */
export interface VariantPrice {
  priceListCode: string;
  priceListName: string;
  currency: string;
  price: string | null;
  /** "MRP" / compare-at price — shown as a strikethrough next to `price` when set. */
  mrp: string | null;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  minorUnits: number;
  isDefault: boolean;
}

export interface TaxClass {
  id: string;
  publicId: string;
  code: string;
  name: string;
  /** Combined GST rate as a fraction string, e.g. "0.1800" for 18%. */
  rate: string;
  isActive: boolean;
}

export interface ShippingMethod {
  publicId: string;
  code: string;
  name: string;
  flatRate: string;
  currency: string;
  isActive: boolean;
}

export interface Pincode {
  publicId: string;
  code: string;
  city: string;
  state: string;
  estimatedDays: number;
  codAvailable: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface PincodeList {
  total: number;
  page: number;
  pageSize: number;
  pincodes: Pincode[];
}

export interface BulkUpsertPincodesResult {
  total: number;
  created: number;
  updated: number;
}

export type PaymentMethodType = 'COD' | 'ONLINE';

export interface PaymentMethod {
  publicId: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  isActive: boolean;
}

export interface Website {
  publicId: string;
  code: string;
  name: string;
  baseCurrency: string;
  gstin: string | null;
  originStateCode: string | null;
  pricesIncludeTax: boolean;
  address: string | null;
  logoMediaKey: string | null;
  logoUrl: string | null;
  supportEmail: string | null;
  walletEnabled: boolean;
  walletMaxPercentOfOrder: string | null;
  walletMinOrderValue: string | null;
  walletMaxAmountPerOrder: string | null;
}

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CouponTargetType = 'CART' | 'ITEM';
export type CouponConditionType = 'PRODUCT' | 'CATEGORY' | 'ATTRIBUTE';

export interface CouponConditionView {
  conditionType: CouponConditionType;
  productId: string | null;
  productName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  attributeCode: string | null;
  attributeLabel: string | null;
  attributeValue: string | null;
  attributeValueLabel: string | null;
}

export interface Coupon {
  publicId: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  value: string;
  currency: string | null;
  minSubtotal: string | null;
  targetType: CouponTargetType;
  isAutoApply: boolean;
  conditions: CouponConditionView[];
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

/** One warehouse's stock for a single variant — every active warehouse appears, zeroed if never stocked. */
export interface VariantStock {
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
}

export type OrderStatus =
  'PENDING' | 'PROCESSING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'CONFIRMED' | 'CLOSED';
export type FinancialStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'VOIDED'
  | 'PARTIALLY_PAID'
  | 'FAILED';
export type FulfillmentStatus = 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'RETURNED';

export interface OrderListItem {
  publicId: string;
  orderNumber: string;
  email: string;
  /** plan/15 Phase 0c — the billing address's snapshotted name, falls back to email. */
  customerName: string;
  /** Most recent payment transaction's method, or null if none recorded yet. */
  paymentMethod: string | null;
  currency: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  grandTotal: string;
  createdAt: string;
}

export interface OrderList {
  total: number;
  page: number;
  pageSize: number;
  orders: OrderListItem[];
}

export interface OrderLine {
  sku: string;
  name: string;
  qty: number;
  unitPrice: string;
  /** "MRP" / compare-at price snapshotted at checkout time — null when the resolved price had none. */
  mrp: string | null;
  taxAmount: string;
  discountAmount: string;
  rowTotal: string;
  taxClassCode: string | null;
  hsnCode: string | null;
  fulfilledQty: number;
  refundedQty: number;
}

export interface OrderAddress {
  type: 'BILLING' | 'SHIPPING';
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  stateCode: string | null;
  gstin: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
}

export interface OrderTaxLine {
  taxClassCode: string;
  taxType: 'CGST' | 'SGST' | 'IGST' | null;
  rate: string;
  amount: string;
}

export interface OrderPayment {
  method: string;
  gateway: string;
  type: 'AUTHORIZE' | 'CAPTURE' | 'REFUND' | 'VOID';
  amount: string;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  gatewayRef: string | null;
  createdAt: string;
}

export interface OrderFulfillmentLine {
  sku: string;
  qty: number;
}

export interface OrderFulfillment {
  publicId: string;
  status: 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'PACKED';
  trackingNumber: string | null;
  carrier: string | null;
  carrierTrackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  currentStatus: string | null;
  shippingNotes: string | null;
  hasPackingSlip: boolean;
  shippedAt: string | null;
  createdAt: string;
  lines: OrderFulfillmentLine[];
}

export interface OrderReturnLine {
  sku: string;
  qty: number;
  restock: boolean;
}

export interface OrderReturn {
  publicId: string;
  reason: string;
  status: string;
  createdAt: string;
  lines: OrderReturnLine[];
}

export interface OrderNote {
  id: string;
  type: 'INTERNAL' | 'CUSTOMER';
  body: string;
  createdAt: string;
}

export interface OrderInvoiceLine {
  sku: string;
  qty: number;
  unitPrice: string;
  taxAmount: string;
  rowTotal: string;
}

export interface OrderInvoice {
  publicId: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'ISSUED';
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  createdAt: string;
  lines: OrderInvoiceLine[];
}

export interface OrderHistoryEntry {
  id: string;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  message: string | null;
  actorType: 'ADMIN' | 'SYSTEM' | 'CUSTOMER';
  actorName: string | null;
  createdAt: string;
}

export interface OrderEmailLogEntry {
  id: string;
  emailType: string;
  toEmail: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  createdAt: string;
}

export interface OrderDetail {
  publicId: string;
  orderNumber: string;
  email: string;
  currency: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
  shippingMethodCode: string | null;
  paymentMethodCode: string | null;
  couponCode: string | null;
  customerIp: string | null;
  placedAt: string;
  closedAt: string | null;
  /** plan/reflective-prancing-sonnet Phase 6 (B2B) — tax-exempt orders (company purchase orders). */
  taxExempt: boolean;
  poNumber: string | null;
  companyPublicId: string | null;
  companyName: string | null;
  lines: OrderLine[];
  addresses: OrderAddress[];
  taxLines: OrderTaxLine[];
  payments: OrderPayment[];
  fulfillments: OrderFulfillment[];
  returns: OrderReturn[];
  notes: OrderNote[];
  invoices: OrderInvoice[];
}

export interface CustomerListItem {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerList {
  total: number;
  page: number;
  pageSize: number;
  customers: CustomerListItem[];
}

export interface CustomerAddress {
  publicId: string;
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface CustomerDetail {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  addresses: CustomerAddress[];
}

export type CmsStatus = 'DRAFT' | 'PUBLISHED';

export interface CmsPage {
  publicId: string;
  handle: string;
  title: string;
  body: string;
  status: CmsStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface CmsBlock {
  publicId: string;
  code: string;
  body: string;
  status: CmsStatus;
  updatedAt: string;
}

export type BannerGroup = 'HERO' | 'PROMO';

export interface Banner {
  publicId: string;
  group: BannerGroup;
  title: string;
  subtitle: string | null;
  imageMediaKey: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  gradient: string | null;
  position: number;
  isActive: boolean;
  updatedAt: string;
}

export type WidgetType =
  | 'CMS_BLOCK'
  | 'HERO_BANNER_SLIDER'
  | 'PROMO_BANNER_GRID'
  | 'CATEGORY_GRID'
  | 'BRAND_GRID'
  | 'WHY_CHOOSE_US_LIST'
  | 'TESTIMONIAL_LIST';

export type WidgetSection = 'TOP' | 'MIDDLE' | 'FOOTER';

export interface WidgetInstance {
  publicId: string;
  type: WidgetType;
  page: string;
  section: WidgetSection;
  position: number;
  title: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
  customCss: string | null;
  updatedAt: string;
}

export type WalletStatus = 'ACTIVE' | 'FROZEN';
export type WalletBucket = 'STORE_CREDIT' | 'PREPAID_TOPUP' | 'CASHBACK' | 'LOYALTY_CONVERSION';
export type WalletTxnType = 'CREDIT' | 'DEBIT' | 'ADJUST' | 'EXPIRE';
export type WalletSource =
  | 'REFUND'
  | 'RETURN'
  | 'GOODWILL'
  | 'TOPUP'
  | 'CASHBACK'
  | 'LOYALTY'
  | 'GIFTCARD_LOAD'
  | 'PROMO'
  | 'ADMIN_ADJUST'
  | 'REFERRAL';

export interface WalletView {
  publicId: string;
  balance: string;
  currency: string;
  status: WalletStatus;
}

export interface WalletTransaction {
  bucket: WalletBucket;
  type: WalletTxnType;
  amount: string;
  balanceAfter: string;
  currency: string;
  source: WalletSource;
  reason: string | null;
  createdAt: string;
}

export type GiftCardStatus = 'ACTIVE' | 'REDEEMED' | 'EXPIRED' | 'DISABLED' | 'PENDING';
export type GiftCardKind = 'DIGITAL' | 'PHYSICAL';
export type GiftCardTxnType = 'ISSUE' | 'REDEEM' | 'REFUND' | 'ADJUST' | 'VOID' | 'EXPIRE';

export interface GiftCard {
  publicId: string;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
  kind: GiftCardKind;
  expiresAt: string | null;
}

export interface GiftCardListItem {
  publicId: string;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
  kind: GiftCardKind;
  recipientEmail: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GiftCardList {
  total: number;
  page: number;
  pageSize: number;
  giftCards: GiftCardListItem[];
}

/** Only ever seen once, right after issuance — the raw redeemable code is never
 *  stored server-side (only its hash), so this is the sole place it appears. */
export interface IssuedGiftCard {
  publicId: string;
  code: string;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
}

export interface GiftCardTransaction {
  type: GiftCardTxnType;
  amount: string;
  balanceAfter: string;
  currency: string;
  reason: string | null;
  createdAt: string;
}

export type LoyaltyProgramStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';
export type LoyaltyTxnType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST' | 'REVERSE';
export type LoyaltySource = 'ORDER' | 'ADMIN' | 'CUSTOMER' | 'EXPIRE' | 'REVERSAL' | 'REFERRAL';

export interface LoyaltyProgram {
  publicId: string;
  websiteCode: string;
  name: string;
  status: LoyaltyProgramStatus;
  pointsPerCurrencyUnit: string;
  pointValue: string;
  redeemMinPoints: number;
  pointsExpiryMonths: number | null;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  thresholdPoints: string;
  earnMultiplier: string;
  sortOrder: number;
}

export interface LoyaltyAccount {
  publicId: string;
  pointsBalance: string;
  lifetimePoints: string;
  tier: LoyaltyTier | null;
  status: WalletStatus;
}

export interface LoyaltyTransaction {
  type: LoyaltyTxnType;
  points: string;
  balanceAfter: string;
  source: LoyaltySource;
  reason: string | null;
  createdAt: string;
}

export type ReferralQualifyingEvent = 'SIGNUP' | 'FIRST_ORDER';
export type ReferralRewardType = 'STORE_CREDIT' | 'POINTS';
export type ReferralStatus = 'SIGNED_UP' | 'QUALIFIED' | 'REWARDED' | 'EXPIRED' | 'REVERSED';
export type ReferralBeneficiary = 'REFERRER' | 'REFEREE';

export interface ReferralProgram {
  publicId: string;
  websiteCode: string;
  name: string;
  status: LoyaltyProgramStatus;
  qualifyingEvent: ReferralQualifyingEvent;
  minOrderAmount: string | null;
  referrerRewardType: ReferralRewardType;
  referrerRewardAmount: string | null;
  referrerRewardPoints: string | null;
  refereeRewardType: ReferralRewardType;
  refereeRewardAmount: string | null;
  refereeRewardPoints: string | null;
  maxReferralsPerCustomer: number | null;
  attributionWindowDays: number | null;
}

export interface ReferralReward {
  beneficiary: ReferralBeneficiary;
  rewardType: ReferralRewardType;
  amount: string | null;
  points: string | null;
}

export interface ReferralView {
  publicId: string;
  status: ReferralStatus;
  createdAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  referrerReward: ReferralReward | null;
}

export interface MyReferrals {
  code: string;
  referrals: ReferralView[];
}

export interface AdminReferralListItem {
  publicId: string;
  referrerEmail: string;
  refereeEmail: string;
  status: ReferralStatus;
  createdAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  referrerReward: ReferralReward | null;
  refereeReward: ReferralReward | null;
}

export interface AdminReferralList {
  total: number;
  page: number;
  pageSize: number;
  referrals: AdminReferralListItem[];
}

/** plan/reflective-prancing-sonnet Phase 6 — B2B Company support. */
export type CompanyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type CompanyMemberRole = 'ADMIN' | 'BUYER';

export interface Company {
  publicId: string;
  websiteCode: string;
  code: string;
  name: string;
  status: CompanyStatus;
  customerGroupCode: string | null;
  customerGroupName: string | null;
  taxExempt: boolean;
  taxExemptionRef: string | null;
  gstin: string | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  billingContactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyListItem {
  publicId: string;
  code: string;
  name: string;
  status: CompanyStatus;
  createdAt: string;
}

export interface CompanyList {
  total: number;
  page: number;
  pageSize: number;
  companies: CompanyListItem[];
}

export interface CompanyMember {
  customerPublicId: string;
  email: string;
  role: CompanyMemberRole;
  createdAt: string;
}

/** plan/reflective-prancing-sonnet Phase 7 — B2B Net-X credit terms (pay on account + settlement). */
export type CreditTermsType = 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60';
export type CompanyCreditTxnType = 'CHARGE' | 'PAYMENT' | 'ADJUST' | 'WRITE_OFF';

export interface CompanyCreditAccountView {
  publicId: string;
  creditLimit: string;
  outstanding: string;
  /** creditLimit - outstanding, never negative. */
  available: string;
  currency: string;
  termsType: CreditTermsType;
  status: 'ACTIVE' | 'FROZEN';
}

export interface CompanyCreditTransactionView {
  type: CompanyCreditTxnType;
  /** Signed: CHARGE/positive ADJUST positive, PAYMENT/WRITE_OFF/negative ADJUST negative. */
  amount: string;
  outstandingAfter: string;
  currency: string;
  /** ISO date, only set on CHARGE rows. */
  dueAt: string | null;
  reason: string | null;
  createdAt: string;
}

export type AgingBucketLabel = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export interface OpenInvoiceView {
  orderPublicId: string;
  orderNumber: string;
  amount: string;
  currency: string;
  dueAt: string | null;
  createdAt: string;
  daysOverdue: number;
  bucket: AgingBucketLabel;
}

export interface AgingReportView {
  /** Total amount per bucket. */
  buckets: Record<AgingBucketLabel, string>;
  invoices: OpenInvoiceView[];
}

/** GET /admin/v1/email-settings — never carries the real password, only
 *  whether one is set (see GetEmailSettings' own doc comment). */
export interface EmailSettings {
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
  fromName: string | null;
  fromEmail: string | null;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Analytics & Reporting (plan/19) — GET /admin/v1/analytics/*. Every row shape
// here mirrors src/modules/analytics/domain/queries.ts exactly. BigInt ids
// (productId/categoryId/variantId/warehouseId/customerId/websiteId) arrive as
// strings — the backend installs a global BigInt.prototype.toJSON (see
// src/shared/interface/http/serialization.ts), confirmed via live curl, not
// assumed. Every date-range endpoint requires BOTH dateFrom and dateTo
// ("YYYY-MM-DD"), never optional — see interface/http/schemas.ts.
// ---------------------------------------------------------------------------

export interface SalesDailyRow {
  dateKey: number;
  websiteId: string;
  currency: string;
  grossRevenue: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  refundTotal: string;
  netRevenue: string;
  orderCount: number;
  unitsSold: number;
  newCustomerCount: number;
}

export interface OrderStatusRow {
  dateKey: number;
  status: string;
  orderCount: number;
}

export interface ProductPerformanceRow {
  productId: string;
  productName: string | null;
  sku: string | null;
  unitsSold: number;
  revenue: string;
  orderCount: number;
}

export interface CategoryPerformanceRow {
  categoryId: string;
  categoryName: string | null;
  unitsSold: number;
  revenue: string;
}

export interface PaymentMethodRow {
  method: string;
  gateway: string;
  successCount: number;
  failedCount: number;
  successAmount: string;
  refundedAmount: string;
}

export interface ReturnDailyRow {
  dateKey: number;
  returnCount: number;
  returnQty: number;
  returnAmount: string;
}

export interface FulfillmentDailyRow {
  dateKey: number;
  ordersProcessed: number;
  avgProcessingHours: string | null;
  avgShippingHours: string | null;
  avgDeliveryHours: string | null;
}

export interface InventorySnapshotRow {
  variantId: string;
  sku: string | null;
  productName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number | null;
}

export interface RfmSegmentCount {
  segment: string;
  customerCount: number;
}

export interface ReconciliationRow {
  dateKey: number;
  tableName: string;
  expectedCount: number;
  actualCount: number;
  diffCount: number;
  diffAmount: string | null;
}

export interface CustomerActivityRow {
  dateKey: number;
  newCustomers: number;
  returningCustomers: number;
  totalOrders: number;
  totalRevenue: string;
}

export interface TopCustomerRow {
  customerId: string;
  email: string | null;
  name: string | null;
  ordersPlaced: number;
  revenue: string;
}

export interface InventoryTrendRow {
  dateKey: number;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  lowStockCount: number;
}

/** Fixed vocabulary — mirrors src/modules/analytics/application/alert-rule.usecases.ts's
 *  ALERT_METRIC_CODES/ALERT_COMPARATORS exactly. */
export type AlertMetricCode = 'REVENUE_DROP' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PAYMENT_FAILURE_RATE' | 'RETURN_RATE' | 'ORDER_STUCK';
export type AlertComparator = 'gt' | 'lt' | 'gte' | 'lte';

export interface AlertRuleView {
  publicId: string;
  metricCode: AlertMetricCode;
  comparator: AlertComparator;
  thresholdValue: string;
  windowDays: number;
  recipientEmails: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface AlertHistoryView {
  firedAt: string;
  metricValue: string;
  thresholdValue: string;
  message: string;
  notifiedAt: string | null;
}

export interface AiInsight {
  publicId: string;
  dateKey: number;
  category: string;
  impact: 'high' | 'medium' | 'low';
  headline: string;
  actionLabel: string;
  actionHref: string;
  createdAt: string;
}

export interface AiInsightList {
  total: number;
  page: number;
  pageSize: number;
  insights: AiInsight[];
}

export interface AiSettings {
  provider: string;
  model: string;
  hasApiKey: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatToolLink {
  tool: string;
  label: string;
  href: string;
}

export interface ChatResult {
  message: string;
  toolsUsed: ChatToolLink[];
}

export interface ProductForecast {
  publicId: string;
  dateKey: number;
  productId: string;
  productPublicId: string | null;
  productName: string | null;
  sku: string | null;
  avgDailySellRate: string;
  trendPct: string | null;
  currentStock: number;
  daysOfCover: string | null;
  riskTier: 'high' | 'medium' | 'low';
}

export interface ProductForecastList {
  total: number;
  page: number;
  pageSize: number;
  forecasts: ProductForecast[];
}

export interface MerchandisingSuggestion {
  publicId: string;
  dateKey: number;
  kind: 'RESTOCK' | 'PROMOTE_SLOW_MOVER' | 'FEATURE_TRENDING_CATEGORY';
  targetType: 'PRODUCT' | 'CATEGORY';
  targetName: string | null;
  headline: string;
  rationale: string;
  impactScore: string;
  confidence: 'high' | 'medium' | 'low';
  actionLabel: string;
  actionHref: string;
}

export interface MerchandisingSuggestionList {
  total: number;
  page: number;
  pageSize: number;
  suggestions: MerchandisingSuggestion[];
}

export type MigrationChannel = 'SHOPIFY' | 'MAGENTO';
export type MigrationRunStatus = 'ANALYZING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface MigrationConnection {
  channel: MigrationChannel;
  storeUrl: string;
  hasApiToken: boolean;
  isActive: boolean;
  lastTestedAt: string | null;
  updatedAt: string;
}

export interface MigrationPlan {
  summary: string;
  totalProducts: number;
  categoryPlan: Array<{ name: string; action: 'CREATE' | 'MATCH_EXISTING'; matchedCategoryName?: string }>;
  attributePlan: Array<{ sourceOptionName: string; action: 'CREATE' | 'MATCH_EXISTING'; matchedAttributeCode?: string; newAttributeCode?: string; sampleValues?: string[] }>;
  attributeSetPlan: Array<{ sourceProductType: string; action: 'CREATE' | 'MATCH_EXISTING'; matchedAttributeSetCode?: string; newAttributeSetCode?: string }>;
  warnings: string[];
}

export interface MigrationRunResult {
  categoriesCreated: number;
  attributesCreated: number;
  attributeSetsCreated: number;
  productsCreated: number;
  variantsCreated: number;
  imagesAttached: number;
  skipped: Array<{ sku: string | null; externalId: string; reason: string }>;
  failed: Array<{ sku: string | null; externalId: string; reason: string }>;
  fatalError?: string;
}

/** AnalyzeCustomers' output — no attribute/category mapping, since a
 *  customer record has no such ambiguity (see that use case's own doc
 *  comment on why no AI call is involved). */
export interface CustomerMigrationPlan {
  summary: string;
  totalCustomers: number;
  sampleSize: number;
  duplicateEmailsInSample: number;
  customersWithoutEmailInSample: number;
  warnings: string[];
}

export interface CustomerMigrationRunResult {
  customersCreated: number;
  addressesCreated: number;
  skipped: Array<{ email: string | null; externalId: string; reason: string }>;
  failed: Array<{ email: string | null; externalId: string; reason: string }>;
  fatalError?: string;
}

/** AnalyzeOrders' output — same "no AI needed" reasoning as
 *  CustomerMigrationPlan. */
export interface OrderMigrationPlan {
  summary: string;
  totalOrders: number;
  sampleSize: number;
  ordersWithUnmatchedLinesInSample: number;
  ordersWithNoMatchableLinesInSample: number;
  oldestOrderDate: string | null;
  newestOrderDate: string | null;
  warnings: string[];
}

export interface OrderMigrationRunResult {
  ordersCreated: number;
  lineItemsImported: number;
  lineItemsSkipped: number;
  skipped: Array<{ orderNumber: string | null; externalId: string; reason: string }>;
  failed: Array<{ orderNumber: string | null; externalId: string; reason: string }>;
  fatalError?: string;
}

export interface MigrationRun {
  publicId: string;
  channel: MigrationChannel;
  dataType: string;
  status: MigrationRunStatus;
  totalItems: number | null;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  /** Shaped by `dataType` — a CATALOG run's plan/result vs. a CUSTOMER
   *  run's. Each migration page only ever fetches its own dataType, so the
   *  client component there narrows with an `as` the same way it already
   *  does when reading typed JSON off the wire elsewhere in this app. */
  plan: MigrationPlan | CustomerMigrationPlan | OrderMigrationPlan | null;
  result: MigrationRunResult | CustomerMigrationRunResult | OrderMigrationRunResult | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
