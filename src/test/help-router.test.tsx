import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpButton } from "@/components/signify/HelpButton";
import { PageTitle } from "@/components/signify/ui";
import { SignifyProvider } from "@/lib/signify-store";
import { Conversation } from "@/routes/sign";

const rootRoute = createRootRoute({
  component: () => (
    <SignifyProvider>
      <Outlet />
    </SignifyProvider>
  ),
});
const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign",
    component: () => <Conversation />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/learn",
    component: () => <HelpButton />,
  }),
  ...(["messages", "community", "memory"] as const).map((destination) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: `/${destination}`,
      component: () => (
        <>
          <HelpButton />
          <PageTitle
            title={destination[0]!.toUpperCase() + destination.slice(1)}
            helpFocusId={`help-destination-${destination}`}
          />
        </>
      ),
    }),
  ),
]);

async function openAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByRole("button", { name: "Help" });
  return router;
}

afterEach(() => {
  delete window.webkit;
  delete window.NativeASLBridge;
  vi.restoreAllMocks();
});

describe("help actions through the app router", () => {
  it.each([
    ["Messages", "/messages"],
    ["Community", "/community"],
    ["Memory", "/memory"],
  ])("opens %s and focuses its heading", async (label, path) => {
    const router = await openAt("/learn");
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") }));
    await waitFor(() => expect(router.state.location.pathname).toBe(path));
    await waitFor(() => expect(screen.getByRole("heading", { name: label })).toHaveFocus());
  });

  it("finds the typing control without switching mode or losing the typed draft", async () => {
    const router = await openAt("/sign");
    fireEvent.click(screen.getByRole("button", { name: "Type" }));
    const input = screen.getByLabelText("Type your message");
    fireEvent.change(input, { target: { value: "Keep my draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.queryByRole("region", { name: "Go to a screen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show type control" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Type" })).toHaveFocus());
    expect(screen.getByLabelText("Type your message")).toHaveValue("Keep my draft");
    expect(router.state.location.pathname).toBe("/sign");
  });

  it("finds the native camera control without sending a camera command", async () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    await openAt("/sign");
    postMessage.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("button", { name: "Show camera control" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start camera" })).toHaveFocus());
    expect(postMessage).not.toHaveBeenCalled();
  });
});
