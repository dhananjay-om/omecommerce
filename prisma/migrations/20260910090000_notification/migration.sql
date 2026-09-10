-- The admin topbar bell's persistent backing store. See notification.prisma's
-- own header comment for the "real recipient rows, fan-out at write time" design.

CREATE TABLE "notification" (
    "id" BIGSERIAL PRIMARY KEY,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "recipient_id" BIGINT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action_href" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "notification_public_id_key" ON "notification"("public_id");
CREATE INDEX "notification_recipient_id_is_read_created_at_idx" ON "notification"("recipient_id", "is_read", "created_at");
