CREATE TABLE "job_run_log" (
    "id" BIGSERIAL NOT NULL,
    "job_name" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "job_run_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_run_log_job_name_started_at_idx" ON "job_run_log"("job_name", "started_at");
