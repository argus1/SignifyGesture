import { afterEach, describe, expect, it, vi } from "vitest";
import { executeHelpAction, HELP_ACTION_VERSION, validateHelpAction } from "@/lib/helpActions";

const action = (control: string) => ({ version: HELP_ACTION_VERSION, type: "highlight", control });
const navigate = (destination: string) => ({
  version: HELP_ACTION_VERSION,
  type: "navigate",
  destination,
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("help action policy", () => {
  it.each([
    null,
    {},
    { version: 2, type: "navigate", destination: "messages" },
    { version: 1, type: "navigate", destination: "https://example.com" },
    { version: 1, type: "navigate", destination: "__proto__" },
    { version: 1, type: "highlight", control: 'type"], button' },
    { version: 1, type: "javascript", code: "alert(1)" },
  ])("rejects malformed or injected actions: %s", (input) => {
    expect(validateHelpAction(input, "/home").ok).toBe(false);
  });

  it("rejects leaving an active conversation and unavailable controls", () => {
    expect(validateHelpAction(navigate("messages"), "/sign").ok).toBe(false);
    expect(validateHelpAction(action("camera"), "/home").ok).toBe(false);
    expect(validateHelpAction(action("type"), "/home").ok).toBe(false);
  });

  it("focuses a registered control without activating it and clears the highlight on blur", async () => {
    const button = document.createElement("button");
    button.id = "help-control-type";
    const click = vi.fn();
    button.addEventListener("click", click);
    document.body.append(button);
    const adapter = { getPath: () => "/sign", navigate: vi.fn() };
    expect(await executeHelpAction(action("type"), "/sign", adapter)).toEqual({ ok: true });
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("data-help-highlight");
    expect(click).not.toHaveBeenCalled();
    button.blur();
    expect(button).not.toHaveAttribute("data-help-highlight");
  });

  it("rejects hidden, disabled, stale, and detached controls", async () => {
    const button = document.createElement("button");
    button.id = "help-control-camera";
    document.body.append(button);
    button.disabled = true;
    expect(validateHelpAction(action("camera"), "/home").ok).toBe(false);
    button.disabled = false;
    button.hidden = true;
    expect(validateHelpAction(action("camera"), "/home").ok).toBe(false);
    button.hidden = false;
    const adapter = { getPath: () => "/memory", navigate: vi.fn() };
    expect(await executeHelpAction(action("camera"), "/home", adapter)).toEqual({
      ok: false,
      message: "The screen changed; try again.",
    });
    button.remove();
    expect(validateHelpAction(action("camera"), "/home").ok).toBe(false);
  });

  it.each([
    ["messages", "/messages"],
    ["community", "/community"],
    ["memory", "/memory"],
  ])("navigates to %s and focuses its real target", async (destination, target) => {
    let path = "/home";
    const heading = document.createElement("h1");
    heading.id = `help-destination-${destination}`;
    heading.tabIndex = -1;
    const adapter = {
      getPath: () => path,
      navigate: vi.fn(async (next: string) => {
        path = next;
        document.body.append(heading);
      }),
    };
    expect(await executeHelpAction(navigate(destination), "/home", adapter)).toEqual({ ok: true });
    expect(adapter.navigate).toHaveBeenCalledWith(target);
    expect(heading).toHaveFocus();
  });

  it("surfaces navigation failures rather than reporting success", async () => {
    const adapter = {
      getPath: () => "/home",
      navigate: vi.fn().mockRejectedValue(new Error("blocked")),
    };
    expect(await executeHelpAction(navigate("messages"), "/home", adapter)).toEqual({
      ok: false,
      message: "Could not open that screen. Try again.",
    });
  });
});
