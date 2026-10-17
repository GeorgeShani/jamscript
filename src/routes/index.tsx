import { createFileRoute } from "@tanstack/react-router";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Night bus | JamScript" },
      {
        name: "description",
        content:
          "Jam on the Night bus session in JamScript: code, knobs and step grids in one view.",
      },
      { property: "og:title", content: "Night bus | JamScript" },
      {
        property: "og:description",
        content:
          "Jam on the Night bus session in JamScript: code, knobs and step grids in one view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionWorkbench,
});
