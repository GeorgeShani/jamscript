import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";

export const Route = createFileRoute("/app/workspaces/$workspaceId")({
  validateSearch: (search: Record<string, unknown>) => ({
    document: typeof search["document"] === "string" ? search["document"] : undefined,
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const { workspaceId } = Route.useParams();
  const { document: initialDocumentId } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <SessionWorkbench
      key={workspaceId}
      collaboration
      workspaceId={workspaceId}
      initialDocumentId={initialDocumentId}
      onAppRoute={(to) => void navigate({ to })}
      onDocumentRoute={(id) =>
        void navigate({
          to: "/app/workspaces/$workspaceId",
          params: { workspaceId },
          search: { document: id ?? undefined },
          replace: true,
        })
      }
      onWorkspaceRoute={(id) => {
        if (id)
          void navigate({
            to: "/app/workspaces/$workspaceId",
            params: { workspaceId: id },
            search: { document: undefined },
          });
        else void navigate({ to: "/app" });
      }}
    />
  );
}
