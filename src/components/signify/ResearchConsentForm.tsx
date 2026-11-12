import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/signify/ui";
import { isNativeHost, openPrivacyAndAccount } from "@/lib/nativeBridge";

export function ResearchConsentForm({ onContinue }: { onContinue: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeHost()), []);

  if (native) {
    return <PrimaryButton onClick={openPrivacyAndAccount}>Privacy & account</PrimaryButton>;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (agreed) onContinue();
      }}
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-[24px] border border-line bg-card p-5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <span className="text-[16px] font-medium leading-6">
          I agree to share my practice captures
        </span>
      </label>
      <PrimaryButton type="submit" disabled={!agreed} className="mt-5">
        Continue to secure login
      </PrimaryButton>
    </form>
  );
}
