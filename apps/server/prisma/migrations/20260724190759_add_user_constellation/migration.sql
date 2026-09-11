-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constellations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "memo" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "constellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constellation_stars" (
    "id" SERIAL NOT NULL,
    "constellation_id" INTEGER NOT NULL,
    "hip_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "constellation_stars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "constellations_user_id_idx" ON "constellations"("user_id");

-- CreateIndex
CREATE INDEX "constellation_stars_constellation_id_idx" ON "constellation_stars"("constellation_id");

-- AddForeignKey
ALTER TABLE "constellations" ADD CONSTRAINT "constellations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constellation_stars" ADD CONSTRAINT "constellation_stars_constellation_id_fkey" FOREIGN KEY ("constellation_id") REFERENCES "constellations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
