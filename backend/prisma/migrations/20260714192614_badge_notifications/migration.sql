-- AlterEnum
ALTER TYPE "NotifType" ADD VALUE 'BADGE';

-- CreateTable
CREATE TABLE "unlocked_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unlocked_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unlocked_badges_user_id_badge_key_key" ON "unlocked_badges"("user_id", "badge_key");

-- AddForeignKey
ALTER TABLE "unlocked_badges" ADD CONSTRAINT "unlocked_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
