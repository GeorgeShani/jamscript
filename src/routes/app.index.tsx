import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";

export const Route = createFileRoute("/app/")({
  component: WorkspaceIndex,
});

function WorkspaceIndex() {
  const navigate = useNavigate();
  return (
    <SessionWorkbench
      collaboration
      onAppRoute={(to) => void navigate({ to })}
      onWorkspaceRoute={(id) => {
        if (id)
          void navigate({
            to: "/app/workspaces/$workspaceId",
            params: { workspaceId: id },
            search: { document: undefined },
          });
      }}
    />
  );
}
