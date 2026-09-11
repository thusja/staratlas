-- CreateTable
CREATE TABLE "stars" (
    "hip_id" INTEGER NOT NULL,
    "ra" DOUBLE PRECISION NOT NULL,
    "dec" DOUBLE PRECISION NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    "proper_name" TEXT,

    CONSTRAINT "stars_pkey" PRIMARY KEY ("hip_id")
);

-- CreateIndex
CREATE INDEX "stars_magnitude_idx" ON "stars"("magnitude");
