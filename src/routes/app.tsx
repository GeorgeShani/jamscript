import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "JamScript | Workspaces" },
      {
        name: "description",
        content: "Create a local browser workspace, write Strudel code and play your music.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Outlet,
});
