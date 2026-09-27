-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "summaryGenerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Post_summaryGenerated_idx" ON "Post"("summaryGenerated");
