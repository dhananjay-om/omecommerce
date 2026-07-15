-- =============================================================================
-- 0006_customer_raw.sql
-- Raw-SQL blocks for storefront Customer accounts (plan/05 §2.5). Appended
-- after the Prisma-generated DDL for customer/customer_address. Reuses
-- set_updated_at() from 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Scope/cross-context FKs (project-wide convention: kept as plain scalars in
--    Prisma, constrained here). Cart/Order.customer_id gain the FK now that
--    `customer` exists — the retrofit order.prisma's header comment already
--    earmarked ("added once that table exists", plan/02 §6.2).
--
--    Cart is ephemeral/disposable (plan/00 §4.6: partitioned + dropped), so its
--    FK is SET NULL, matching its existing cart_customer_group_fk exactly — a
--    customer deletion must never be blocked by a stale, never-converted cart.
--    Order is a permanent financial record, so its FK is RESTRICT, matching
--    Order.cart_id's existing explicit Restrict (order.prisma).
--
--    customer.website_id is RESTRICT — Customer is closer to Order in
--    permanence (registered account + order history) than to Cart; a website
--    deletion must not silently wipe out its customers.
--
--    customer.customer_group_id is SET NULL, matching cart/order's identical
--    customer_group_fk exactly.
-- -----------------------------------------------------------------------------
ALTER TABLE cart
  ADD CONSTRAINT cart_customer_id_fk FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE SET NULL;

ALTER TABLE "order"
  ADD CONSTRAINT order_customer_id_fk FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE RESTRICT;

ALTER TABLE customer
  ADD CONSTRAINT customer_website_fk        FOREIGN KEY (website_id)        REFERENCES website(id)        ON DELETE RESTRICT,
  ADD CONSTRAINT customer_customer_group_fk FOREIGN KEY (customer_group_id) REFERENCES customer_group(id) ON DELETE SET NULL;

CREATE INDEX ix_cart_customer_id ON cart (customer_id);
CREATE INDEX ix_order_customer_id ON "order" (customer_id);

-- -----------------------------------------------------------------------------
-- 1. At most one default-shipping and one default-billing address per customer
--    (defense in depth — the application also unsets the prior default in the
--    same transaction, see PrismaCustomerAddressRepository.create()). Partial
--    unique indexes, same pattern as every other invariant Prisma can't express
--    directly (e.g. order_address's one-row-per-type is a plain @@unique since
--    it has no partial condition; this one does, hence raw SQL).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_customer_address_default_shipping ON customer_address (customer_id)
  WHERE is_default_shipping AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_customer_address_default_billing ON customer_address (customer_id)
  WHERE is_default_billing AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. updated_at triggers (mutable tables only) — unconditional for every
--    mutable table in this schema, same precedent as 0005_system_raw.sql's
--    admin_user/role/permission (none of which have a raw-UPDATE path either).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer', 'customer_address'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
