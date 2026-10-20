import { createFileRoute } from "@tanstack/react-router";
import { DesktopConnect } from "@/features/account/DesktopConnect";

export const Route = createFileRoute("/desktop/connect")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search["mode"] === "sign-up" ? ("sign-up" as const) : ("sign-in" as const),
    user_code:
      typeof search["user_code"] === "string" && /^[A-Z0-9-]{4,32}$/i.test(search["user_code"])
        ? search["user_code"]
        : "",
  }),
  head: () => ({
    meta: [
      { title: "Connect desktop · JamScript" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const { user_code, mode } = Route.useSearch();
  return <DesktopConnect userCode={user_code} mode={mode} />;
}
