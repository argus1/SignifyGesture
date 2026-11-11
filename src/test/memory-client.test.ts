import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryId, MemoryClient } from "@/lib/memory-client";
import {
  conversationSchema,
  type MemoryData,
  type MemoryRequest,
  type SavedConversation,
} from "@/types/memory";

const data = (generation = 0): MemoryData => ({
  generation,
  recallEnabled: false,
  conversations: [],
  conversation: null,
  hits: [],
  hasMore: false,
});
const conversation = (): SavedConversation => ({
  id: crypto.randomUUID(),
  title: "Coffee order",
  context: "",
  startedAt: 1000,
  endedAt: 3000,
  recallAllowed: false,
  turns: [
    {
      id: crypto.randomUUID(),
      sequence: 0,
      speaker: "sam",
      modality: "typed",
      text: "Tea please",
      timestamp: 2000,
    },
  ],
  corrections: [],
});

describe("memory bridge client", () => {
  let client: MemoryClient;
  const requests: MemoryRequest[] = [];
  function setup() {
    requests.length = 0;
    client = new MemoryClient();
    window.webkit = {
      messageHandlers: {
        aslBridge: {
          postMessage(message) {
            if (message.type === "memory") requests.push(message);
          },
        },
      },
    };
  }
  function respond(request: MemoryRequest, result = data()) {
    client.receive({ version: 1, requestId: request.requestId, ok: true, data: result });
  }
  afterEach(() => {
    client?.cancel();
    delete window.webkit;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates valid unique UUIDs without requiring secure-context randomUUID", () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("randomUUID is unavailable on an HTTP LAN origin");
    });
    const first = createMemoryId();
    const second = createMemoryId();
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(second).not.toBe(first);
    expect(uuid).not.toHaveBeenCalled();
  });

  it("does not simulate save success or log a transcript in a browser", async () => {
    setup();
    delete window.webkit;
    const log = vi.spyOn(console, "debug");
    await expect(client.request({ action: "save", conversation: conversation() })).rejects.toThrow(
      "requires the iOS app",
    );
    expect(requests).toHaveLength(0);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("waits for native commit acknowledgment and sends generation on mutations", async () => {
    setup();
    let completed = false;
    const saved = conversation();
    const promise = client.request({ action: "save", conversation: saved }).then((result) => {
      completed = true;
      return result;
    });
    expect(requests[0]?.action).toBe("state");
    respond(requests[0]!);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toMatchObject({
      action: "save",
      expectedGeneration: 0,
      conversation: saved,
    });
    expect(completed).toBe(false);
    respond(requests[1]!, { ...data(1), conversation: saved });
    expect((await promise).conversation).toEqual(saved);
  });

  it("surfaces native failure and refreshes the generation before retry", async () => {
    setup();
    const load = client.request({ action: "state" });
    respond(requests[0]!);
    await load;
    const failed = client.request({ action: "erase" });
    client.receive({
      version: 1,
      requestId: requests[1]!.requestId,
      ok: false,
      error: { code: "changed", message: "Memory changed. Refresh before trying again." },
    });
    await expect(failed).rejects.toThrow("Memory changed");
    const retry = client.request({ action: "erase" });
    expect(requests[2]?.action).toBe("state");
    respond(requests[2]!, data(5));
    await vi.waitFor(() => expect(requests).toHaveLength(4));
    expect(requests[3]).toMatchObject({ action: "erase", expectedGeneration: 5 });
    respond(requests[3]!, data(6));
    await retry;
  });

  it("rejects stale reads after consent changes and notifies visible recall tools", async () => {
    setup();
    const initial = client.request({ action: "state" });
    respond(requests[0]!);
    await initial;
    const listener = vi.fn();
    client.subscribe(listener);
    const read = client.request({ action: "list", offset: 0 });
    const changed = client.request({ action: "setGlobalRecall", enabled: false });
    respond(requests[1]!);
    await expect(read).rejects.toThrow("Memory changed");
    expect(listener).toHaveBeenCalledOnce();
    respond(requests[2]!, data(1));
    await changed;
  });

  it("times out without accepting a late response", async () => {
    setup();
    vi.useFakeTimers();
    const promise = client.request({ action: "state" });
    const error = expect(promise).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(5000);
    await error;
    respond(requests[0]!, data(20));
    const retry = client.request({ action: "erase" });
    expect(requests[1]?.action).toBe("state");
    respond(requests[1]!, data(1));
    await vi.advanceTimersByTimeAsync(0);
    respond(requests[2]!, data(2));
    await retry;
  });

  it("rejects malformed responses instead of claiming no hits", async () => {
    setup();
    const pending = client.request({ action: "state" });
    client.receive({ version: 9, requestId: requests[0]!.requestId, ok: true, data: data() });
    await expect(pending).rejects.toThrow("Invalid native memory response");
  });

  it("prevents concurrent memory mutations", async () => {
    setup();
    const first = client.request({ action: "erase" });
    await expect(client.request({ action: "setGlobalRecall", enabled: true })).rejects.toThrow(
      "already in progress",
    );
    respond(requests[0]!);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    respond(requests[1]!, data(1));
    await first;
  });

  it("rejects blank and invalid snapshots before posting their contents", async () => {
    setup();
    const saved = conversation();
    expect(conversationSchema.safeParse({ ...saved, turns: [] }).success).toBe(false);
    await expect(
      client.request({ action: "save", conversation: { ...saved, title: "" } }),
    ).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });
});
