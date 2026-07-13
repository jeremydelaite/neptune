-- CreateTable
CREATE TABLE "avatar_reports" (
    "id" TEXT NOT NULL,
    "reported_user_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avatar_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avatar_reports_reported_user_id_reporter_id_key" ON "avatar_reports"("reported_user_id", "reporter_id");

-- AddForeignKey
ALTER TABLE "avatar_reports" ADD CONSTRAINT "avatar_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_reports" ADD CONSTRAINT "avatar_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
