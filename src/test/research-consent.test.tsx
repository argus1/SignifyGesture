import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResearchConsentForm } from "@/components/signify/ResearchConsentForm";

describe("research consent", () => {
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
