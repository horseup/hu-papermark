-- HorseUp deal room: dedupe for MCP access requests from verified non-members.
-- CreateTable
CREATE TABLE "HuMcpAccessRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "HuMcpAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HuMcpAccessRequest_teamId_email_key" ON "HuMcpAccessRequest"("teamId", "email");
