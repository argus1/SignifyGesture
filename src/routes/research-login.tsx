import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Header, PageTitle, Screen } from "@/components/signify/ui";
import { validatePracticeSearch } from "@/lib/practice-capture";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/research-login")({
  validateSearch: validatePracticeSearch,
  head: () =>
    seo("Research login", "The secure research login placeholder for ASL practice contributors."),
  component: ResearchLogin,
});

function ResearchLogin() {
  const { sign } = Route.useSearch();
  const practiceSearch = sign ? { sign } : {};

  return (
    <Screen>
      <Header
        left={
          <Link
            to="/contribute"
            search={practiceSearch}
            aria-label="Back to consent"
            className="grid h-11 w-11 place-items-center rounded-full border-[0.5px] border-line-icon bg-card/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <PageTitle title="Research login" />
      <div className="px-5 pt-6">
        <div className="rounded-[24px] border border-line bg-card p-5">
          <h2 className="text-[20px] font-medium">Secure login coming soon</h2>
          <p className="mt-3 text-[15px] leading-6 text-ink-2">
            This placeholder is ready for the S3 / Cognito research login. No account details are
            collected in this prototype.
          </p>
        </div>
        <Link
          to="/learn"
          search={practiceSearch}
          className="t-btn mt-6 inline-flex h-16 w-full items-center justify-center rounded-full bg-primary px-6 text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        >
          Return to Learn ASL
        </Link>
      </div>
    </Screen>
  );
}
