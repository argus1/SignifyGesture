import { createFileRoute, redirect } from "@tanstack/react-router";

// The mode choice now lives on Home; keep this path working for old links.
export const Route = createFileRoute("/translate")({
  beforeLoad: () => { throw redirect({ to: "/home" }); },
});
