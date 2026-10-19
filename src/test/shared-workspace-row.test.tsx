import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharedWorkspaceRow } from "@/features/collaboration/SharedWorkspaceRow";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("shared workspace management controls", () => {
  const item = {
    workspaceId: "workspace-1",
    documentId: "document-1",
    workspaceName: "Coastline",
    fileCount: 2,
    role: "owner",
  };

  it("lets an owner rename and delete after confirmation", async () => {
    const onManage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(
      <ul>
        <SharedWorkspaceRow item={item} onOpen={vi.fn()} onManage={onManage} />
      </ul>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename Coastline" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rename Coastline" }), {
      target: { value: "New coast" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onManage).toHaveBeenCalledWith("rename-workspace", "New coast"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete Coastline" }));
    await waitFor(() => expect(onManage).toHaveBeenCalledWith("delete-workspace", undefined));
  });

  it("lets a member leave but does not offer owner actions", async () => {
    const onManage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(
      <ul>
        <SharedWorkspaceRow
          item={{ ...item, role: "viewer" }}
          onOpen={vi.fn()}
          onManage={onManage}
        />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: "Rename Coastline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Coastline" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave Coastline" }));
    await waitFor(() => expect(onManage).toHaveBeenCalledWith("leave-workspace", undefined));
  });
});
