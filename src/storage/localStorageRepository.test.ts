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

describe("saved filters", () => {
  const bugs = { query: "  crash ", status: "all", priority: "high", type: "bug", label: "all", parent: "all", archived: "hide" } as const;

  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    return { p };
  }

  it("saves filters (normalised) and lists them by name", async () => {
    const { p } = await setup();
    await repo.saveFilter(p.id, "Zebra", bugs);
    const saved = await repo.saveFilter(p.id, "  apple ", bugs);
    expect(saved.name).toBe("apple");
    expect(saved.filters.query).toBe("crash");
    expect((await repo.listSavedFilters(p.id)).map((f) => f.name)).toEqual(["apple", "Zebra"]);
  });

  it("replaces a filter with the same name, ignoring case", async () => {
    const { p } = await setup();
    const first = await repo.saveFilter(p.id, "My bugs", bugs);
    const second = await repo.saveFilter(p.id, "my BUGS", { ...bugs, priority: "low" });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("my BUGS");
    expect(second.filters.priority).toBe("low");
    expect(await repo.listSavedFilters(p.id)).toHaveLength(1);
  });

  it("keeps filters separate per project, and allows the same name in two projects", async () => {
    const { p } = await setup();
    const other = await repo.createProject({ key: "OT", name: "Other" });
    await repo.saveFilter(p.id, "Same", bugs);
    await repo.saveFilter(other.id, "Same", bugs);
    expect(await repo.listSavedFilters(p.id)).toHaveLength(1);
    expect(await repo.listSavedFilters(other.id)).toHaveLength(1);
  });

  it("rejects bad names, unknown projects and too many filters", async () => {
    const { p } = await setup();
    await expect(repo.saveFilter(p.id, "  ", bugs)).rejects.toThrow(RepositoryError);
    await expect(repo.saveFilter(p.id, "x".repeat(61), bugs)).rejects.toThrow(/at most 60/);
    await expect(repo.saveFilter("missing", "A", bugs)).rejects.toThrow(/Project not found/);
    for (let i = 0; i < 30; i++) await repo.saveFilter(p.id, `Filter ${i}`, bugs);
    await expect(repo.saveFilter(p.id, "One too many", bugs)).rejects.toThrow(/at most 30/);
    // Replacing an existing one is still fine at the limit.
    await expect(repo.saveFilter(p.id, "filter 3", bugs)).resolves.toBeDefined();
  });

  it("deletes a saved filter", async () => {
    const { p } = await setup();
    const saved = await repo.saveFilter(p.id, "Temp", bugs);
    await repo.deleteSavedFilter(saved.id);
    expect(await repo.listSavedFilters(p.id)).toEqual([]);
  });

  it("keeps saved filters through export and import", async () => {
    const { p } = await setup();
    await repo.saveFilter(p.id, "Keep me", bugs);
    const other = new LocalStorageRepository(new MemoryStorage());
    await other.importData(JSON.parse(JSON.stringify(await repo.exportData())));
    expect((await other.listSavedFilters(p.id)).map((f) => f.name)).toEqual(["Keep me"]);
  });
});

describe("bulk updates", () => {
  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    const c = await repo.createItem(p.id, { title: "C" });
    const story = await repo.createItem(p.id, { title: "Story", type: "story" });
    return { p, a, b, c, story };
  }

  it("changes status for several items, with history, completion and column order", async () => {
    const { p, a, b, c } = await setup();
    const changed = await repo.updateItems([a.id, b.id], { status: "done" });
    expect(changed.map((i) => i.status)).toEqual(["done", "done"]);
    const items = await repo.listItems(p.id);
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byTitle.A.completedAt).toBeDefined();
    expect(byTitle.B.completedAt).toBeDefined();
    expect(byTitle.C.status).toBe("todo");
    // Both land in the Done column with distinct, increasing positions.
    expect(byTitle.B.order).toBe(byTitle.A.order + 1);
    expect((await repo.listStatusChanges(a.id)).at(-1)).toMatchObject({ from: "todo", to: "done" });
    expect((await repo.listStatusChanges(b.id)).at(-1)).toMatchObject({ from: "todo", to: "done" });
    expect(c.id).toBeDefined();
  });

  it("changes priority, and moves several items into a story", async () => {
    const { p, a, b, story } = await setup();
    await repo.updateItems([a.id, b.id], { priority: "critical" });
    await repo.updateItems([a.id, b.id], { parentId: story.id });
    const items = await repo.listItems(p.id);
    expect(items.filter((i) => i.parentId === story.id).map((i) => i.title)).toEqual(["A", "B"]);
    expect(items.filter((i) => i.priority === "critical")).toHaveLength(2);
    await repo.updateItems([a.id], { parentId: undefined });
    expect((await repo.listItems(p.id)).find((i) => i.id === a.id)?.parentId).toBeUndefined();
  });

  it("is all-or-nothing: one invalid item leaves every item unchanged", async () => {
    const { p, a, b, story } = await setup();
    // A story cannot be moved into a story, so including it must reject the whole batch.
    await expect(repo.updateItems([a.id, b.id, story.id], { parentId: story.id })).rejects.toThrow(/story can't belong/);
    const items = await repo.listItems(p.id);
    expect(items.every((i) => !i.parentId)).toBe(true);
    expect(items.every((i) => i.status === "todo")).toBe(true);
  });

  it("rejects missing items and invalid values without changing anything", async () => {
    const { a } = await setup();
    await expect(repo.updateItems([a.id, "missing"], { status: "done" })).rejects.toThrow(/no longer exists/);
    expect((await repo.listItems((await repo.listProjects())[0].id)).find((i) => i.id === a.id)?.status).toBe("todo");
    await expect(repo.updateItems([a.id], { status: "bogus" as never })).rejects.toThrow(/Invalid status/);
    await expect(repo.updateItems([a.id], { priority: "bogus" as never })).rejects.toThrow(/Invalid priority/);
    await expect(repo.updateItems([a.id], { parentId: "ghost" })).rejects.toThrow(/no longer exists/);
  });
});

