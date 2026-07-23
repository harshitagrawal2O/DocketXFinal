-- CreateTable
CREATE TABLE "YjsUpdate" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YjsUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YjsUpdate_documentId_createdAt_idx" ON "YjsUpdate"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "YjsUpdate" ADD CONSTRAINT "YjsUpdate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
