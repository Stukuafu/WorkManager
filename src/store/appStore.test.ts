import { beforeEach, describe, expect, it } from "vitest";
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
    store.getState().selectProject(a.id);
    expect(store.getState().activeProjectId).toBe(a.id);
    store.getState().selectProject("missing");
    expect(store.getState().activeProjectId).toBe(a.id);
  });

  it("restores the last active project on init", async () => {
    const first = createAppStore(repo);
    await first.getState().init();
    const a = await first.getState().createProject({ key: "AA", name: "A" });
    await first.getState().createProject({ key: "BB", name: "B" });
    first.getState().selectProject(a.id);

    const second = createAppStore(repo);
    await second.getState().init();
    expect(second.getState().activeProjectId).toBe(a.id);
  });
});
