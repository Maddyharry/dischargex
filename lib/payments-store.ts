import { prisma } from "./prisma";
import { normalizePlanId, getPlanDefinition, type PaymentType } from "./billing-rules";

export type PaymentStatus =
  | "pending"
  | "awaiting_slip"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export async function addPayment(params: {
  id: string;
  fullName: string;
  birthDate: string;
  hospitalName: string;
  province: string;
  phone: string;
  contactEmail: string;
  planRequested: string;
  slipFileName: string;
  slipData?: string | null;
  addCredits?: number | null;
  paymentType?: PaymentType;
  fromPlanId?: string | null;
  toPlanId?: string | null;
  quotedAmount?: number | null;
  finalAmount?: number | null;
}) {
  const user =
    (await prisma.user.findUnique({
      where: { email: params.contactEmail },
      select: { id: true },
    })) ?? null;

  return prisma.paymentRequest.create({
    data: {
      id: params.id,
      userId: user?.id ?? null,
      fullName: params.fullName,
      birthDate: params.birthDate,
      hospitalName: params.hospitalName,
      province: params.province,
      phone: params.phone,
      contactEmail: params.contactEmail,
      planRequested: params.planRequested,
      type: params.paymentType ?? "new",
      fromPlanId: params.fromPlanId ?? null,
      toPlanId: params.toPlanId ?? null,
      quotedAmount: params.quotedAmount ?? null,
      finalAmount: params.finalAmount ?? null,
      slipFileName: params.slipFileName,
      slipData: params.slipData ?? null,
      addCredits: params.addCredits ?? null,
      status: "awaiting_review",
    },
  });
}

export async function listPayments() {
  return prisma.paymentRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function listPaymentsByEmail(email: string) {
  if (!email) return [];
  return prisma.paymentRequest.findMany({
    where: { contactEmail: email },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingRequestByEmail(email: string) {
  if (!email) return null;
  return prisma.paymentRequest.findFirst({
    where: { contactEmail: email, status: { in: ["pending", "awaiting_slip", "awaiting_review"] } },
  });
}

export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  options?: {
    adminNote?: string | null;
    rejectionReason?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: Date | null;
  }
) {
  const req = await prisma.paymentRequest.update({
    where: { id },
    data: {
      status,
      ...(options?.adminNote !== undefined ? { adminNote: options.adminNote } : {}),
      ...(options?.rejectionReason !== undefined ? { rejectionReason: options.rejectionReason } : {}),
      ...(options?.reviewedBy !== undefined ? { reviewedBy: options.reviewedBy } : {}),
      ...(options?.reviewedAt !== undefined ? { reviewedAt: options.reviewedAt } : {}),
    },
  });
  return req;
}
export async function markPaymentEntitlementApplied(id: string, at: Date) {
  return prisma.paymentRequest.update({
    where: { id },
    data: { entitlementAppliedAt: at },
  });
}

export function getPlanQuota(rawPlan: string): number {
  return getPlanDefinition(normalizePlanId(rawPlan)).creditsPerCycle;
}


