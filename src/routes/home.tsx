import { createFileRoute } from "@tanstack/react-router";
import { TopBar, Headline, PillLink } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/home")({
  head: () => seo("Home", "Start a conversation, check messages, or meet the community."),
  component: Home,
});

function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col justify-between px-6 pb-20 pt-10">
        <Headline dark="Hello Sam!" soft="What would you like to do today?" className="text-[46px]" />
        <nav className="grid gap-3" aria-label="Main">
          <PillLink to="/translate" variant="mint">Translate a conversation</PillLink>
          <PillLink to="/messages">Check your messages</PillLink>
          <PillLink to="/community">Community</PillLink>
          <PillLink to="/memory">Conversation memory</PillLink>
        </nav>
      </div>
    </div>
  );
}
