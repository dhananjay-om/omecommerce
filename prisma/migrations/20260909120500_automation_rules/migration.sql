CREATE TABLE "automation_rule" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,

    CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_rule_public_id_key" ON "automation_rule"("public_id");
CREATE INDEX "automation_rule_trigger_type_is_active_idx" ON "automation_rule"("trigger_type", "is_active");

CREATE TABLE "automation_rule_run" (
    "id" BIGSERIAL NOT NULL,
    "rule_id" BIGINT NOT NULL,
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched" BOOLEAN NOT NULL,
    "entity_type" TEXT,
    "entity_public_id" TEXT,
    "action_results" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "automation_rule_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automation_rule_run_rule_id_triggered_at_idx" ON "automation_rule_run"("rule_id", "triggered_at");

ALTER TABLE "automation_rule_run" ADD CONSTRAINT "automation_rule_run_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
