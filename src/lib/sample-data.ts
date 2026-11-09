export const THREADS = [
  { id: "maya", name: "Maya", preview: "See you at the meetup!", time: "2m", unread: true,
    messages: [{ me: false, text: "Hey Sam! Are you coming to ASL Coffee on Saturday?" }, { me: true, text: "Yes! I'll bring my friend Leo." }, { me: false, text: "See you at the meetup!" }] },
  { id: "barista", name: "Jordan (Barista)", preview: "Your latte is ready ☕", time: "1h", unread: true,
    messages: [{ me: false, text: "Your latte is ready ☕" }, { me: true, text: "Thank you!" }] },
  { id: "leo", name: "Leo", preview: "Can you teach me the sign for 'coffee'?", time: "Yesterday", unread: false,
    messages: [{ me: false, text: "Can you teach me the sign for 'coffee'?" }, { me: true, text: "Of course — here's a video." }] },
];
export const SIGNS = ["Coffee", "Iced", "Milk", "Thank you", "Oat", "Latte"];
