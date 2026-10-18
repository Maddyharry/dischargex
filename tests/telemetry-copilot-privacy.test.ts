import { describe, expect, it, vi } from "vitest";

const { create, getServerSession } = vi.hoisted(() => ({ create: vi.fn(), getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/openai", () => ({ openai: { responses: { create } } }));

import { POST } from "../app/api/admin/telemetry-copilot/route";

describe("telemetry copilot digest allowlist", () => {
  it("sends allowlisted aggregate fields, redacts the question and requests non-storage", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });
    create.mockResolvedValueOnce({ output_text: "Summary for นายสมชาย ใจดี HN: 123456789" });
    const response = await POST(new Request("http://localhost/api/admin/telemetry-copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "นายสมชาย ใจดี HN: 123456789, summarize feedback",
        digest: {
          totalTelemetry: 12,
          feedback: { helpful: 9, notHelpful: 3 },
          notes: "นายสมชาย ใจดี HN: 123456789",
          arbitraryPatientKey: { count: 1 },
          topEvents: [{ event: "นายสมชาย ใจดี", count: 5, message: "private" }],
        },
      }),
    }) as never);
    const request = create.mock.calls[0][0];
    const outbound = request.input[1].content as string;
    expect(response.status).toBe(200);
    expect(request.store).toBe(false);
    expect(outbound).toContain('"totalTelemetry":12');
    expect(outbound).toContain('"helpful":9');
    expect(outbound).toContain('"count":5');
    expect(outbound).not.toContain("สมชาย");
    expect(outbound).not.toContain("private");
    const responseBody = await response.json();
    expect(JSON.stringify(responseBody)).not.toContain("สมชาย");
  });
});
