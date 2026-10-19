import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "@/marketing/MarketingHome";

const siteOrigin = "https://jamscript.lukavacheishvili.workers.dev";

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
      { property: "og:url", content: siteOrigin },
      { property: "og:site_name", content: "JamScript" },
      { property: "og:image", content: `${siteOrigin}/brand/og-image.png` },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "JamScript music workbench with Strudel code and rhythm controls",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${siteOrigin}/brand/og-image.png` },
    ],
    links: [{ rel: "canonical", href: siteOrigin }],
  }),
  component: MarketingHome,
});
