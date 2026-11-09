export const seo = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Signify` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Signify` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
