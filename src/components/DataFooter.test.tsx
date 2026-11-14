import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataFooter } from "./DataFooter";

vi.mock("../lib/download", () => ({ downloadJson: vi.fn() }));
import { downloadJson } from "../lib/download";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const backup = {
  version: 1,
  projects: [{ id: "p1", key: "WM", name: "WM", nextNumber: 2, createdAt: "t", updatedAt: "t" }],
  items: [
    {
      id: "i1", projectId: "p1", number: 1, title: "A", description: "", type: "task",
      status: "todo", priority: "medium", labels: [], order: 0, createdAt: "t", updatedAt: "t",
    },
  ],
  statusChanges: [],
};

function file(content: string) {
  return new File([content], "backup.json", { type: "application/json" });
}

describe("DataFooter", () => {
  it("downloads a backup", async () => {
    const user = userEvent.setup();
    const data = { ...backup };
    render(<DataFooter onExport={vi.fn().mockResolvedValue(data)} onImport={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Export backup" }));
    expect(downloadJson).toHaveBeenCalledWith(expect.stringMatching(/^work-manager-backup-\d{4}-\d{2}-\d{2}\.json$/), data);
    expect(await screen.findByText("Backup downloaded.")).toBeInTheDocument();
  });

  it("asks for confirmation, shows counts, then imports", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<DataFooter onExport={vi.fn()} onImport={onImport} />);
    await user.upload(screen.getByLabelText("Choose backup file"), file(JSON.stringify(backup)));

    const dialog = await screen.findByRole("dialog", { name: "Replace all data?" });
    expect(dialog).toHaveTextContent("1 project and 1 item");
    expect(onImport).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Replace data" }));
    expect(onImport).toHaveBeenCalledWith(backup);
    expect(await screen.findByText("Backup restored.")).toBeInTheDocument();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<DataFooter onExport={vi.fn()} onImport={onImport} />);
    await user.upload(screen.getByLabelText("Choose backup file"), file(JSON.stringify(backup)));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects files that are not JSON", async () => {
    const user = userEvent.setup();
    render(<DataFooter onExport={vi.fn()} onImport={vi.fn()} />);
    await user.upload(screen.getByLabelText("Choose backup file"), file("{nope"));
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
  });

  it("rejects JSON that is not a valid backup, with a reason", async () => {
    const user = userEvent.setup();
    render(<DataFooter onExport={vi.fn()} onImport={vi.fn()} />);
    await user.upload(screen.getByLabelText("Choose backup file"), file(JSON.stringify({ version: 1, projects: [] })));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not a valid backup.*items/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
