import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(resolve(process.cwd(), "public/privacy-retire-sw.js"), "utf8");

describe("retiring DischargeX root service worker", () => {
  it("skips waiting, deletes only named app caches, unregisters itself, and leaves open windows untouched", async () => {
    const handlers = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const deleted: string[] = [];
    const lifecycleOrder: string[] = [];
    const activationPromises: Promise<unknown>[] = [];
    const selfMock = {
      location: { origin: "https://dischargex.example" },
      addEventListener: vi.fn((name: string, handler: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
        handlers.set(name, handler);
      }),
      skipWaiting: vi.fn(async () => { lifecycleOrder.push("skipWaiting"); }),
      registration: { unregister: vi.fn(async () => { lifecycleOrder.push("unregister"); return true; }) },
      clients: {
        claim: vi.fn(async () => { lifecycleOrder.push("claim"); }),
        matchAll: vi.fn(),
      },
    };

    const sandbox = {
      self: selfMock,
      caches: {
        keys: vi.fn(async () => [
          "apis",
          "other-app-cache",
          "workbox-precache-v2-https://dischargex.example/",
          "workbox-precache-v2-https://dischargex.example/other/",
        ]),
        delete: vi.fn(async (name: string) => { deleted.push(name); return true; }),
      },
      Promise,
      Set,
      URL,
    };

    new Function("self", "caches", source)(sandbox.self, sandbox.caches);

    const installEvent = { waitUntil: (promise: Promise<unknown>) => activationPromises.push(promise) };
    handlers.get("install")?.(installEvent);
    await Promise.all(activationPromises.splice(0));

    const activateEvent = { waitUntil: (promise: Promise<unknown>) => activationPromises.push(promise) };
    handlers.get("activate")?.(activateEvent);
    await Promise.all(activationPromises);

    expect(lifecycleOrder).toEqual(["skipWaiting", "claim", "unregister"]);
    expect(deleted).toEqual([
      "apis",
      "workbox-precache-v2-https://dischargex.example/",
    ]);
    expect(selfMock.clients.matchAll).not.toHaveBeenCalled();
    expect(selfMock.registration.unregister).toHaveBeenCalledOnce();
  });
});
