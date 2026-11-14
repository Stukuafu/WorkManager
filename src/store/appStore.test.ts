import { beforeEach, describe, expect, it } from "vitest";
import { countNotes } from "../domain/notes";
import { LocalStorageRepository } from "../storage/localStorageRepository";
import { createAppStore } from "./appStore";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

let repo: LocalStorageRepository;

beforeEach(() => {
  repo = new LocalStorageRepository(new MemoryStorage());
  window.localStorage.clear();
});

describe("app store projects", () => {
  it("starts empty after init", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    expect(store.getState()).toMatchObject({ loaded: true, projects: [], activeProjectId: null });
  });

  it("creates a project and makes it active", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    const project = await store.getState().createProject({ key: "wm", name: "Work Manager" });
    expect(project.key).toBe("WM");
    expect(store.getState().projects).toHaveLength(1);
    expect(store.getState().activeProjectId).toBe(project.id);
  });

  it("surfaces validation errors without changing state", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    await store.getState().createProject({ key: "WM", name: "One" });
    await expect(store.getState().createProject({ key: "WM", name: "Two" })).rejects.toThrow(
      /already in use/,
    );
    expect(store.getState().projects).toHaveLength(1);
  });

  it("switches projects and ignores unknown ids", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    const a = await store.getState().createProject({ key: "AA", name: "A" });
    const b = await store.getState().createProject({ key: "BB", name: "B" });
    expect(store.getState().activeProjectId).toBe(b.id);
    await store.getState().selectProject(a.id);
    expect(store.getState().activeProjectId).toBe(a.id);
    await store.getState().selectProject("missing");
    expect(store.getState().activeProjectId).toBe(a.id);
  });

  it("restores the last active project on init", async () => {
    const first = createAppStore(repo);
    await first.getState().init();
    const a = await first.getState().createProject({ key: "AA", name: "A" });
    await first.getState().createProject({ key: "BB", name: "B" });
    await first.getState().selectProject(a.id);

    const second = createAppStore(repo);
    await second.getState().init();
    expect(second.getState().activeProjectId).toBe(a.id);
  });
});

describe("app store items", () => {
  it("creates, updates and deletes items in the active project", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    await store.getState().createProject({ key: "WM", name: "Work Manager" });

    const a = await store.getState().createItem({ title: "A" });
    const b = await store.getState().createItem({ title: "B" });
    expect([a.number, b.number]).toEqual([1, 2]);
    expect(store.getState().projects[0].nextNumber).toBe(3);

    await store.getState().updateItem(a.id, { status: "done" });
    expect(store.getState().items.find((i) => i.id === a.id)?.status).toBe("done");

    await store.getState().deleteItem(b.id);
    expect(store.getState().items.map((i) => i.id)).toEqual([a.id]);
  });

  it("requires an active project", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    await expect(store.getState().createItem({ title: "A" })).rejects.toThrow(/No active project/);
  });

  it("loads the items of the selected project and keeps projects separate", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    const a = await store.getState().createProject({ key: "AA", name: "A" });
    await store.getState().createItem({ title: "in A" });
    await store.getState().createProject({ key: "BB", name: "B" });
    expect(store.getState().items).toEqual([]);

    await store.getState().selectProject(a.id);
    expect(store.getState().items.map((i) => i.title)).toEqual(["in A"]);
  });

  it("restores items for the active project on init", async () => {
    const first = createAppStore(repo);
    await first.getState().init();
    await first.getState().createProject({ key: "WM", name: "Work Manager" });
    await first.getState().createItem({ title: "kept" });

    const second = createAppStore(repo);
    await second.getState().init();
    expect(second.getState().items.map((i) => i.title)).toEqual(["kept"]);
  });
});

