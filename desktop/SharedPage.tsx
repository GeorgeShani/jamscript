import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { sharedDocumentStorage } from "@/features/collaboration/shared-storage";
import type { CollaborationRole } from "@/features/collaboration/shared-document";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import type { DocumentRecord, WorkspaceRecord } from "@/workspaces/storage";
import { collaborationApi } from "./collaboration-api";

type Opened = {
  workspaceId: string;
  workspaceName: string;
  name: string;
  source: string;
  role: CollaborationRole;
  documents: { id: string; name: string; source: string }[];
};

export function SharedPage({ documentId, close }: { documentId: string; close: () => void }) {
  const [opened, setOpened] = useState<{
    workspace: WorkspaceRecord;
    documents: DocumentRecord[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setOpened(null);
    setError(null);
    void collaborationApi<Opened>(
      `/api/shared-projects?documentId=${encodeURIComponent(documentId)}`,
    )
      .then((body) => {
        if (!live) return;
        const now = Date.now();
        const workspace = {
          id: body.workspaceId,
          name: body.workspaceName,
          createdAt: now,
          updatedAt: now,
        };
        const files = body.documents?.length
          ? body.documents
          : [{ id: documentId, name: body.name, source: body.source }];
        setOpened({
          workspace,
          documents: files.map((file) => ({
            id: file.id,
            workspaceId: workspace.id,
            name: file.name,
            source: file.source,
            beatsPerCycle: 4,
            shared: { workspaceId: workspace.id, documentId: file.id, role: body.role },
            createdAt: now,
            updatedAt: now,
          })),
        });
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      live = false;
    };
  }, [documentId]);
  const storage = useMemo(() => {
    if (!opened) return null;
    const storage = sharedDocumentStorage(opened);
    storage.renameDocument = async (document, name) => {
      if (document.shared?.role === "viewer") throw new Error("Viewer access is read only");
      const result = await collaborationApi<{ name: string }>("/api/shared-projects", {
        method: "POST",
        body: { action: "rename-document", documentId: document.id, name },
      });
      return storage.saveDocument({ ...document, name: result.name });
    };
    return storage;
  }, [opened]);
  if (error)
    return (
      <main className="jam-chooser">
        <div className="jam-chooser-body">
          <p role="alert" className="jam-error">
            {error}
          </p>
          <Button onClick={close}>Back to workspaces</Button>
        </div>
      </main>
    );
  if (!opened || !storage)
    return (
      <div className="jam-loading" role="status">
        Opening shared project…
      </div>
    );
  return (
    <SessionWorkbench
      collaboration
      sharedOnly
      storage={storage}
      workspaceId={opened.workspace.id}
      initialDocumentId={documentId}
      onWorkspaceRoute={close}
    />
  );
}
