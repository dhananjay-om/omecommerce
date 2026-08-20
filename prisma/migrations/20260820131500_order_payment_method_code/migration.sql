-- Migration: order_payment_method_code
-- Adds Order.paymentMethodCode — the PaymentMethod.code chosen at checkout,
-- snapshotted (not FK'd) exactly like the existing shipping_method_code
-- column right next to it. Needed for COD (payment_methods migration):
-- a COD order has zero PaymentTransaction rows until manually settled, so
-- without this there is nowhere to record which payment method the
-- customer actually chose.

-- AlterTable
ALTER TABLE "order" ADD COLUMN "payment_method_code" TEXT;
