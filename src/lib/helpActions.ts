export const HELP_ACTION_VERSION = 1 as const;

const destinations = {
  messages: { path: "/messages", focusId: "help-destination-messages" },
  community: { path: "/community", focusId: "help-destination-community" },
  memory: { path: "/memory", focusId: "help-destination-memory" },
} as const;

const controls = {
  camera: { id: "help-control-camera", paths: ["/home", "/sign"] },
  type: { id: "help-control-type", paths: ["/sign"] },
} as const;

export type HelpDestination = keyof typeof destinations;
export type HelpControl = keyof typeof controls;
export type HelpAction =
  | { version: typeof HELP_ACTION_VERSION; type: "navigate"; destination: HelpDestination }
  | { version: typeof HELP_ACTION_VERSION; type: "highlight"; control: HelpControl };
export type HelpActionResult = { ok: true } | { ok: false; message: string };

type RouterAdapter = {
  getPath: () => string;
  navigate: (path: (typeof destinations)[HelpDestination]["path"]) => Promise<void>;
};

const navigationSources = ["/home", "/messages", "/community", "/memory", "/learn"];

function isAvailable(element: HTMLElement | null): element is HTMLElement {
  if (!element || !element.isConnected || element.matches(":disabled")) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.hidden || node.inert || node.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

function focusElement(element: HTMLElement | null): HelpActionResult {
  if (!isAvailable(element))
    return { ok: false, message: "That target is not available on this screen." };
  element.focus({ preventScroll: true });
  if (document.activeElement !== element) {
    return { ok: false, message: "Could not move focus to that target." };
  }
  element.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  element.setAttribute("data-help-highlight", "");
  element.addEventListener("blur", () => element.removeAttribute("data-help-highlight"), {
    once: true,
  });
  return { ok: true };
}

/** Validate untrusted action data without evaluating it as a selector, URL, or code. */
export function validateHelpAction(input: unknown, path: string): HelpActionResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Unknown help action." };
  }
  const action = input as Record<string, unknown>;
  if (action["version"] !== HELP_ACTION_VERSION)
    return { ok: false, message: "Unsupported help action version." };
  if (action["type"] === "navigate") {
    if (
      typeof action["destination"] !== "string" ||
      !Object.hasOwn(destinations, action["destination"])
    ) {
      return { ok: false, message: "Unknown destination." };
    }
    if (!navigationSources.includes(path)) {
      return {
        ok: false,
        message: "Navigation from this screen is unavailable. Close help to continue your work.",
      };
    }
    return { ok: true };
  }
  if (action["type"] === "highlight") {
    if (typeof action["control"] !== "string" || !Object.hasOwn(controls, action["control"])) {
      return { ok: false, message: "Unknown control." };
    }
    const target = controls[action["control"] as HelpControl];
    if (
      !(target.paths as readonly string[]).includes(path) ||
      !isAvailable(document.getElementById(target.id))
    ) {
      return { ok: false, message: "That control is not available on this screen." };
    }
    return { ok: true };
  }
  return { ok: false, message: "Unknown help action." };
}

/** Called only after an explicit user choice and after the help dialog has closed. */
export async function executeHelpAction(
  input: unknown,
  sourcePath: string,
  router: RouterAdapter,
): Promise<HelpActionResult> {
  if (router.getPath() !== sourcePath)
    return { ok: false, message: "The screen changed; try again." };
  const validation = validateHelpAction(input, sourcePath);
  if (!validation.ok) return validation;
  const action = input as HelpAction;
  if (action.type === "highlight")
    return focusElement(document.getElementById(controls[action.control].id));

  const destination = destinations[action.destination];
  try {
    await router.navigate(destination.path);
  } catch {
    return { ok: false, message: "Could not open that screen. Try again." };
  }
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (router.getPath() !== destination.path)
      return { ok: false, message: "Could not open that screen." };
    const element = document.getElementById(destination.focusId);
    if (isAvailable(element)) return focusElement(element);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return { ok: false, message: "The screen opened, but its heading could not be focused." };
}
