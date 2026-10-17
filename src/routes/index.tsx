import { createFileRoute } from "@tanstack/react-router";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "JamScript | Music workspaces" },
      {
        name: "description",
        content: "Create a music workspace, write Strudel code, and play it in JamScript.",
      },
      { property: "og:title", content: "JamScript | Music workspaces" },
      {
        property: "og:description",
        content: "Create a music workspace, write Strudel code, and play it in JamScript.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionWorkbench,
});
