import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectBanner } from "./ProjectBanner";

afterEach(cleanup);

describe("ProjectBanner", () => {
  it("shows the project and its counts", () => {
    render(
      <ProjectBanner
        project={{ id: "p", key: "WM", name: "Work Manager", nextNumber: 1, createdAt: "", updatedAt: "" }}
        stats={{ total: 6, open: 4, done: 2, overdue: 1, archived: 0 }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Work Manager", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("WM")).toBeInTheDocument();
    expect(screen.getByText("Open").nextSibling).toHaveTextContent("4");
    expect(screen.getByText("Done").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Overdue").nextSibling).toHaveTextContent("1");
  });

  it("shows an Archived count only when something is archived", () => {
    const project = { id: "p", key: "WM", name: "Work Manager", nextNumber: 1, createdAt: "", updatedAt: "" };
    render(<ProjectBanner project={project} stats={{ total: 1, open: 1, done: 0, overdue: 0, archived: 3 }} />);
    expect(screen.getByText("Archived").nextSibling).toHaveTextContent("3");
    cleanup();
    render(<ProjectBanner project={project} stats={{ total: 1, open: 1, done: 0, overdue: 0, archived: 0 }} />);
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });
});
