import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DismissibleDetails } from "@/components/ui/dismissible-details";

function Fixture({ dismissOnOutside = true }: { dismissOnOutside?: boolean }) {
  return (
    <div>
      <button type="button">Elsewhere</button>
      <DismissibleDetails data-testid="menu" dismissOnOutside={dismissOnOutside} open>
        <summary>Menu</summary>
        <input aria-label="Inside" />
      </DismissibleDetails>
    </div>
  );
}

describe("DismissibleDetails", () => {
  it("closes on a press outside but not on one inside", () => {
    render(<Fixture />);
    const menu = screen.getByTestId("menu") as HTMLDetailsElement;
    fireEvent.pointerDown(screen.getByLabelText("Inside"));
    expect(menu.open).toBe(true);
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(menu.open).toBe(false);
  });

  it("closes on Escape from inside and returns focus to the summary", () => {
    render(<Fixture />);
    const menu = screen.getByTestId("menu") as HTMLDetailsElement;
    screen.getByLabelText("Inside").focus();
    fireEvent.keyDown(screen.getByLabelText("Inside"), { key: "Escape" });
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(screen.getByText("Menu"));
  });

  it("stays open when outside dismissal is disabled", () => {
    render(<Fixture dismissOnOutside={false} />);
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect((screen.getByTestId("menu") as HTMLDetailsElement).open).toBe(true);
  });
});
