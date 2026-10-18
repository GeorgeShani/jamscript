import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { presenceInitials, type SharedPresence } from "./presence";

export function PresenceAvatars({
  people,
  className,
}: {
  people: Array<SharedPresence & { documentName?: string }>;
  className?: string;
}) {
  if (!people.length) return null;
  return (
    <ul className={cn("jam-workbench-presence", className)} aria-label="Collaborators here">
      {people.map((person) => {
        const detail = person.documentName
          ? `${person.name} · ${person.documentName}`
          : person.name;
        return (
          <li key={person.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={detail}
                  className={cn("jam-presence-avatar", `jam-presence-track-${person.track}`)}
                  style={{ ["--jam-presence-color" as string]: person.color }}
                >
                  {presenceInitials(person.name)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{detail}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact dots on a document tab for peers in that file's room. */
export function PresenceTabDots({ people }: { people: SharedPresence[] }) {
  if (!people.length) return null;
  const unique = [...new Map(people.map((person) => [person.id, person])).values()];
  return (
    <span className="jam-tab-presence" aria-hidden>
      {unique.slice(0, 3).map((person) => (
        <span
          key={person.id}
          className="jam-tab-presence-dot"
          style={{ backgroundColor: person.color }}
          title={person.name}
        />
      ))}
      {unique.length > 3 ? (
        <span className="jam-tab-presence-more">+{unique.length - 3}</span>
      ) : null}
    </span>
  );
}