describe("app store moving items", () => {
  async function setup() {
    const store = createAppStore(repo);
    await store.getState().init();
    await store.getState().createProject({ key: "WM", name: "Work Manager" });
    const a = await store.getState().createItem({ title: "A" });
    const b = await store.getState().createItem({ title: "B" });
    return { store, a, b };
  }

  it("updates the UI immediately and persists", async () => {
    const { store, a } = await setup();
    const pending = store.getState().moveItem(a.id, "done", 0);
    // Optimistic state is visible before the promise settles.
    expect(store.getState().items.find((i) => i.id === a.id)?.status).toBe("done");
    await pending;
    expect(store.getState().items.find((i) => i.id === a.id)?.completedAt).toBeDefined();

    const reloaded = createAppStore(repo);
    await reloaded.getState().init();
    expect(reloaded.getState().items.find((i) => i.id === a.id)?.status).toBe("done");
  });

  it("rolls back when persisting fails", async () => {
    const { store, a } = await setup();
    const original = repo.moveItem.bind(repo);
    repo.moveItem = async () => {
      throw new Error("disk full");
    };
    await expect(store.getState().moveItem(a.id, "done", 0)).rejects.toThrow("disk full");
    expect(store.getState().items.find((i) => i.id === a.id)?.status).toBe("todo");
    repo.moveItem = original;
  });
});

describe("app store backup", () => {
  it("exports and imports into a fresh store", async () => {
    const source = createAppStore(repo);
    await source.getState().init();
    await source.getState().createProject({ key: "WM", name: "Work Manager" });
    await source.getState().createItem({ title: "kept" });
    const backup = JSON.parse(JSON.stringify(await source.getState().exportData()));

    const target = createAppStore(new LocalStorageRepository(new MemoryStorage()));
    await target.getState().init();
    await target.getState().importData(backup);
    expect(target.getState().projects.map((p) => p.key)).toEqual(["WM"]);
    expect(target.getState().items.map((i) => i.title)).toEqual(["kept"]);
    expect(target.getState().activeProjectId).toBe(target.getState().projects[0].id);
  });

  it("leaves existing data untouched when the import is invalid", async () => {
    const store = createAppStore(repo);
    await store.getState().init();
    await store.getState().createProject({ key: "WM", name: "Work Manager" });
    await expect(store.getState().importData({ version: 1, projects: "x" })).rejects.toThrow();
    expect(store.getState().projects).toHaveLength(1);
    expect((await repo.exportData()).projects).toHaveLength(1);
  });
});

describe("app store notes", () => {
  async function setup() {
    const store = createAppStore(repo);
    await store.getState().init();
    await store.getState().createProject({ key: "WM", name: "Work Manager" });
    const item = await store.getState().createItem({ title: "A" });
    return { store, item };
  }

  it("adds, edits and deletes notes and tracks counts", async () => {
    const { store, item } = await setup();
    const a = await store.getState().addNote(item.id, "first");
    await store.getState().addNote(item.id, "second");
    expect(countNotes(store.getState().notes)).toEqual({ [item.id]: 2 });

    const edited = await store.getState().updateNote(a.id, "first (edited)");
    expect(edited.body).toBe("first (edited)");
    expect((await store.getState().loadNotes(item.id)).map((n) => n.body)).toEqual([
      "first (edited)",
      "second",
    ]);

    await store.getState().deleteNote(a.id);
    await store.getState().deleteNote((await store.getState().loadNotes(item.id))[0].id);
    expect(countNotes(store.getState().notes)).toEqual({});
  });

  it("restores counts on init and clears them when the item is deleted", async () => {
    const { store, item } = await setup();
    await store.getState().addNote(item.id, "hello");

    const reloaded = createAppStore(repo);
    await reloaded.getState().init();
    expect(countNotes(reloaded.getState().notes)).toEqual({ [item.id]: 1 });

    await reloaded.getState().deleteItem(item.id);
    expect(countNotes(reloaded.getState().notes)).toEqual({});
  });

  it("rejects empty notes without changing counts", async () => {
    const { store, item } = await setup();
    await expect(store.getState().addNote(item.id, "  ")).rejects.toThrow();
    expect(countNotes(store.getState().notes)).toEqual({});
  });

  it("keeps counts per project", async () => {
    const { store, item } = await setup();
    await store.getState().addNote(item.id, "x");
    const first = store.getState().activeProjectId!;
    await store.getState().createProject({ key: "OT", name: "Other" });
    expect(countNotes(store.getState().notes)).toEqual({});
    await store.getState().selectProject(first);
    expect(countNotes(store.getState().notes)).toEqual({ [item.id]: 1 });
  });
});
