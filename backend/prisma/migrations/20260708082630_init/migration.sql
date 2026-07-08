-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('TO_WATCH', 'WATCHING', 'COMPLETED', 'DROPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "status" "TrackStatus" NOT NULL DEFAULT 'TO_WATCH',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watched_episodes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tmdb_show_id" INTEGER NOT NULL,
    "season_number" INTEGER NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "runtime_min" INTEGER,
    "watched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watched_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "tracked_items_user_id_status_idx" ON "tracked_items"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_items_user_id_tmdb_id_media_type_key" ON "tracked_items"("user_id", "tmdb_id", "media_type");

-- CreateIndex
CREATE INDEX "watched_episodes_user_id_tmdb_show_id_idx" ON "watched_episodes"("user_id", "tmdb_show_id");

-- CreateIndex
CREATE UNIQUE INDEX "watched_episodes_user_id_tmdb_show_id_season_number_episode_key" ON "watched_episodes"("user_id", "tmdb_show_id", "season_number", "episode_number");

-- CreateIndex
CREATE INDEX "ratings_tmdb_id_media_type_idx" ON "ratings"("tmdb_id", "media_type");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_user_id_tmdb_id_media_type_key" ON "ratings"("user_id", "tmdb_id", "media_type");

-- CreateIndex
CREATE INDEX "comments_tmdb_id_media_type_created_at_idx" ON "comments"("tmdb_id", "media_type", "created_at");

-- AddForeignKey
ALTER TABLE "tracked_items" ADD CONSTRAINT "tracked_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watched_episodes" ADD CONSTRAINT "watched_episodes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
