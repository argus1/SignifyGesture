import { useEffect, useState, type ReactNode } from "react";
import { useNativeBridge } from "@/lib/signify-store";
import { isNativeHost } from "@/lib/nativeBridge";
import { cn } from "@/lib/utils";

/**
 * Transparent hole where the native AVFoundation camera layer renders underneath the WKWebView.
 * Never draws video itself.
 * - In the browser (no native host) it paints a blurred café "sample scene" so the prototype reads as a live camera.
 * - In dev preview it adds a dashed frame (toggle in the Bridge Simulator).
 */
export function CameraViewport({ className, children, label = "Camera", enabled = true }: { className?: string; children?: ReactNode; label?: string; enabled?: boolean }) {
  const { devPreview, triggerCameraToggle } = useNativeBridge();
  const [native, setNative] = useState(true); // assume native until mounted, so SSR never paints over the real camera
  useEffect(() => setNative(isNativeHost()), []);

  useEffect(() => {
    if (!enabled) return;
    triggerCameraToggle(true);
    return () => triggerCameraToggle(false);
  }, [enabled, triggerCameraToggle]);

  return (
    <div className={cn("native-viewport relative overflow-hidden bg-transparent", className)} aria-label={`${label} view`} role="img">
      {!native && <SampleScene />}
      {devPreview && (
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-dashed border-foreground/25" />
      )}
      {children}
    </div>
  );
}

export function CameraControl() {
  const { cameraActive, triggerCameraToggle } = useNativeBridge();
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeHost()), []);
  if (!native) return null;

  return (
    <button
      type="button"
      onClick={() => triggerCameraToggle(!cameraActive)}
      className="mx-auto my-2 rounded-full bg-background/90 px-4 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
    >
      {cameraActive ? "Stop camera" : "Start camera"}
    </button>
  );
}

/** Browser-only stand-in for the camera: an out-of-focus café with mint bokeh. */
function SampleScene() {
  return (
    <div aria-hidden className="absolute inset-0">
      <div
        className="absolute -inset-6 blur-[6px]"
        style={{
          background: [
            "radial-gradient(circle at 18% 22%, rgba(150,255,215,0.9) 0 7%, transparent 15%)",
            "radial-gradient(circle at 78% 14%, rgba(0,255,174,0.8) 0 6%, transparent 13%)",
            "radial-gradient(circle at 62% 30%, rgba(230,255,245,0.75) 0 4%, transparent 8%)",
            "radial-gradient(circle at 88% 46%, rgba(40,245,190,0.7) 0 6%, transparent 12%)",
            "radial-gradient(circle at 10% 58%, rgba(100,255,205,0.65) 0 5%, transparent 10%)",
            "radial-gradient(ellipse 55% 42% at 50% 62%, rgba(200,235,215,0.55), transparent 70%)", // person, out of focus
            "radial-gradient(ellipse 30% 22% at 50% 40%, rgba(235,230,210,0.65), transparent 70%)", // face
            "linear-gradient(180deg, #1f7a5f 0%, #156048 45%, #0c3f30 100%)",
          ].join(","),
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.25))]" />
    </div>
  );
}
