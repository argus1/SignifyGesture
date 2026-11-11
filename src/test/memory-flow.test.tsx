import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignifyProvider, useSignify } from "@/lib/signify-store";
import { Recap } from "@/routes/recap";
import { Memory } from "@/routes/memory";
import { MemoryRecall } from "@/components/signify/MemoryRecall";
import type { MemoryData, MemoryRequest, SavedConversation } from "@/types/memory";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/signify/ui", () => ({
  TopBar: () => null,
  TabBar: () => null,
  PageTitle: ({ title }: { title: string }) => <h1>{title}</h1>,
  Pill: ({
    children,
    variant: _variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

const saved: SavedConversation = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Train ticket",
  context: "Station",
  startedAt: 1000,
  endedAt: 3000,
  recallAllowed: true,
  turns: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      sequence: 0,
      speaker: "sam",
      modality: "typed",
      text: "A return ticket please",
      timestamp: 2000,
    },
  ],
  corrections: [],
};
const empty: MemoryData = {
  generation: 0,
  recallEnabled: false,
  conversations: [],
  conversation: null,
  hits: [],
  hasMore: false,
};

function Work({ children }: { children: ReactNode }) {
  const s = useSignify();
  return (
    <>
      <button onClick={() => s.say("A return ticket please", "sam", { typed: true })}>
        Create message
      </button>
      <button onClick={() => s.addCaption("other", "Which station?", false)}>Partial speech</button>
      <button onClick={() => s.editCaption(s.captions[0]!.id, "A single ticket please")}>
        Edit message
      </button>
      <button onClick={s.undo}>Undo</button>
      <button onClick={s.markSimulation}>Simulate</button>
      <button onClick={s.reset}>Reset</button>
      {children}
    </>
  );
}

