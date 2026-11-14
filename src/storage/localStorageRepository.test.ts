import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageRepository } from "./localStorageRepository";
import { RepositoryError } from "./repository";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

let storage: MemoryStorage;
let repo: LocalStorageRepository;

beforeEach(() => {
  storage = new MemoryStorage();
  repo = new LocalStorageRepository(storage);
});

describe("projects", () => {
  it("creates a project with a normalized key", async () => {
    const p = await repo.createProject({ key: " wm ", name: " Work Manager " });
    expect(p.key).toBe("WM");
    expect(p.name).toBe("Work Manager");
    expect(p.nextNumber).toBe(1);
  });

  it("rejects invalid or duplicate keys", async () => {
    await repo.createProject({ key: "WM", name: "One" });
    await expect(repo.createProject({ key: "WM", name: "Two" })).rejects.toThrow(RepositoryError);
    await expect(repo.createProject({ key: "1", name: "Bad" })).rejects.toThrow(RepositoryError);
    await expect(repo.createProject({ key: "OK", name: " " })).rejects.toThrow(RepositoryError);
  });
});

describe("items", () => {
  it("assigns sequential numbers and never reuses them after delete", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    expect([a.number, b.number]).toEqual([1, 2]);

    await repo.deleteItem(b.id);
    const c = await repo.createItem(p.id, { title: "C" });
    expect(c.number).toBe(3);
    expect((await repo.getProject(p.id))?.nextNumber).toBe(4);
  });

  it("keeps numbering independent per project", async () => {
    const p1 = await repo.createProject({ key: "AA", name: "One" });
    const p2 = await repo.createProject({ key: "BB", name: "Two" });
    await repo.createItem(p1.id, { title: "x" });
    const item = await repo.createItem(p2.id, { title: "y" });
    expect(item.number).toBe(1);
  });

  it("applies defaults and validates the title", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "  Do it  " });
    expect(item).toMatchObject({
      title: "Do it",
      status: "todo",
      priority: "medium",
      type: "task",
      labels: [],
    });
    await expect(repo.createItem(p.id, { title: "  " })).rejects.toThrow(RepositoryError);
    await expect(repo.createItem("missing", { title: "x" })).rejects.toThrow(RepositoryError);
  });

  it("orders new items at the end of their column", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    const c = await repo.createItem(p.id, { title: "C", status: "done" });
    expect([a.order, b.order, c.order]).toEqual([0, 1, 0]);
  });

  it("tracks status history and completedAt", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "A" });

    const done = await repo.updateItem(item.id, { status: "done" });
    expect(done.completedAt).toBeDefined();

    const reopened = await repo.updateItem(item.id, { status: "in_progress" });
    expect(reopened.completedAt).toBeUndefined();

    const history = await repo.listStatusChanges(item.id);
    expect(history.map((h) => [h.from, h.to])).toEqual([
      [null, "todo"],
      ["todo", "done"],
      ["done", "in_progress"],
    ]);
  });

  it("does not log a status change when status is unchanged", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "A" });
    await repo.updateItem(item.id, { title: "A2", status: "todo" });
    expect(await repo.listStatusChanges(item.id)).toHaveLength(1);
  });

  it("rejects invalid updates", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "A" });
    await expect(repo.updateItem(item.id, { title: " " })).rejects.toThrow(RepositoryError);
    await expect(repo.updateItem("missing", { title: "x" })).rejects.toThrow(RepositoryError);
    await expect(
      repo.updateItem(item.id, { status: "bogus" as never }),
    ).rejects.toThrow(RepositoryError);
  });
});

describe("export / import", () => {
  it("round-trips data", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    await repo.createItem(p.id, { title: "A" });
    const exported = await repo.exportData();

    const other = new LocalStorageRepository(new MemoryStorage());
    await other.importData(JSON.parse(JSON.stringify(exported)));
    expect(await other.exportData()).toEqual(exported);
  });

  it("rejects malformed or future-version data", async () => {
    await expect(repo.importData(null)).rejects.toThrow(RepositoryError);
    await expect(repo.importData({ version: 99, projects: [], items: [], statusChanges: [] })).rejects.toThrow(
      RepositoryError,
    );
    await expect(repo.importData({ version: 1, projects: [] })).rejects.toThrow(RepositoryError);
  });

  it("reports corrupted stored data", async () => {
    storage.setItem("work-manager:data", "{not json");
    await expect(repo.listProjects()).rejects.toThrow(RepositoryError);
  });
});
