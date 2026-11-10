import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SignifyProvider, useSignify } from "@/lib/signify-store";

function RecognitionStatusProbe() {
  const { recognitionStatus } = useSignify();
  return <div role="status">{recognitionStatus?.message ?? "No recognition status"}</div>;
}

describe("native recognition status bridge", () => {
  let root: Root | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    delete window.NativeASLBridge;
  });

  it("surfaces model-unavailable and no-result messages and clears them when capture stops", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <SignifyProvider>
          <RecognitionStatusProbe />
        </SignifyProvider>,
      );
    });

    expect(window.NativeASLBridge?.onRecognitionStatusChange).toBeTypeOf("function");
    act(() => {
      window.NativeASLBridge?.onRecognitionStatusChange({
        state: "modelUnavailable",
        message: "No compatible model is bundled.",
      });
    });
    expect(container.textContent).toContain("No compatible model is bundled.");

    act(() => {
      window.NativeASLBridge?.onRecognitionStatusChange({
        state: "noResult",
        message: "Tracking input is invalid.",
      });
    });
    expect(container.textContent).toContain("Tracking input is invalid.");

    act(() => {
      window.NativeASLBridge?.onEngineStatusChange({
        cameraActive: false,
        trackingState: "idle",
        inferenceLatencyMs: 0,
      });
    });
    expect(container.textContent).toContain("No recognition status");
  });
});
