import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, MessageCircle } from "lucide-react";
import { TopBar, Headline, Pill, Avatar } from "@/components/signify/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/community")({
  head: () => seo("Community", "Events, groups and people in the Deaf and hearing community."),
  component: Community,
});

const EVENTS = [
  { title: "ASL Coffee Meetup", when: "Sat 10:00 · Bean There Café", going: 24 },
  { title: "Deaf & Hearing Book Club", when: "Wed 19:00 · Library, Room 2", going: 12 },
  { title: "Beginner ASL", when: "Mon 18:30 · Online", going: 58 },
];
const GROUPS = ["ASL Learners", "Deaf Parents Network", "Signing Gamers"];
const PEOPLE = ["Maya", "Leo", "Priya", "Jordan"];

function Community() {
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="px-6 pt-4"><Headline dark="Community" soft="Meet people." /></div>
      <Tabs defaultValue="events" className="mt-5 px-5 pb-20">
        <TabsList className="grid h-12 w-full grid-cols-3 rounded-full">
          <TabsTrigger value="events" className="rounded-full">Events</TabsTrigger>
          <TabsTrigger value="groups" className="rounded-full">Groups</TabsTrigger>
          <TabsTrigger value="people" className="rounded-full">People</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="space-y-3 pt-3">
          {EVENTS.map((e) => (
            <article key={e.title} className="rounded-3xl border-2 border-foreground p-4">
              <h2 className="headline text-2xl">{e.title}</h2>
              <p className="mt-1">{e.when}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button onClick={() => setLikes((l) => ({ ...l, [e.title]: !l[e.title] }))} aria-pressed={!!likes[e.title]} className="flex min-h-11 items-center gap-1 font-bold">
                  <Heart className={likes[e.title] ? "h-5 w-5 fill-foreground" : "h-5 w-5"} /> {e.going + (likes[e.title] ? 1 : 0)} going
                </button>
                <span className="flex items-center gap-1 text-muted-foreground"><MessageCircle className="h-5 w-5" /> 4</span>
                <Pill size="sm" variant="mint" onClick={() => toast.success(`You're going to ${e.title}`)}>Join</Pill>
              </div>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="groups" className="space-y-3 pt-3">
          {GROUPS.map((g) => <div key={g} className="flex items-center justify-between rounded-3xl border-2 border-foreground p-4"><b className="text-lg">{g}</b><Pill size="sm" onClick={() => toast.success(`Joined ${g}`)}>Join</Pill></div>)}
        </TabsContent>
        <TabsContent value="people" className="grid grid-cols-2 gap-3 pt-3">
          {PEOPLE.map((p, i) => <div key={p} className="flex flex-col items-center gap-2 rounded-3xl border-2 border-foreground p-4"><Avatar label={p} size={64} tone={i} /><b>{p}</b><Pill size="sm" onClick={() => toast.success(`Said hi to ${p}`)}>Say hi</Pill></div>)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
