import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ResearchConsentForm } from "@/components/signify/ResearchConsentForm";
import { Header, PageTitle, Screen } from "@/components/signify/ui";
import { validatePracticeSearch } from "@/lib/practice-capture";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/contribute")({
  validateSearch: validatePracticeSearch,
  head: () =>
    seo(
      "Contribute your practice",
      "Choose whether to share optional ASL practice captures with sign-recognition research.",
    ),
  component: Contribute,
});

function Contribute() {
  const { sign } = Route.useSearch();
  const navigate = useNavigate();
  const practiceSearch = sign ? { sign } : {};

  return (
    <Screen>
      <Header
        left={
          <Link
            to="/learn"
            search={practiceSearch}
            aria-label="Back to Learn ASL"
            className="grid h-11 w-11 place-items-center rounded-full border-[0.5px] border-line-icon bg-card/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <PageTitle title="Contribute your practice" />
        <div className="px-5 pt-6">
          <div className="rounded-[24px] bg-surface p-5">
            <p className="text-[16px] leading-6">
              Practice captures are optional. If you share them, they can help grow the ASL Citizen
              dataset for sign-recognition research.
            </p>
            <p className="mt-4 text-[14px] leading-6 text-ink-2">
              You can keep practicing without contributing. Only captures you agree to share will be
              included.
            </p>
          </div>
          <div className="pt-6">
            <ResearchConsentForm
              onContinue={() => navigate({ to: "/research-login", search: practiceSearch })}
            />
          </div>
          <div className="pt-5 text-center">
            <Link
              to="/learn"
              search={practiceSearch}
              className="inline-flex min-h-11 items-center justify-center px-5 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Not now
            </Link>
          </div>
        </div>
      </div>
    </Screen>
  );
}
