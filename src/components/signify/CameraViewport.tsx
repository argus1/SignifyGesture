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
export function CameraViewport({
  className,
  children,
  label = "Camera",
  enabled = true,
}: {
  className?: string;
  children?: ReactNode;
  label?: string;
  enabled?: boolean;
}) {
  const { devPreview, triggerCameraToggle } = useNativeBridge();
  const [native, setNative] = useState(true); // assume native until mounted, so SSR never paints over the real camera
  useEffect(() => setNative(isNativeHost()), []);

  useEffect(() => {
    if (!enabled) return;
    triggerCameraToggle(true);
    return () => triggerCameraToggle(false);
  }, [enabled, triggerCameraToggle]);

  return (
    <div
      className={cn("native-viewport relative overflow-hidden bg-transparent", className)}
      aria-label={`${label} view`}
      role="img"
    >
      {!native && <SampleScene />}
      {devPreview && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-dashed border-foreground/25"
        />
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
      className="t-btn mx-auto my-2 block rounded-full bg-card/90 px-4 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {cameraActive ? "Stop camera" : "Start camera"}
    </button>
  );
}

/** Browser-only stand-in for the camera (spec): flat #B9B9B9 in light mode, #787878 → #3D3D3D in dark. */
function SampleScene() {
  return <div aria-hidden className="camera-placeholder absolute inset-0" />;
}
