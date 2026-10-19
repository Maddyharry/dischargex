import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { feedback: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));

import { PATCH } from "../app/api/admin/chat/messages/route";

function patch(body: unknown) {
  return new NextRequest("http://localhost/api/admin/chat/messages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH admin chat message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { role: "admin" } });
    mocks.findUnique.mockResolvedValue({
      id: "admin-message",
      type: "chat",
      message: "old",
      payload: JSON.stringify({ source: "admin", readByUser: true }),
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("requires an admin session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await PATCH(patch({ messageId: "admin-message", message: "new" }));
    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    [null, 400],
    [[], 400],
    [{ messageId: "admin-message", message: "  " }, 400],
    [{ messageId: " ", message: "new" }, 400],
    [{ messageId: "admin-message", message: "x".repeat(10_001) }, 413],
  ])("validates the request body", async (body, status) => {
    const response = await PATCH(patch(body));
    expect(response.status).toBe(status);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    [{ id: "user-message", type: "chat", payload: JSON.stringify({ source: "user" }) }],
    [{ id: "ai-message", type: "chat", payload: JSON.stringify({ source: "ai" }) }],
    [{ id: "report", type: "error_report", payload: JSON.stringify({ source: "admin" }) }],
    [{ id: "unknown", type: "chat", payload: "not-json" }],
    [null],
  ])("refuses any row that is not an admin-origin chat", async (row) => {
    mocks.findUnique.mockResolvedValue(row);
    const response = await PATCH(patch({ messageId: "target", message: "new" }));
    expect(response.status).toBe(404);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("updates only message and shortSummary and returns the updated message", async () => {
    const submittedMessage = "\n  **Updated**\n\ntext  \n";
    const response = await PATCH(patch({ messageId: "admin-message", message: submittedMessage }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      message: { id: "admin-message", message: submittedMessage },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "admin-message",
        type: "chat",
        payload: JSON.stringify({ source: "admin", readByUser: true }),
      },
      data: { message: submittedMessage, shortSummary: submittedMessage },
    });
  });

  it("reports a conflict if the message changed after its source check", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const response = await PATCH(patch({ messageId: "admin-message", message: "new" }));
    expect(response.status).toBe(409);
  });
});
