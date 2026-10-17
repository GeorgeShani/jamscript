import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "@/marketing/MarketingHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JamScript — make music in code" },
      {
        name: "description",
        content:
          "Write and play Strudel music in a focused workbench. Shape rhythm and sound with controls that edit your code, then export your mix.",
      },
      { property: "og:title", content: "JamScript — make music in code" },
      {
        property: "og:description",
        content: "A music workbench where code is the source and controls are how you play it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketingHome,
});
