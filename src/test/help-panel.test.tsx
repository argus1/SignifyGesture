import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpButton } from "@/components/signify/HelpButton";
import { SignifyProvider, useSignify } from "@/lib/signify-store";

function Work() {
  const { captions, say } = useSignify();
  return (
    <>
      <button onClick={() => say("Keep this message", "sam", { typed: true })}>
        Create message
      </button>
      <p>{captions[0]?.text}</p>
      <HelpButton />
    </>
  );
}

describe("help panel", () => {
  afterEach(() => {
    delete window.webkit;
    delete window.NativeASLBridge;
    vi.restoreAllMocks();
  });

  it("searches local guidance, sends no requests, and returns to the existing work", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    render(
      <SignifyProvider>
        <Work />
      </SignifyProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Create message" }));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.change(screen.getByLabelText("Search help"), { target: { value: "camera" } });
    expect(
      within(screen.getByRole("region", { name: "Help results" })).getByText(
        "Camera access and recovery",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask AI help" }));
    expect(screen.getByRole("status")).toHaveTextContent("not connected");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close and return" }));
    expect(screen.getByText("Keep this message")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Help" })).toHaveFocus());
  });

  it("keeps the stop-speaking control available while help is open", () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    render(
      <SignifyProvider>
        <Work />
      </SignifyProvider>,
    );
    act(() => window.NativeASLBridge?.onTTSPlaybackState(true));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop speaking" }));
    expect(postMessage).toHaveBeenLastCalledWith({ type: "stopTTSPlayback" });
  });

  it("keeps explicit camera and microphone stops available", () => {
    const postMessage = vi.fn();
    const stopListening = vi.fn();
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    render(
      <SignifyProvider>
        <HelpButton onStopListening={stopListening} />
      </SignifyProvider>,
    );
    act(() =>
      window.NativeASLBridge?.onEngineStatusChange({
        cameraActive: true,
        trackingState: "tracking",
        inferenceLatencyMs: 0,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop camera" }));
    expect(postMessage).toHaveBeenLastCalledWith({ type: "triggerCameraToggle", active: false });
    fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
    expect(stopListening).toHaveBeenCalledOnce();
  });
});
