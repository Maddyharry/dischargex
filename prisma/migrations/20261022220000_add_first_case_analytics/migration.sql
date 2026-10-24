CREATE TABLE "FirstCaseAnalytics" (
    "userId" TEXT NOT NULL,
    "eventToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirstCaseAnalytics_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "FirstCaseAnalytics_eventToken_key" ON "FirstCaseAnalytics"("eventToken");

ALTER TABLE "FirstCaseAnalytics"
ADD CONSTRAINT "FirstCaseAnalytics_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
