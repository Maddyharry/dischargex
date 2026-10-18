import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendAdminAlertEmail: vi.fn() }));

vi.mock("@/lib/admin-alert", () => ({ sendAdminAlertEmail: mocks.sendAdminAlertEmail }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.resetAllMocks();
});

it("alerts the admin when NextAuth's adapter creates a Google OAuth user", async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  const { authOptions } = await import("@/lib/auth");
  const createUser = authOptions.events?.createUser;

  expect(createUser).toBeTypeOf("function");
  await createUser?.({
    user: { id: "oauth-user-1", name: "Example", email: "example@example.test", image: null },
  });

  expect(mocks.sendAdminAlertEmail).toHaveBeenCalledTimes(1);
  expect(mocks.sendAdminAlertEmail).toHaveBeenCalledWith({
    subject: "DischargeX: New user signup",
    lines: [
      "User ID: oauth-user-1",
      "Provider: Google OAuth",
      "Email: example@example.test",
    ],
  });
});

it("does not let admin alert failures interrupt a completed adapter signup", async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  mocks.sendAdminAlertEmail.mockRejectedValue(new Error("private delivery detail"));
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { authOptions } = await import("@/lib/auth");
  const createUser = authOptions.events?.createUser;

  await expect(createUser?.({
    user: { id: "oauth-user-2", name: "Example", email: "example@example.test", image: null },
  })).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith("New user signup admin alert failed");
});
