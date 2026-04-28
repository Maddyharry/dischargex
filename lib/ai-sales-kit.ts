import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

export type AiSalesKitPackageId = "ebook_only" | "full_bundle";

export type AiSalesKitPackage = {
  id: AiSalesKitPackageId;
  label: string;
  priceThb: number;
  description: string;
  fileName: string;
  contentType: string;
};

export const AI_SALES_KIT_PACKAGES: Record<AiSalesKitPackageId, AiSalesKitPackage> = {
  ebook_only: {
    id: "ebook_only",
    label: "Ebook Only",
    priceThb: 199,
    description: "AI Sales Kit Ebook PDF",
    fileName: "AI-Sales-Kit-Ebook.pdf",
    contentType: "application/pdf",
  },
  full_bundle: {
    id: "full_bundle",
    label: "Full Bundle",
    priceThb: 299,
    description: "AI Sales Kit Ebook + Prompt Pack + Bonus",
    fileName: "AI-Sales-Kit-Customer-Delivery.zip",
    contentType: "application/zip",
  },
};

export const AI_SALES_KIT_DOWNLOAD_TOKEN_BYTES = 24;

export function normalizeAiSalesKitPackage(value: unknown): AiSalesKitPackage | null {
  const raw = String(value || "").trim();
  if (raw === "ebook_only" || raw === "full_bundle") return AI_SALES_KIT_PACKAGES[raw];
  return null;
}

export function normalizeAiSalesKitPackageId(value: unknown): AiSalesKitPackageId | null {
  return normalizeAiSalesKitPackage(value)?.id ?? null;
}

export function createAiSalesKitDownloadToken() {
  return crypto.randomBytes(AI_SALES_KIT_DOWNLOAD_TOKEN_BYTES).toString("hex");
}

export function createAiSalesKitOrderId() {
  return `ask_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export function getAiSalesKitFilePath(fileName: string) {
  return path.join(process.cwd(), fileName);
}

export function getAiSalesKitDeliveryFile(packageId: string) {
  const packageInfo = normalizeAiSalesKitPackage(packageId);
  if (!packageInfo) throw new Error("Invalid AI Sales Kit package");
  const filePath = getAiSalesKitFilePath(packageInfo.fileName);
  return {
    filename: packageInfo.fileName,
    contentType: packageInfo.contentType,
    bytes: () => fs.readFile(filePath),
  };
}

export function getAiSalesKitDownloadUrl(origin: string, token: string) {
  return `${origin.replace(/\/+$/, "")}/api/ai-sales-kit/download/${encodeURIComponent(token)}`;
}

export function sanitizeCustomerEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function sanitizeCustomerName(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

export function sanitizeCustomerLineId(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

export function isAiSalesKitPaidStatus(status: string) {
  return status === "paid" || status === "delivered";
}

export async function getAiSalesKitOrderStatus(orderId: string) {
  const { prisma } = await import("@/lib/prisma");
  const order = await prisma.aiSalesKitOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      packageId: true,
      amountThb: true,
      customerEmail: true,
      status: true,
      qrImageUrl: true,
      downloadToken: true,
      paidAt: true,
    },
  });
  if (!order) return null;
  return {
    orderId: order.id,
    packageId: order.packageId,
    amountThb: order.amountThb,
    customerEmail: order.customerEmail,
    status: order.status,
    paid: isAiSalesKitPaidStatus(order.status),
    qrImageUrl: order.qrImageUrl,
    downloadUrl:
      order.downloadToken && isAiSalesKitPaidStatus(order.status)
        ? `/api/ai-sales-kit/download/${encodeURIComponent(order.downloadToken)}`
        : null,
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

type OpnChargeInput = {
  orderId: string;
  amountThb: number;
  packageId: AiSalesKitPackageId;
  customerEmail?: string;
};

type OpnChargeOutput = {
  chargeId: string;
  sourceId?: string;
  qrImageUrl?: string;
  qrText?: string;
  authorizeUri?: string;
};

function basicAuth(secretKey: string) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export async function createOpnPromptPayCharge(input: OpnChargeInput): Promise<OpnChargeOutput> {
  const secretKey = process.env.OPN_SECRET_KEY || process.env.OMISE_SECRET_KEY || "";
  if (!secretKey) {
    const qrText = `DEV_PROMPTPAY_QR_${input.amountThb}_THB_${input.orderId}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing OPN_SECRET_KEY for PromptPay QR checkout");
    }
    return {
      chargeId: `dev_chrg_${input.orderId}`,
      sourceId: `dev_src_${input.orderId}`,
      qrImageUrl: await QRCode.toDataURL(qrText, { margin: 1, width: 320 }),
      qrText,
    };
  }

  const body = new URLSearchParams();
  body.set("amount", String(input.amountThb * 100));
  body.set("currency", "thb");
  body.set("source[type]", "promptpay");
  body.set("metadata[orderId]", input.orderId);
  body.set("metadata[packageId]", input.packageId);
  if (input.customerEmail) {
    body.set("metadata[customerEmail]", input.customerEmail);
  }

  const response = await fetch("https://api.omise.co/charges", {
    method: "POST",
    headers: {
      Authorization: basicAuth(secretKey),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await response.json()) as {
    id?: string;
    source?: {
      id?: string;
      scannable_code?: {
        image?: {
          download_uri?: string;
        };
        raw_data?: string;
      };
    };
    authorize_uri?: string;
    message?: string;
  };

  if (!response.ok || !data.id) {
    throw new Error(data.message || "Create PromptPay charge failed");
  }

  const qrText = data.source?.scannable_code?.raw_data;
  const qrImageUrl =
    data.source?.scannable_code?.image?.download_uri ||
    (qrText ? await QRCode.toDataURL(qrText, { margin: 1, width: 320 }) : data.authorize_uri);

  return {
    chargeId: data.id,
    sourceId: data.source?.id,
    qrImageUrl,
    qrText,
    authorizeUri: data.authorize_uri,
  };
}

export function verifyOpnWebhookSignature(rawBody: string, headers: Headers) {
  const secret = process.env.OPN_WEBHOOK_SECRET || "";
  if (!secret) return true;
  const signature =
    headers.get("x-omise-signature") ||
    headers.get("x-opn-signature") ||
    headers.get("omise-signature") ||
    "";
  if (!signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const cleanSignature = signature.replace(/^sha256=/, "");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(cleanSignature));
}
