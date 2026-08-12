-- Order Management Enhancement, Phase 2 (plan/15): shipment_tracking — a
-- first-class, queryable tracking record per Fulfillment (carrier deep-link,
-- ETA, the carrier's own free-text status, shipping notes, packing-slip PDF).
-- Hand-written (not `prisma migrate dev`-generated) — same reason as every
-- prior migration in this project.

CREATE TABLE "shipment_tracking" (
    "id" BIGSERIAL NOT NULL,
    "fulfillment_id" BIGINT NOT NULL,
    "carrier" TEXT,
    "carrier_tracking_url" TEXT,
    "estimated_delivery_at" TIMESTAMPTZ(6),
    "current_status" TEXT,
    "shipping_notes" TEXT,
    "packing_slip_storage_key" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_tracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipment_tracking_fulfillment_id_key" ON "shipment_tracking"("fulfillment_id");

ALTER TABLE "shipment_tracking" ADD CONSTRAINT "shipment_tracking_fulfillment_id_fkey"
  FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- updated_at trigger — shipment_tracking is mutable-in-place (a shipment's
-- tracking gets updated as the carrier's status changes), unlike Fulfillment
-- itself which stays append-only (see 0004_order_raw.sql §3's comment).
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "shipment_tracking"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
