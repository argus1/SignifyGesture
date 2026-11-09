import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old "I speak" screen. Speech now lives in the conversation screen's speech mode. */
export const Route = createFileRoute("/speak")({
  beforeLoad: () => { throw redirect({ to: "/sign", search: { mode: "speech" } }); },
});
