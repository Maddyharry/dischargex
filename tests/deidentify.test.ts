import { describe, expect, it } from "vitest";
import { deidentify } from "../lib/deidentify";

describe("best-effort clinical text redaction", () => {
  it("redacts labeled Thai and English names, with and without honorifics", () => {
    for (const value of ["ชื่อ: นายสมชาย ใจดี", "Name: John Doe", "Patient Name: Ms Jane Smith"]) {
      expect(deidentify(value)).toContain("[REDACTED]");
      expect(deidentify(value)).not.toContain(value.split(": ")[1]);
    }
  });

  it("redacts HN and AN identifiers with punctuation and digit-separated labels", () => {
    const result = deidentify("HN: 12345\nAN / 98765\nMRN-AB-123");
    expect(result).not.toMatch(/12345|98765|AB-123/);
    expect(result.match(/\[REDACTED\]/g)).toHaveLength(3);
  });

  it("does not treat the English article an as an AN label", () => {
    const text = "an elderly patient with anemia; an 18-year-old male has BP 120/80";
    expect(deidentify(text)).toBe(text);
  });

  it("redacts Thai-digit IDs, spaced phones, email, address, and date of birth", () => {
    const result = deidentify("CID ๑๒๓๔๕๖๗๘๙๐๑๒๓\nPhone: +66 81 234 5678\nmail: jane@example.org\nAddress: 12 Main Road\nDOB: 1/1/2000");
    expect(result).not.toMatch(/๑๒๓|81 234|jane@example|Main Road|1\/1\/2000/);
  });

  it("preserves line breaks, diagnoses, medication doses, dates, and blood pressure", () => {
    const text = "Diagnosis: pneumonia\nMedication: ceftriaxone 1 g IV q24h\nAdmit date: 2026-10-18\nBP 120/80";
    const result = deidentify(text);
    expect(result).toContain("Diagnosis: pneumonia\nMedication: ceftriaxone 1 g IV q24h");
    expect(result).toContain("Admit date: 2026-10-18\nBP 120/80");
  });

  it("does not let a DOB field swallow a JSON sibling field or escaped newline", () => {
    const text = String.raw`{"DOB":"1/1/2000\nBP 120/80","diagnosis":"pneumonia"}`;
    const result = deidentify(text);
    expect(result).toContain(String.raw`\nBP 120/80`);
    expect(result).toContain('"diagnosis":"pneumonia"');
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
