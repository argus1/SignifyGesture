import { isNativeHost } from "@/lib/nativeBridge";
import {
  conversationSchema,
  memoryResponseSchema,
  type MemoryAction,
  type MemoryData,
} from "@/types/memory";

type Pending = {
  resolve: (data: MemoryData) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  revision: number;
};

/** getRandomValues also works on the HTTP LAN frontend used by native development builds. */
export function createMemoryId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One client per Signify context. No transcripts are logged or cached here. */
export class MemoryClient {
  private pending = new Map<string, Pending>();
  private generation: number | undefined;
  private revision = 0;
  private writing = false;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private invalidate() {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }

  receive = (payload: unknown) => {
    const parsed = memoryResponseSchema.safeParse(payload);
    if (!parsed.success) {
      this.cancel("Invalid native memory response.");
      return;
    }
    const response = parsed.data;
    const pending = this.pending.get(response.requestId);
    if (!pending) return; // A timed-out/disposed request cannot update state.
    clearTimeout(pending.timer);
    this.pending.delete(response.requestId);
    if (pending.revision !== this.revision) {
      pending.reject(new Error("Memory changed. Please try again."));
    } else if (response.ok) {
      this.generation = response.data.generation;
      pending.resolve(response.data);
    } else {
      this.generation = undefined;
      pending.reject(new Error(response.error.message));
    }
  };

  cancel(message = "Memory request cancelled.") {
    this.invalidate();
    this.generation = undefined;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }

  async request(input: MemoryAction): Promise<MemoryData> {
    const handler = window.webkit?.messageHandlers?.aslBridge;
    if (!isNativeHost() || !handler) throw new Error("Conversation memory requires the iOS app.");
    const mutation = ["save", "delete", "erase", "setGlobalRecall", "setRecall"].includes(
      input.action,
    );
    if (mutation) {
      if (this.writing) throw new Error("A memory change is already in progress.");
      this.writing = true;
    }
    try {
      if (input.action === "save") conversationSchema.parse(input.conversation);
      if (mutation && this.generation === undefined) await this.request({ action: "state" });
      if (mutation) this.invalidate();
      const requestId = createMemoryId();
      return await new Promise<MemoryData>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          this.generation = undefined;
          reject(new Error("Memory request timed out. Check Memory before retrying a save."));
        }, 5000);
        this.pending.set(requestId, { resolve, reject, timer, revision: this.revision });
        try {
          const message = {
            ...input,
            type: "memory" as const,
            version: 1 as const,
            requestId,
            ...(mutation && this.generation !== undefined
              ? { expectedGeneration: this.generation }
              : {}),
          };
          if (new TextEncoder().encode(JSON.stringify(message)).byteLength > 2_000_000) {
            throw new Error("This conversation is too large to save (2 MB limit).");
          }
          handler.postMessage(message);
        } catch (failure) {
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(
            failure instanceof Error
              ? failure
              : new Error("Could not send the memory request to iOS."),
          );
        }
      });
    } finally {
      if (mutation) this.writing = false;
    }
  }
}
