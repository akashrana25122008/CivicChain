-- Link an Authority to the user account that operates it (role AUTHORITY).
-- Generated via `prisma migrate diff` (the geoLocation DROP DEFAULT noise from
-- the PostGIS generated column was intentionally omitted).

-- AlterTable
ALTER TABLE "Authority" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Authority_userId_key" ON "Authority"("userId");

-- AddForeignKey
ALTER TABLE "Authority" ADD CONSTRAINT "Authority_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;