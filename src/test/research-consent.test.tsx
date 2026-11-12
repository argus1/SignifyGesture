import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResearchConsentForm } from "@/components/signify/ResearchConsentForm";

describe("research consent", () => {
  afterEach(() => {
    delete window.webkit;
  });

  it("opens native privacy controls instead of collecting consent in the web UI", () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    const onContinue = vi.fn();
    render(<ResearchConsentForm onContinue={onContinue} />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Privacy & account" }));
    expect(postMessage).toHaveBeenCalledWith({ type: "openPrivacyAndAccount" });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("keeps secure login disabled until the contributor agrees", () => {
    const onContinue = vi.fn();
    render(<ResearchConsentForm onContinue={onContinue} />);

    const button = screen.getByRole("button", { name: "Continue to secure login" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "I agree to share my practice captures" }),
    );
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
