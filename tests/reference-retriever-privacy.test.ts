import { describe, expect, it } from "vitest";
import { buildSearchQuery } from "../lib/reference-retriever";

describe("reference query privacy boundary", () => {
  it("uses only allowlisted clinical terms and never carries narrative identifiers", () => {
    const query = buildSearchQuery("Patient Somchai Example HN: 1234567890123 has stroke after admission in Bangkok");
    expect(query).toContain("stroke");
    expect(query).not.toContain("Somchai");
    expect(query).not.toContain("Example");
    expect(query).not.toContain("1234567890123");
    expect(query).not.toContain("Bangkok");
  });

  it("skips queries without a safe medical term or ICD code", () => {
    expect(buildSearchQuery("Patient Example, please review this narrative from clinic")).toBe("");
  });

  it("retains recognized ICD codes without other narrative", () => {
    expect(buildSearchQuery("case 123456, ICD-10 I10, Patient Example")).toBe("I10 clinical guideline Thailand");
  });
});
