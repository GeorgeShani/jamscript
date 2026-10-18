import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { PresenceAvatars, PresenceTabDots } from "@/features/collaboration/PresenceAvatars";
import { TooltipProvider } from "@/components/ui/tooltip";

afterEach(() => {
  cleanup();
});

it("shows named collaborator avatars with document context", () => {
  render(
    <TooltipProvider>
      <PresenceAvatars
        people={[
          {
            id: "user_a",
            clientId: "1",
            name: "Nico Kim",
            color: "#58B3F6",
            track: 1,
            documentName: "bass.js",
          },
        ]}
      />
    </TooltipProvider>,
  );
  const avatar = screen.getByLabelText("Nico Kim · bass.js");
  expect(avatar).toHaveTextContent("NK");
  act(() => avatar.focus());
  expect(document.activeElement).toBe(avatar);
});

it("renders tab dots for peers in a file", () => {
  const { container } = render(
    <PresenceTabDots
      people={[
        { id: "a", clientId: "1", name: "Ada", color: "#58B3F6", track: 1 },
        { id: "b", clientId: "2", name: "Gus", color: "#ED7EC7", track: 2 },
      ]}
    />,
  );
  expect(container.querySelectorAll(".jam-tab-presence-dot")).toHaveLength(2);
});
