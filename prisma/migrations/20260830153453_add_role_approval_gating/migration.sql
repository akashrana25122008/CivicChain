-- CreateEnum
CREATE TYPE "RoleApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "requestedRole" "UserRole",
ADD COLUMN     "roleReviewedAt" TIMESTAMP(3),
ADD COLUMN     "roleReviewedById" TEXT,
ADD COLUMN     "roleStatus" "RoleApprovalStatus" NOT NULL DEFAULT 'APPROVED';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleReviewedById_fkey" FOREIGN KEY ("roleReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
