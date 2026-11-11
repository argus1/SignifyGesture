import { describe, expect, it } from "vitest";
import {
  getHelpContext,
  helpAgentUnavailableMessage,
  helpScreenForPath,
  HELP_CONTRACT_VERSION,
  planHelpInference,
  searchHelp,
} from "@/lib/help";

const context = getHelpContext({
  screen: "conversation",
  nativeHost: true,
  cameraActive: true,
  tracking: "tracking",
  recognition: "modelUnavailable",
  speech: "denied",
});

describe("help content and context", () => {
  it("only exposes the explicitly selected, versioned state", () => {
    expect(context).toEqual({
      version: HELP_CONTRACT_VERSION,
      screen: "conversation",
      nativeHost: true,
      cameraActive: true,
      tracking: "tracking",
      recognition: "modelUnavailable",
      speech: "denied",
    });
  });

  it("does not include dynamic route identifiers in the context", () => {
    expect(helpScreenForPath("/messages/private-id")).toBe("messages");
    expect(helpScreenForPath("/unexpected/private-id")).toBe("other");
  });

  it.each([
    ["camera permission", "camera"],
    ["hand tracking", "tracking"],
    ["recognition model", "model"],
    ["edit caption", "correction"],
    ["speech microphone", "speech"],
    ["offline cloud", "local-cloud"],
    ["signing avatar", "avatar"],
  ])("finds the %s topic", (query, id) => {
    expect(searchHelp(query, context).map((topic) => topic.id)).toContain(id);
  });

  it("gives explicit limitations instead of inventing readiness or an answer", () => {
    expect(
      searchHelp("recognition model", context).find((topic) => topic.id === "model")?.answer,
    ).toContain("unavailable");
    expect(searchHelp("tracking", context)[0]?.answer).toContain("not the same");
    expect(searchHelp("speech", context)[0]?.answer).toContain("denied");
    expect(searchHelp("avatar", context)[0]?.answer).toContain("not currently available");
    expect(searchHelp("quasar", context)).toEqual([]);
    const unknown = getHelpContext({ ...context, recognition: "unknown" });
    expect(searchHelp("model", unknown)[0]?.answer).toContain("not been reported");
  });
});

describe("future inference routing policy", () => {
  it.each([
    ["online", "ready", { primary: "cloud", validation: "local" }],
    ["online", "unavailable", { primary: "cloud", validation: "cloud" }],
    ["online", "unknown", { primary: "unavailable", reason: "local-readiness-unknown" }],
    ["offline", "ready", { primary: "local", validation: "none" }],
    ["unstable", "ready", { primary: "local", validation: "none" }],
    ["offline", "unavailable", { primary: "unavailable", reason: "offline" }],
    ["unstable", "unknown", { primary: "unavailable", reason: "local-readiness-unknown" }],
  ] as const)("plans %s with local model %s", (connection, local, expected) => {
    expect(planHelpInference(connection, local)).toEqual(expected);
  });

  it("does not claim the planned providers exist", () => {
    expect(helpAgentUnavailableMessage("offline")).toContain("You are offline");
    expect(helpAgentUnavailableMessage("online")).toContain("not connected");
  });
});
