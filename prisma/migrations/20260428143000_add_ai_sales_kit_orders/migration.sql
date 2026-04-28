CREATE TABLE "AiSalesKitOrder" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "amountThb" INTEGER NOT NULL,
    "customerEmail" TEXT,
    "customerLineId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "paymentProvider" TEXT NOT NULL DEFAULT 'opn',
    "opnSourceId" TEXT,
    "opnChargeId" TEXT,
    "qrImageUrl" TEXT,
    "qrText" TEXT,
    "downloadToken" TEXT,
    "sourceCampaign" TEXT,
    "sourceAd" TEXT,
    "deliveryWebhookOk" BOOLEAN,
    "deliveryWebhookLog" TEXT,
    "metaCapiOk" BOOLEAN,
    "metaCapiLog" TEXT,
    "paidAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSalesKitOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiSalesKitOrder_downloadToken_key" ON "AiSalesKitOrder"("downloadToken");
CREATE INDEX "AiSalesKitOrder_customerEmail_idx" ON "AiSalesKitOrder"("customerEmail");
CREATE INDEX "AiSalesKitOrder_opnChargeId_idx" ON "AiSalesKitOrder"("opnChargeId");
CREATE INDEX "AiSalesKitOrder_status_createdAt_idx" ON "AiSalesKitOrder"("status", "createdAt");
