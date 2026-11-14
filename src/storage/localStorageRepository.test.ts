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

describe("moving items", () => {
  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    const c = await repo.createItem(p.id, { title: "C" });
    return { p, a, b, c };
  }

  it("moves between columns, renumbers both, and logs the change", async () => {
    const { p, a, b, c } = await setup();
    await repo.moveItem(a.id, "done", 0);

    const items = await repo.listItems(p.id);
    const byId = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byId.A).toMatchObject({ status: "done", order: 0 });
    expect(byId.A.completedAt).toBeDefined();
    expect([byId.B.order, byId.C.order]).toEqual([0, 1]);
    expect(b.id).toBe(byId.B.id);
    expect(c.id).toBe(byId.C.id);

    const history = await repo.listStatusChanges(a.id);
    expect(history.at(-1)).toMatchObject({ from: "todo", to: "done" });
  });

  it("reorders within a column without logging a status change", async () => {
    const { p, a, c } = await setup();
    await repo.moveItem(c.id, "todo", 0);
    const items = (await repo.listItems(p.id)).sort((x, y) => x.order - y.order);
    expect(items.map((i) => i.title)).toEqual(["C", "A", "B"]);
    expect(await repo.listStatusChanges(c.id)).toHaveLength(1);
    expect(a.id).toBeDefined();
  });

  it("clears completedAt when moved out of done", async () => {
    const { a } = await setup();
    await repo.moveItem(a.id, "done", 0);
    await repo.moveItem(a.id, "in_review", 0);
    const [item] = (await repo.exportData()).items.filter((i) => i.id === a.id);
    expect(item.completedAt).toBeUndefined();
  });

  it("is a no-op when dropped in place, and rejects bad input", async () => {
    const { a } = await setup();
    expect(await repo.moveItem(a.id, "todo", 0)).toEqual([]);
    await expect(repo.moveItem("missing", "todo", 0)).rejects.toThrow(RepositoryError);
    await expect(repo.moveItem(a.id, "bogus" as never, 0)).rejects.toThrow(RepositoryError);
  });

  it("puts an item changed via updateItem at the bottom of the new column", async () => {
    const { p, a, b } = await setup();
    await repo.updateItem(a.id, { status: "in_progress" });
    const moved = await repo.updateItem(b.id, { status: "in_progress" });
    expect(moved.order).toBe(1);
    expect((await repo.listItems(p.id)).find((i) => i.id === a.id)?.order).toBe(0);
  });
});

describe("notes", () => {
  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    return { p, a, b };
  }

  it("adds notes (trimmed) and lists them oldest first", async () => {
    const { a } = await setup();
    const first = await repo.addNote(a.id, "  first  ");
    await new Promise((r) => setTimeout(r, 5));
    await repo.addNote(a.id, "second");
    expect(first.body).toBe("first");
    expect((await repo.listNotes(a.id)).map((n) => n.body)).toEqual(["first", "second"]);
  });

  it("keeps notes separate per item", async () => {
    const { a, b } = await setup();
    await repo.addNote(a.id, "for a");
    expect(await repo.listNotes(b.id)).toEqual([]);
  });

  it("rejects empty, overlong and orphaned notes", async () => {
    const { a } = await setup();
    await expect(repo.addNote(a.id, "   ")).rejects.toThrow(RepositoryError);
    await expect(repo.addNote(a.id, "x".repeat(10_001))).rejects.toThrow(/at most/);
    await expect(repo.addNote("missing", "hi")).rejects.toThrow(RepositoryError);
  });

  it("edits a note and updates its timestamp", async () => {
    const { a } = await setup();
    const note = await repo.addNote(a.id, "old");
    await new Promise((r) => setTimeout(r, 5));
    const edited = await repo.updateNote(note.id, "new");
    expect(edited.body).toBe("new");
    expect(edited.updatedAt > note.updatedAt).toBe(true);
    expect(edited.createdAt).toBe(note.createdAt);
    await expect(repo.updateNote(note.id, " ")).rejects.toThrow(RepositoryError);
    await expect(repo.updateNote("missing", "x")).rejects.toThrow(RepositoryError);
  });

  it("deletes a note", async () => {
    const { a } = await setup();
    const note = await repo.addNote(a.id, "bye");
    await repo.deleteNote(note.id);
    expect(await repo.listNotes(a.id)).toEqual([]);
  });

  it("removes an item's notes when the item is deleted", async () => {
    const { a } = await setup();
    await repo.addNote(a.id, "gone soon");
    await repo.deleteItem(a.id);
    expect((await repo.exportData()).notes).toEqual([]);
  });

  it("lists every note in a project, and only that project's", async () => {
    const { p, a, b } = await setup();
    await repo.addNote(a.id, "1");
    await repo.addNote(b.id, "2");
    const other = await repo.createProject({ key: "OT", name: "Other" });
    const x = await repo.createItem(other.id, { title: "X" });
    await repo.addNote(x.id, "elsewhere");
    expect((await repo.listProjectNotes(p.id)).map((n) => n.body).sort()).toEqual(["1", "2"]);
    expect((await repo.listProjectNotes(other.id)).map((n) => n.body)).toEqual(["elsewhere"]);
  });

  it("keeps notes through export and import", async () => {
    const { a } = await setup();
    await repo.addNote(a.id, "kept");
    const exported = await repo.exportData();
    const other = new LocalStorageRepository(new MemoryStorage());
    await other.importData(JSON.parse(JSON.stringify(exported)));
    expect((await other.listNotes(a.id)).map((n) => n.body)).toEqual(["kept"]);
  });
});

