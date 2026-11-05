import type { RpcTransport, UnaryCall } from "@protobuf-ts/runtime-rpc";
import { afterEach, describe, expect, it, vi } from "vitest";
import { throttleTransport } from "./tatum";

/** Minimal fake of a protobuf-ts unary call whose outcome we script per attempt. */
function fakeCall(outcome: { ok: unknown } | { err: Error }): UnaryCall<object, object> {
  const response = "ok" in outcome ? Promise.resolve(outcome.ok) : Promise.reject(outcome.err);
  const status = response.then(() => ({ code: "OK", detail: "" }));
  const call = {
    method: {},
    requestHeaders: {},
    request: {},
    headers: response.then(() => ({})),
    response,
    status,
    trailers: response.then(() => ({})),
    then: (f: (v: unknown) => unknown, r: (e: unknown) => unknown) =>
      Promise.all([response, status]).then(() => call).then(f, r),
  };
  return call as unknown as UnaryCall<object, object>;
}

function fakeTransport(outcomes: Array<{ ok: unknown } | { err: Error }>) {
  const calledAt: number[] = [];
  const transport = {
    mergeOptions: (o: object) => o,
    unary: () => {
      calledAt.push(Date.now());
      const next = outcomes.shift();
      if (!next) throw new Error("no more scripted outcomes");
      return fakeCall(next);
    },
  } as unknown as RpcTransport;
  return { transport, calledAt };
}

const call = (t: RpcTransport) =>
  t.unary({} as never, {}, { meta: {} } as never).response;

describe("throttleTransport", () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on("unhandledRejection", onUnhandled);
  afterEach(() => {
    unhandled.length = 0;
    vi.useRealTimers();
  });

  it("spaces consecutive calls by the minimum interval", async () => {
    const { transport, calledAt } = fakeTransport([{ ok: 1 }, { ok: 2 }, { ok: 3 }]);
    const t = throttleTransport(transport, 50);
    expect(await Promise.all([call(t), call(t), call(t)])).toEqual([1, 2, 3]);
    expect(calledAt[1]! - calledAt[0]!).toBeGreaterThanOrEqual(45);
    expect(calledAt[2]! - calledAt[1]!).toBeGreaterThanOrEqual(45);
  });

  it("retries 429 and returns the eventual response", async () => {
    const { transport, calledAt } = fakeTransport([
      { err: new Error("Received HTTP status code 429") },
      { ok: "done" },
    ]);
    const t = throttleTransport(transport, 0);
    expect(await call(t)).toBe("done");
    expect(calledAt).toHaveLength(2);
  });

  it("does not retry other errors and leaves no unhandled rejection", async () => {
    const { transport, calledAt } = fakeTransport([{ err: new Error("Transaction x not found") }]);
    const t = throttleTransport(transport, 0);
    // Await the call object itself, like the Sui SDK does, not just `.response`.
    await expect(Promise.resolve(t.unary({} as never, {}, { meta: {} } as never))).rejects.toThrow("not found");
    await new Promise((r) => setTimeout(r, 20));
    expect(calledAt).toHaveLength(1);
    expect(unhandled).toEqual([]);
  });
});
