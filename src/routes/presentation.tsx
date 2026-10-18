import { createFileRoute } from "@tanstack/react-router";
import { PresentationPage } from "@/presentation/PresentationPage";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "JamScript — stage presentation" },
      {
        name: "description",
        content:
          "A seven-slide animated pitch for JamScript: the music code is the song, and controls are another way to play it.",
      },
    ],
  }),
  component: PresentationPage,
});
