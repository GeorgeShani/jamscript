import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SessionLoader } from "@/components/SessionLoader";

import { sharedDocumentStorage } from "@/features/collaboration/shared-storage";
import type { CollaborationRole } from "@/features/collaboration/shared-document";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import type { DocumentRecord, WorkspaceRecord } from "@/workspaces/storage";

export const Route = createFileRoute("/app/shared/$documentId")({
  component: SharedDocumentPage,
});

function SharedDocumentPage() {
  const { documentId } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<{
    workspace: WorkspaceRecord;
    documents: DocumentRecord[];
  } | null>(null);

  useEffect(() => {
    let current = true;
    void fetch(`/api/shared-projects?documentId=${encodeURIComponent(documentId)}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          workspaceId?: string;
          workspaceName?: string;
          name?: string;
          source?: string;
          role?: CollaborationRole;
          documents?: { id: string; name: string; source: string }[];
        };
        if (!response.ok || !body.workspaceId || !body.name || body.role === undefined)
          throw new Error(body.error ?? "This shared document is unavailable");
        if (!current) return;
        const now = Date.now();
        const workspace = {
          id: body.workspaceId,
          name: body.workspaceName ?? body.name,
          createdAt: now,
          updatedAt: now,
        };
        const files = body.documents?.length
          ? body.documents
          : [{ id: documentId, name: body.name, source: body.source ?? "" }];
        setOpened({
          workspace,
          documents: files.map((file) => ({
            id: file.id,
            workspaceId: workspace.id,
            name: file.name,
            source: file.source,
            beatsPerCycle: 4,
            shared: { workspaceId: workspace.id, documentId: file.id, role: body.role! },
            createdAt: now,
            updatedAt: now,
          })),
        });
      })
      .catch((cause: unknown) => {
        if (current)
          setError(cause instanceof Error ? cause.message : "This shared document is unavailable");
      });
    return () => {
      current = false;
    };
  }, [documentId]);

  if (error)
    return (
      <main className="jam-chooser">
        <p role="alert" className="jam-error">
          {error}
        </p>
      </main>
    );
  if (!opened) return <SessionLoader fullScreen label="Opening shared project" />;
  const storage = sharedDocumentStorage(opened);
  return (
    <SessionWorkbench
      collaboration
      sharedOnly
      storage={storage}
      workspaceId={opened.workspace.id}
      initialDocumentId={documentId}
      onWorkspaceRoute={() => void navigate({ to: "/app" })}
    />
  );
}
