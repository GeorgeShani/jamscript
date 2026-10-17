import { useEffect, useMemo, useRef, useState } from "react";

export interface WorkbenchCommand {
  id: string;
  label: string;
  group: "Files" | "Commands";
  keywords?: string;
  run: () => void;
}

interface Props {
  mode: "files" | "commands";
  commands: WorkbenchCommand[];
  onClose: (restoreFocus?: boolean) => void;
}

/** Quick Open and the command palette share one registry and keyboard behavior. */
export function CommandPalette({ mode, commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return commands.filter(
      (command) =>
        command.group === (mode === "files" ? "Files" : "Commands") &&
        `${command.label} ${command.keywords ?? ""}`.toLocaleLowerCase().includes(term),
    );
  }, [commands, mode, query]);

  useEffect(() => input.current?.focus(), []);
  const choose = (command: WorkbenchCommand) => {
    onClose(false);
    command.run();
  };

  return (
    <div
      className="jam-command-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="jam-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "files" ? "Quick Open" : "Command palette"}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>("input, button"),
          );
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <input
          ref={input}
          role="combobox"
          aria-label={mode === "files" ? "Find a file" : "Find a command"}
          aria-controls="jam-command-results"
          aria-expanded="true"
          aria-activedescendant={
            results[selected] ? `jam-command-${results[selected].id}` : undefined
          }
          placeholder={mode === "files" ? "Search files by name" : "Type a command"}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              if (results.length) setSelected((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelected((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter" && results[selected]) {
              event.preventDefault();
              choose(results[selected]);
            }
          }}
        />
        <ul id="jam-command-results" role="listbox">
          {results.length ? (
            results.map((command, index) => (
              <li
                key={command.id}
                id={`jam-command-${command.id}`}
                role="option"
                aria-selected={index === selected}
              >
                <button
                  type="button"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => choose(command)}
                >
                  {command.label}
                </button>
              </li>
            ))
          ) : (
            <li className="jam-command-empty">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
