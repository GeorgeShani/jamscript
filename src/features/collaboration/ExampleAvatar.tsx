import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Synthetic presence example; no people-management action or connection state. */
export function ExampleAvatar({ initials, ring }: { initials: "NK" | "GS"; ring: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`Example collaborator ${initials}`}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-badge font-medium ring-2",
            ring,
          )}
        >
          {initials}
        </span>
      </TooltipTrigger>
      <TooltipContent>Example collaborator {initials}</TooltipContent>
    </Tooltip>
  );
}
