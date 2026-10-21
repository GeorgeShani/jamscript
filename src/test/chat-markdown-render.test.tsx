import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChatMarkdown } from "@/features/assistant/chat-markdown";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders GFM structure, highlighted code and a copyable source", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(navigator), { clipboard: { writeText: copy } }),
  );
  const { container } = render(
    <ChatMarkdown
      text={
        '## A kick pattern\n\nUse **gain** and `s()`.\n\n| Sound | Level |\n| --- | --- |\n| bd | 0.4 |\n\n> Keep the pulse.\n\n- [x] Add a kick\n- [ ] Add hats\n\n```js\nconst drums = s("bd").gain(0.4);\n```'
      }
    />,
  );
  expect(screen.getByRole("heading", { name: "A kick pattern" })).toBeInTheDocument();
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByText("Keep the pulse.").closest("blockquote")).toBeTruthy();
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(container.querySelector(".jam-chat-code .tok-keyword")).toHaveTextContent("const");
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith('const drums = s("bd").gain(0.4);'));
  expect(screen.getByRole("button", { name: "Code copied" })).toBeInTheDocument();
});

it("blocks executable HTML and unsafe links from model responses", () => {
  const { container } = render(
    <ChatMarkdown
      text={
        "<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)\n\n[Strudel](https://strudel.cc)\n\n<img src=x onerror=alert(1)>"
      }
    />,
  );
  expect(container.querySelector("script, img")).toBeNull();
  expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Strudel" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
});

it("keeps an unfinished streamed code fence readable", () => {
  const { container, rerender } = render(<ChatMarkdown text={'```js\ns("bd").gain('} />);
  expect(container.querySelector("pre")).toHaveTextContent('s("bd").gain(');
  rerender(<ChatMarkdown text={'```js\ns("bd").gain(0.4)\n```'} />);
  expect(container.querySelectorAll("pre")).toHaveLength(1);
  expect(container.querySelector("pre")).toHaveTextContent('s("bd").gain(0.4)');
});
