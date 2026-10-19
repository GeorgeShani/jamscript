import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SharedWorkspaceHeading({
  loading,
  refresh,
}: {
  loading: boolean;
  refresh: () => void;
}) {
  return (
    <div className="jam-shared-heading">
      <h2 id="shared-heading">Shared with you</h2>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="jam-shared-refresh"
        aria-label="Refresh shared workspaces"
        title="Refresh shared workspaces"
        disabled={loading}
        onClick={refresh}
      >
        <RefreshCw size={14} />
      </Button>
    </div>
  );
}