describe("conversation memory UI", () => {
  let requests: MemoryRequest[];
  function native() {
    requests = [];
    window.webkit = {
      messageHandlers: {
        aslBridge: {
          postMessage(message) {
            if (message.type === "memory") {
              requests.push(message);
              if (message.action === "state") queueMicrotask(() => respond(message));
            }
          },
        },
      },
    };
  }
  function respond(request: MemoryRequest, data = empty) {
    act(() =>
      window.NativeASLBridge?.onMemoryResult({
        version: 1,
        requestId: request.requestId,
        ok: true,
        data,
      }),
    );
  }
  function fail(request: MemoryRequest) {
    act(() =>
      window.NativeASLBridge?.onMemoryResult({
        version: 1,
        requestId: request.requestId,
        ok: false,
        error: { code: "storage", message: "Could not save memory." },
      }),
    );
  }
  async function last(action: MemoryRequest["action"]) {
    await waitFor(() => expect(requests.at(-1)?.action).toBe(action));
    return requests.at(-1)!;
  }
  function renderWork(element: ReactNode) {
    return render(
      <SignifyProvider>
        <Work>{element}</Work>
      </SignifyProvider>,
    );
  }
  afterEach(() => {
    delete window.webkit;
    delete window.NativeASLBridge;
    vi.clearAllMocks();
  });

  it("does not offer fake browser persistence or sample recaps", () => {
    renderWork(<Recap />);
    expect(screen.getByText(/Nothing is saved in this browser/)).toBeInTheDocument();
    expect(screen.queryByText("Coffee, sorted")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to memory" })).toBeDisabled();
  });

  it("saves only finalized reviewed text after consent and native commit", async () => {
    native();
    renderWork(<Recap />);
    fireEvent.click(screen.getByText("Create message"));
    fireEvent.click(screen.getByText("Partial speech"));
    fireEvent.click(screen.getByText("Edit message"));
    fireEvent.click(screen.getByLabelText("Save this transcript on my device"));
    expect(screen.getByLabelText(/Allow the agent/)).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save to memory" }));
    const request = await last("save");
    if (request.action !== "save") throw new Error("Missing save request");
    expect(request.conversation.turns).toHaveLength(1);
    expect(request.conversation.turns[0]).toMatchObject({
      text: "A single ticket please",
      modality: "typed",
    });
    expect(request.conversation.recallAllowed).toBe(false);
    expect(screen.getByRole("button", { name: "Finish without saving" })).toBeDisabled();
    expect(screen.queryByText("Saved on this device.")).not.toBeInTheDocument();
    respond(request, { ...empty, generation: 1, conversation: request.conversation });
    await screen.findByText("Saved on this device.");
    expect(requests.filter((r) => r.action === "save")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/home" });
  });

  it("shows failed saves and retries using the same stable conversation and turn IDs", async () => {
    native();
    renderWork(<Recap />);
    fireEvent.click(screen.getByText("Create message"));
    fireEvent.click(screen.getByLabelText("Save this transcript on my device"));
    fireEvent.click(screen.getByRole("button", { name: "Save to memory" }));
    const first = await last("save");
    fail(first);
    await screen.findByRole("alert");
    expect(screen.queryByText("Saved on this device.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save to memory" }));
    await waitFor(() => expect(requests.filter((r) => r.action === "save")).toHaveLength(2));
    const retry = requests.at(-1)!;
    if (retry.action !== "save" || first.action !== "save") throw new Error("Missing retry");
    expect(retry.conversation.id).toBe(first.conversation.id);
    expect(retry.conversation.turns).toEqual(first.conversation.turns);
    respond(retry, { ...empty, generation: 1, conversation: retry.conversation });
    await screen.findByText("Saved on this device.");
  });

  it("prevents simulator fixtures from entering personal memory", () => {
    native();
    renderWork(<Recap />);
    fireEvent.click(screen.getByText("Create message"));
    fireEvent.click(screen.getByText("Simulate"));
    expect(screen.getByRole("button", { name: "Save to memory" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Simulator conversations cannot be saved");
  });

  it("loads real summaries and detail instead of navigating to learn; deletion awaits acknowledgement", async () => {
    native();
    renderWork(<Memory />);
    const { turns, corrections: _corrections, ...summary } = saved;
    respond(await last("list"), {
      ...empty,
      conversations: [{ ...summary, preview: turns[0]!.text, turnCount: 1 }],
    });
    fireEvent.click(await screen.findByRole("button", { name: /Train ticket/ }));
    respond(await last("detail"), { ...empty, conversation: saved });
    expect(await screen.findByRole("region", { name: "Saved conversation" })).toHaveTextContent(
      "A return ticket please",
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete conversation" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
    const deletion = await last("delete");
    expect(screen.getByText("A return ticket please")).toBeInTheDocument();
    respond(deletion, { ...empty, generation: 1 });
    respond(await last("list"), { ...empty, generation: 1 });
    expect(await screen.findByText("No saved conversations yet.")).toBeInTheDocument();
    expect(screen.queryByText("A return ticket please")).not.toBeInTheDocument();
  });

  it("never treats a storage read error as an empty database", async () => {
    native();
    renderWork(<Memory />);
    fail(await last("list"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save memory");
    expect(screen.queryByText("No saved conversations yet.")).not.toBeInTheDocument();
  });

  it("recalls only on explicit request and displays source attribution, not an AI suggestion", async () => {
    native();
    renderWork(<MemoryRecall />);
    fireEvent.change(screen.getByLabelText("Search saved words"), { target: { value: "ticket" } });
    expect(requests).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Search saved conversations" }));
    respond(await last("search"), {
      ...empty,
      recallEnabled: true,
      hits: [
        {
          conversationId: saved.id,
          turnId: saved.turns[0]!.id,
          text: saved.turns[0]!.text,
          speaker: "sam",
          timestamp: 2000,
          title: saved.title,
        },
      ],
    });
    expect(await screen.findByText("A return ticket please")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("not generated suggestions");
    expect(screen.getByRole("link", { name: /From saved conversation/ })).toHaveAttribute(
      "href",
      "/memory",
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores recall responses when the query or conversation changes", async () => {
    native();
    renderWork(<MemoryRecall />);
    fireEvent.change(screen.getByLabelText("Search saved words"), { target: { value: "ticket" } });
    fireEvent.click(screen.getByRole("button", { name: "Search saved conversations" }));
    const query = await last("search");
    fireEvent.change(screen.getByLabelText("Search saved words"), { target: { value: "tea" } });
    respond(query, {
      ...empty,
      recallEnabled: true,
      hits: [
        {
          conversationId: saved.id,
          turnId: saved.turns[0]!.id,
          text: saved.turns[0]!.text,
          speaker: "sam",
          timestamp: 2000,
          title: saved.title,
        },
      ],
    });
    expect(screen.queryByText("A return ticket please")).not.toBeInTheDocument();
  });
});
