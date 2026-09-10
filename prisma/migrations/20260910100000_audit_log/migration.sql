-- A real, generic audit trail — see audit.prisma's own header comment for
-- why this pass scopes it to System's own mutations rather than every
-- write path in the app.

CREATE TABLE "audit_log" (
    "id" BIGSERIAL PRIMARY KEY,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_id" BIGINT,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "audit_log_public_id_key" ON "audit_log"("public_id");
CREATE INDEX "audit_log_entity_type_entity_id_created_at_idx" ON "audit_log"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");
