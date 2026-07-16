-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "titlePattern" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "documentIds" JSONB NOT NULL DEFAULT '[]',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Batch_ownerId_createdAt_idx" ON "Batch"("ownerId", "createdAt");
