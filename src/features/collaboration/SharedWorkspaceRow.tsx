import { useState } from "react";

import { Button } from "@/components/ui/button";

export type SharedWorkspaceSummary = {
  workspaceId: string;
  documentId: string;
  workspaceName: string;
  role: string;
  fileCount: number;
};

export function SharedWorkspaceRow({
  item,
  onOpen,
  onManage,
}: {
  item: SharedWorkspaceSummary;
  onOpen: () => void;
  onManage: (
    action: "rename-workspace" | "delete-workspace" | "leave-workspace",
    name?: string,
  ) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.workspaceName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = item.role === "owner";

  const act = async (action: "rename-workspace" | "delete-workspace" | "leave-workspace") => {
    if (action === "rename-workspace" && !name.trim()) {
      setError("Workspace name is required");
      return;
    }
    if (
      action === "delete-workspace" &&
      !window.confirm(
        `Delete ${item.workspaceName} for everyone? Shared files and invitations will be removed.`,
      )
    )
      return;
    if (
      action === "leave-workspace" &&
      !window.confirm(`Leave ${item.workspaceName}? You will lose access to its shared files.`)
    )
      return;
    setPending(true);
    setError(null);
    try {
      await onManage(action, action === "rename-workspace" ? name.trim() : undefined);
      setRenaming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update workspace");
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="jam-shared-row">
      {renaming ? (
        <form
          className="jam-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void act("rename-workspace");
          }}
        >
          <input
            aria-label={`Rename ${item.workspaceName}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            autoFocus
          />
          <div className="jam-inline-form-actions">
            <Button size="sm" type="submit" disabled={pending}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={pending}
              onClick={() => setRenaming(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <button type="button" className="jam-shared-open" onClick={onOpen}>
            <span className="jam-shared-open-name">{item.workspaceName}</span>
            <small>
              {item.fileCount} {item.fileCount === 1 ? "file" : "files"} · {item.role}
            </small>
          </button>
          <div className="jam-shared-row-actions">
            {owner && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Rename ${item.workspaceName}`}
                disabled={pending}
                onClick={() => {
                  setName(item.workspaceName);
                  setRenaming(true);
                }}
              >
                Rename
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${owner ? "Delete" : "Leave"} ${item.workspaceName}`}
              disabled={pending}
              onClick={() => void act(owner ? "delete-workspace" : "leave-workspace")}
            >
              {owner ? "Delete" : "Leave"}
            </Button>
          </div>
        </>
      )}
      {error && (
        <p className="jam-shared-row-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
