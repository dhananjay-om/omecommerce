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

export interface ProductDetail {
  publicId: string;
  sku: string;
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

export interface Website {
  publicId: string;
  code: string;
  name: string;
  gstin: string | null;
  originStateCode: string | null;
  pricesIncludeTax: boolean;
  address: string | null;
  logoMediaKey: string | null;
  logoUrl: string | null;
  supportEmail: string | null;
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

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'CONFIRMED' | 'CLOSED';
export type FinancialStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED' | 'PARTIALLY_PAID' | 'FAILED';
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
export type WalletSource = 'REFUND' | 'RETURN' | 'GOODWILL' | 'TOPUP' | 'CASHBACK' | 'LOYALTY' | 'GIFTCARD_LOAD' | 'PROMO' | 'ADMIN_ADJUST' | 'REFERRAL';

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
