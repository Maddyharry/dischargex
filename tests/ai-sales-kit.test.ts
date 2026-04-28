import { describe, expect, it } from "vitest";
import {
  AI_SALES_KIT_PACKAGES,
  getAiSalesKitDeliveryFile,
  getAiSalesKitFilePath,
  normalizeAiSalesKitPackageId,
} from "../lib/ai-sales-kit";

describe("ai sales kit automation helpers", () => {
  it("normalizes supported package ids", () => {
    expect(normalizeAiSalesKitPackageId("ebook_only")).toBe("ebook_only");
    expect(normalizeAiSalesKitPackageId("full_bundle")).toBe("full_bundle");
    expect(normalizeAiSalesKitPackageId("bad")).toBeNull();
  });

  it("keeps configured prices and delivery files aligned", () => {
    expect(AI_SALES_KIT_PACKAGES.ebook_only.priceThb).toBe(199);
    expect(AI_SALES_KIT_PACKAGES.ebook_only.fileName).toBe("AI-Sales-Kit-Ebook.pdf");
    expect(AI_SALES_KIT_PACKAGES.full_bundle.priceThb).toBe(299);
    expect(AI_SALES_KIT_PACKAGES.full_bundle.fileName).toBe("AI-Sales-Kit-Customer-Delivery.zip");
  });

  it("returns content type for each delivery package", () => {
    expect(getAiSalesKitDeliveryFile("ebook_only").contentType).toBe("application/pdf");
    expect(getAiSalesKitDeliveryFile("full_bundle").contentType).toBe("application/zip");
  });

  it("resolves delivery files from the repository root", () => {
    expect(getAiSalesKitFilePath("AI-Sales-Kit-Ebook.pdf")).toMatch(/AI-Sales-Kit-Ebook\.pdf$/);
  });
});
