-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "syncSourceCategoryId" TEXT,
ADD COLUMN     "syncSourceId" TEXT;

-- CreateTable
CREATE TABLE "SyncSource" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncSourceCategory" (
    "id" TEXT NOT NULL,
    "syncSourceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "listingUrl" TEXT NOT NULL,
    "categoryId" TEXT,
    "locationId" TEXT,
    "adapterConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncSourceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncSource_domain_key" ON "SyncSource"("domain");

-- CreateIndex
CREATE INDEX "SyncSourceCategory_categoryId_idx" ON "SyncSourceCategory"("categoryId");

-- CreateIndex
CREATE INDEX "SyncSourceCategory_locationId_idx" ON "SyncSourceCategory"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncSourceCategory_syncSourceId_listingUrl_key" ON "SyncSourceCategory"("syncSourceId", "listingUrl");

-- CreateIndex
CREATE INDEX "Post_syncSourceId_idx" ON "Post"("syncSourceId");

-- CreateIndex
CREATE INDEX "Post_syncSourceCategoryId_idx" ON "Post"("syncSourceCategoryId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_syncSourceId_fkey" FOREIGN KEY ("syncSourceId") REFERENCES "SyncSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_syncSourceCategoryId_fkey" FOREIGN KEY ("syncSourceCategoryId") REFERENCES "SyncSourceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSourceCategory" ADD CONSTRAINT "SyncSourceCategory_syncSourceId_fkey" FOREIGN KEY ("syncSourceId") REFERENCES "SyncSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSourceCategory" ADD CONSTRAINT "SyncSourceCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSourceCategory" ADD CONSTRAINT "SyncSourceCategory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