describe("bulk delete", () => {
  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const story = await repo.createItem(p.id, { title: "Story", type: "story" });
    const task = await repo.createItem(p.id, { title: "Task", parentId: story.id });
    const other = await repo.createItem(p.id, { title: "Other" });
    return { p, story, task, other };
  }

  it("deletes several items together with their notes and history", async () => {
    const { p, task, other } = await setup();
    await repo.addNote(task.id, "note");
    await repo.deleteItems([task.id, other.id]);
    expect((await repo.listItems(p.id)).map((i) => i.title)).toEqual(["Story"]);
    const data = await repo.exportData();
    expect(data.notes).toEqual([]);
    expect(data.statusChanges.every((c) => c.itemId === (data.items[0].id))).toBe(true);
  });

  it("unlinks tasks of a deleted story, unless the tasks are deleted too", async () => {
    const { p, story, task } = await setup();
    await repo.deleteItems([story.id]);
    expect((await repo.listItems(p.id)).find((i) => i.id === task.id)?.parentId).toBeUndefined();
  });

  it("deleting a story together with its tasks removes them all cleanly", async () => {
    const { p, story, task } = await setup();
    await repo.deleteItems([story.id, task.id]);
    expect((await repo.listItems(p.id)).map((i) => i.title)).toEqual(["Other"]);
  });

  it("ignores ids that no longer exist", async () => {
    const { p } = await setup();
    await expect(repo.deleteItems(["missing"])).resolves.toBeUndefined();
    expect(await repo.listItems(p.id)).toHaveLength(3);
  });
});

describe("archiving", () => {
  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    const c = await repo.createItem(p.id, { title: "C" });
    return { p, a, b, c };
  }

  it("archives items without changing their status, and only reports real changes", async () => {
    const { a, b } = await setup();
    const first = await repo.setArchived([a.id, b.id], true);
    expect(first.map((i) => i.title)).toEqual(["A", "B"]);
    expect(first.every((i) => i.archivedAt && i.status === "todo")).toBe(true);
    // Archiving again changes nothing.
    expect(await repo.setArchived([a.id], true)).toEqual([]);
  });

  it("unarchives to the bottom of the column among visible items", async () => {
    const { p, a, b, c } = await setup();
    await repo.setArchived([a.id], true);
    await repo.setArchived([a.id], false);
    const items = (await repo.listItems(p.id)).sort((x, y) => x.order - y.order);
    expect(items.map((i) => i.title)).toEqual(["B", "C", "A"]);
    expect(items.every((i) => !i.archivedAt)).toBe(true);
    expect(await repo.setArchived([b.id, c.id], false)).toEqual([]); // not archived: nothing to do
  });

  it("keeps archived items out of board positioning when others move", async () => {
    const { p, a, b, c } = await setup();
    await repo.setArchived([b.id], true);
    // Visible todo is A, C. Move C to the top.
    await repo.moveItem(c.id, "todo", 0);
    const visible = (await repo.listItems(p.id)).filter((i) => !i.archivedAt).sort((x, y) => x.order - y.order);
    expect(visible.map((i) => i.title)).toEqual(["C", "A"]);
    expect((await repo.listItems(p.id)).find((i) => i.id === b.id)?.archivedAt).toBeDefined();
    expect(a.id).toBeDefined();
  });

  it("places an item changed through updateItem below visible items only", async () => {
    const { p, a, b } = await setup();
    await repo.updateItem(a.id, { status: "done" });
    await repo.setArchived([a.id], true);
    const moved = await repo.updateItem(b.id, { status: "done" });
    expect(moved.order).toBe(0); // the archived item in Done does not count
    expect((await repo.listItems(p.id)).find((i) => i.id === a.id)?.archivedAt).toBeDefined();
  });

  it("rejects unknown items", async () => {
    await setup();
    await expect(repo.setArchived(["missing"], true)).rejects.toThrow(/no longer exists/);
  });

  it("keeps archived state through export and import", async () => {
    const { p, a } = await setup();
    await repo.setArchived([a.id], true);
    const other = new LocalStorageRepository(new MemoryStorage());
    await other.importData(JSON.parse(JSON.stringify(await repo.exportData())));
    expect((await other.listItems(p.id)).find((i) => i.id === a.id)?.archivedAt).toBeDefined();
  });

  it("round-trips the archive mode of a saved filter", async () => {
    const { p } = await setup();
    await repo.saveFilter(p.id, "Archive", { query: "", status: "all", priority: "all", type: "all", label: "all", parent: "all", archived: "only" });
    expect((await repo.listSavedFilters(p.id))[0].filters.archived).toBe("only");
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
    expect(saved.version).toBe(5);
    expect(saved.savedFilters).toEqual([]);
    expect(saved.notes).toEqual([]);
  });

  it("reports corrupted stored data", async () => {
    storage.setItem("work-manager:data", "{not json");
    await expect(repo.listProjects()).rejects.toThrow(RepositoryError);
  });
});
