import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectBanner } from "./ProjectBanner";

afterEach(cleanup);

describe("ProjectBanner", () => {
  it("shows the project and its counts", () => {
    render(
      <ProjectBanner
        project={{ id: "p", key: "WM", name: "Work Manager", nextNumber: 1, createdAt: "", updatedAt: "" }}
        stats={{ total: 6, open: 4, done: 2, overdue: 1 }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Work Manager", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("WM")).toBeInTheDocument();
    expect(screen.getByText("Open").nextSibling).toHaveTextContent("4");
    expect(screen.getByText("Done").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Overdue").nextSibling).toHaveTextContent("1");
  });
});
