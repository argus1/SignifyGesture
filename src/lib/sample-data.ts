export type Msg = { me: boolean; text: string; video?: boolean };
export type Thread = {
  id: string;
  name: string;
  status: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: Msg[];
};

export const THREADS: Thread[] = [
  {
    id: "candace",
    name: "Candace",
    status: "Online",
    preview: "Signed video · “See you Saturday!”",
    time: "2m",
    unread: true,
    messages: [
      { me: false, text: "It was so nice meeting you today!" },
      { me: true, text: "You too! Thanks for being patient with me." },
      { me: false, text: "See you at the meetup on Saturday?", video: true },
      { me: true, text: "Yes! Can you teach me the sign for “coffee”?" },
    ],
  },
  {
    id: "jon",
    name: "Jon Fischer",
    status: "Last seen 1h ago",
    preview: "Missed call · tap to call back",
    time: "1h",
    unread: true,
    messages: [
      { me: false, text: "Tried to call. Free later?" },
      { me: true, text: "Yes! Call me after 5." },
    ],
  },
  {
    id: "asl-coffee",
    name: "ASL Coffee Group",
    status: "12 members",
    preview: "Maya: who is bringing snacks?",
    time: "3h",
    unread: false,
    messages: [
      { me: false, text: "Who is bringing snacks?", video: true },
      { me: true, text: "I'll bring cookies!" },
    ],
  },
  {
    id: "mom",
    name: "Mom",
    status: "Online",
    preview: "Love you hun",
    time: "Yesterday",
    unread: false,
    messages: [
      { me: true, text: "Got my latte all by myself today!" },
      { me: false, text: "Love you hun" },
    ],
  },
  {
    id: "barista",
    name: "Barista at Blue Bottle",
    status: "Business",
    preview: "Your order is ready",
    time: "Mon",
    unread: false,
    messages: [
      { me: false, text: "Your order is ready" },
      { me: true, text: "Thank you!" },
    ],
  },
];

export const LEARN_SIGNS = [
  { gloss: "Develop", videoId: "0bo8d1CqbV8" },
  { gloss: "Decide", videoId: "EDQofKa0Jiw" },
  { gloss: "Cloud", videoId: "Nnr6Mnv2b80" },
  { gloss: "Research", videoId: "8hSsLSpjwDQ" },
  { gloss: "Edit", videoId: "85cA3gbTx_A" },
] as const;

export const SIGNS = LEARN_SIGNS.map(({ gloss }) => gloss);
