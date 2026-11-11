import { useState } from "react";
import { CircleHelp } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getHelpContext,
  helpAgentUnavailableMessage,
  helpScreenForPath,
  HELP_TOPICS,
  searchHelp,
} from "@/lib/help";
import { isNativeHost } from "@/lib/nativeBridge";
import { useNativeBridge, useSignify } from "@/lib/signify-store";
import { cn } from "@/lib/utils";

export function HelpButton({
  className,
  onStopListening,
}: {
  className?: string | undefined;
  onStopListening?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [agentMessage, setAgentMessage] = useState("");
  const engine = useNativeBridge();
  const { recognitionStatus } = useSignify();
  const context = getHelpContext({
    screen: helpScreenForPath(typeof window === "undefined" ? "" : window.location.pathname),
    nativeHost: isNativeHost(),
    cameraActive: engine.cameraActive,
    tracking: engine.tracking,
    recognition: recognitionStatus?.state ?? "unknown",
    speech: engine.speechStatus?.state ?? "unknown",
  });
  const results = searchHelp(query, context);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setAgentMessage("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Help"
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full bg-background/90 text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
            className,
          )}
        >
          <CircleHelp className="h-6 w-6" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent inPhone side="bottom" className="max-h-[90%] overflow-y-auto rounded-t-[2rem]">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl font-black">Help</SheetTitle>
          <SheetDescription>
            Search instructions for this app. Closing help returns you to your work.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor="help-search" className="mb-2 block font-semibold">
              Search help
            </label>
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setAgentMessage("");
              }}
              maxLength={300}
              placeholder="Search or enter a question"
              className="min-h-12 w-full rounded-xl border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
            />
          </div>
          {!query && (
            <div>
              <p className="mb-2 font-semibold">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {HELP_TOPICS.slice(0, 6).map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setQuery(topic.question)}
                    className="min-h-11 rounded-xl bg-muted px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
                  >
                    {topic.question}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() =>
                setAgentMessage(
                  helpAgentUnavailableMessage(navigator.onLine ? "online" : "offline"),
                )
              }
              className="min-h-11 rounded-full border border-foreground px-4 font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
            >
              Ask AI help
            </button>
            <p className="mt-2 text-sm text-muted-foreground">
              AI help is not connected in this build.
            </p>
            {agentMessage && (
              <p role="status" className="mt-2 text-sm">
                {agentMessage}
              </p>
            )}
          </div>
          {engine.ttsPlaying && (
            <button
              type="button"
              onClick={engine.stopTTSPlayback}
              className="min-h-11 rounded-full border border-foreground px-4 font-semibold"
            >
              Stop speaking
            </button>
          )}
          {onStopListening && (
            <button
              type="button"
              onClick={onStopListening}
              className="min-h-11 rounded-full border border-foreground px-4 font-semibold"
            >
              Stop listening
            </button>
          )}
          {context.nativeHost && engine.cameraActive && (
            <button
              type="button"
              onClick={() => engine.triggerCameraToggle(false)}
              className="min-h-11 rounded-full border border-foreground px-4 font-semibold"
            >
              Stop camera
            </button>
          )}
          <section aria-label="Help results" aria-live="polite">
            <h2 className="mb-2 font-bold">{query ? "Search results" : "Instructions"}</h2>
            {results.length === 0 ? (
              <p>There is no matching instruction. Try a different search.</p>
            ) : (
              <div className="space-y-4">
                {results.map((result) => (
                  <article key={result.id} className="rounded-2xl bg-muted p-4">
                    <h3 className="font-bold">{result.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed">{result.answer}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
          <button
            type="button"
            onClick={() => changeOpen(false)}
            className="min-h-11 rounded-full bg-primary px-5 font-semibold"
          >
            Close and return
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