describe("stories and tasks", () => {
  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const story = await repo.createItem(p.id, { title: "Story", type: "story" });
    const task = await repo.createItem(p.id, { title: "Task", parentId: story.id });
    return { p, story, task };
  }

  it("creates a task under a story, and a bug too", async () => {
    const { p, story, task } = await setup();
    const bug = await repo.createItem(p.id, { title: "Bug", type: "bug", parentId: story.id });
    expect(task.parentId).toBe(story.id);
    expect(bug.parentId).toBe(story.id);
  });

  it("rejects invalid parents on create", async () => {
    const { p, task } = await setup();
    await expect(repo.createItem(p.id, { title: "x", parentId: task.id })).rejects.toThrow(/Only stories/);
    await expect(repo.createItem(p.id, { title: "x", parentId: "ghost" })).rejects.toThrow(/no longer exists/);
    await expect(repo.createItem(p.id, { title: "x", type: "story", parentId: task.id })).rejects.toThrow(
      /story can't belong/,
    );
    const other = await repo.createProject({ key: "OT", name: "Other" });
    const story = (await repo.listItems(p.id)).find((i) => i.type === "story")!;
    await expect(repo.createItem(other.id, { title: "x", parentId: story.id })).rejects.toThrow(/different project/);
  });

  it("moves a task to another story, and clears the link", async () => {
    const { p, task } = await setup();
    const second = await repo.createItem(p.id, { title: "Second", type: "story" });
    expect((await repo.updateItem(task.id, { parentId: second.id })).parentId).toBe(second.id);
    expect((await repo.updateItem(task.id, { parentId: undefined })).parentId).toBeUndefined();
  });

  it("leaves the link alone when other fields are updated", async () => {
    const { story, task } = await setup();
    expect((await repo.updateItem(task.id, { title: "Renamed", status: "done" })).parentId).toBe(story.id);
  });

  it("will not turn a story with tasks into a task", async () => {
    const { story } = await setup();
    await expect(repo.updateItem(story.id, { type: "task" })).rejects.toThrow(/still has 1 task/);
  });

  it("will not make a task with a parent into a story until it is unlinked", async () => {
    const { task } = await setup();
    await expect(repo.updateItem(task.id, { type: "story" })).rejects.toThrow(/story can't belong/);
    const unlinked = await repo.updateItem(task.id, { type: "story", parentId: undefined });
    expect(unlinked.type).toBe("story");
  });

  it("allows turning an empty story into a task", async () => {
    const p = await repo.createProject({ key: "AB", name: "AB" });
    const story = await repo.createItem(p.id, { title: "Empty", type: "story" });
    expect((await repo.updateItem(story.id, { type: "task" })).type).toBe("task");
  });

  it("keeps the tasks, unlinked, when their story is deleted", async () => {
    const { p, story, task } = await setup();
    await repo.deleteItem(story.id);
    const remaining = await repo.listItems(p.id);
    expect(remaining.map((i) => i.id)).toEqual([task.id]);
    expect(remaining[0].parentId).toBeUndefined();
  });

  it("round-trips parent links through export and import", async () => {
    const { p, story, task } = await setup();
    const exported = await repo.exportData();
    const other = new LocalStorageRepository(new MemoryStorage());
    await other.importData(JSON.parse(JSON.stringify(exported)));
    expect((await other.listItems(p.id)).find((i) => i.id === task.id)?.parentId).toBe(story.id);
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

  it("loads data saved by the previous version (no notes) and upgrades it on save", async () => {
    storage.setItem(
      "work-manager:data",
      JSON.stringify({
        version: 1,
        projects: [{ id: "p1", key: "WM", name: "Old", nextNumber: 2, createdAt: "t", updatedAt: "t" }],
        items: [],
        statusChanges: [],
      }),
    );
    expect((await repo.listProjects()).map((p) => p.name)).toEqual(["Old"]);
    await repo.createProject({ key: "NW", name: "New" });
    const saved = await repo.exportData();
    expect(saved.version).toBe(3);
    expect(saved.notes).toEqual([]);
  });

  it("reports corrupted stored data", async () => {
    storage.setItem("work-manager:data", "{not json");
    await expect(repo.listProjects()).rejects.toThrow(RepositoryError);
  });
});
