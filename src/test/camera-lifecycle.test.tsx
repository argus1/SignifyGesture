import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { CameraControl, CameraViewport } from "@/components/signify/CameraViewport";
import { SignifyProvider } from "@/lib/signify-store";

describe("native camera lifecycle", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  const render = (content: ReactNode) => {
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root?.render(content));
  };
  const button = () => container.querySelector("button");

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    delete window.webkit;
    delete window.NativeASLBridge;
    document.documentElement.removeAttribute("data-native-host");
    vi.restoreAllMocks();
  });

  it("starts on entry, reflects native stop/background status, restarts and stops on exit", () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    render(
      <SignifyProvider>
        <CameraViewport />
        <CameraControl />
      </SignifyProvider>,
    );
    expect(postMessage).toHaveBeenLastCalledWith({ type: "triggerCameraToggle", active: true });

    act(() => window.NativeASLBridge?.onEngineStatusChange({
      cameraActive: true, trackingState: "tracking", inferenceLatencyMs: 0,
    }));
    expect(button()?.textContent).toBe("Stop camera");
    act(() => button()?.click());
    expect(postMessage).toHaveBeenLastCalledWith({ type: "triggerCameraToggle", active: false });

    act(() => window.NativeASLBridge?.onEngineStatusChange({
      cameraActive: false, trackingState: "idle", inferenceLatencyMs: 0,
    }));
    expect(button()?.textContent).toBe("Start camera");
    act(() => button()?.click());
    expect(postMessage).toHaveBeenLastCalledWith({ type: "triggerCameraToggle", active: true });
    act(() => root?.unmount());
    root = undefined;
    expect(postMessage).toHaveBeenLastCalledWith({ type: "triggerCameraToggle", active: false });
  });

  it("does not capture in a hidden speech view and stops when the mode changes", () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    const content = (enabled: boolean) => (
      <SignifyProvider><CameraViewport enabled={enabled} /></SignifyProvider>
    );
    render(content(false));
    expect(postMessage).not.toHaveBeenCalled();
    act(() => root?.render(content(true)));
    expect(postMessage).toHaveBeenLastCalledWith({ type: "triggerCameraToggle", active: true });
    act(() => root?.render(content(false)));
    expect(postMessage).toHaveBeenLastCalledWith({ type: "triggerCameraToggle", active: false });
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("surfaces native command and capture errors instead of dropping them", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const notify = vi.spyOn(toast, "error").mockImplementation(() => "camera-error");
    render(<SignifyProvider><CameraViewport enabled={false} /></SignifyProvider>);
    act(() => window.NativeASLBridge?.onNativeError({
      feature: "camera", message: "Camera access is off. Allow it in Settings.",
    }));
    expect(error).toHaveBeenCalledWith(
      "[NativeASLBridge: camera]", "Camera access is off. Allow it in Settings.",
    );
    expect(notify).toHaveBeenCalledWith("Camera access is off. Allow it in Settings.");
  });

  it("keeps native controls out of the browser demo", () => {
    render(<SignifyProvider><CameraControl /></SignifyProvider>);
    expect(button()).toBeNull();
  });
});
