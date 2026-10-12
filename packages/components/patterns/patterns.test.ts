import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { textSnippet } from "../test/snippets";
import AppShell from "./app-shell.svelte";
import CardSection from "./card-section.svelte";
import EmptyState from "./empty-state.svelte";
import ListRow from "./list-row.svelte";
import PageShell from "./page-shell.svelte";
import Pagination from "./pagination.svelte";

describe("AppShell", () => {
  it("pins the nav above a growing content region", () => {
    render(AppShell, { nav: textSnippet("Nav"), children: textSnippet("Body") });

    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-screen");
    expect(main.firstElementChild).toHaveTextContent("Nav");
    expect(screen.getByText("Body").parentElement).toHaveClass("flex-1", "py-12");
  });
});

describe("CardSection", () => {
  it("is a titled card", () => {
    render(CardSection, {
      title: "Invite a teammate",
      children: textSnippet("Body"),
      "data-testid": "section",
    });

    expect(screen.getByRole("heading", { level: 2, name: "Invite a teammate" })).toHaveClass(
      "text-2xl",
    );
    expect(screen.getByTestId("section")).toHaveClass("shadow-md");
  });

  it("puts an action opposite the title", () => {
    render(CardSection, { title: "Members", titleSize: "lg", action: textSnippet("Invite") });

    const heading = screen.getByRole("heading", { name: "Members" });
    expect(heading.parentElement).toHaveClass("justify-between");
    expect(heading.parentElement).toHaveTextContent("Invite");
  });
});

describe("EmptyState", () => {
  it("states what is missing", () => {
    render(EmptyState, { message: "No todos yet.", "data-testid": "empty" });

    expect(screen.getByTestId("empty")).toHaveTextContent("No todos yet.");
    expect(screen.getByTestId("empty")).toHaveClass("bg-muted/50");
  });

  it("adds a hint and a call to action", () => {
    render(EmptyState, {
      message: "No organizations yet.",
      hint: "Create one.",
      action: textSnippet("Create"),
    });

    expect(screen.getByText("Create one.")).toHaveClass("text-xs");
    expect(screen.getByText("Create")).toBeInTheDocument();
  });
});

describe("ListRow", () => {
  it("lays out leading, content and trailing on a card", () => {
    render(ListRow, {
      as: "li",
      leading: textSnippet("Lead"),
      children: textSnippet("Content"),
      trailing: textSnippet("Trail"),
      "data-testid": "row",
    });

    expect(screen.getByTestId("row").tagName).toBe("LI");
    expect(screen.getByTestId("row")).not.toHaveClass("group");
    expect(screen.getByText("Trail").closest('[data-slot="reveal"]')).toBeNull();
  });

  it("can fade its trailing controls in on hover", () => {
    render(ListRow, {
      revealTrailing: true,
      trailing: textSnippet("Delete"),
      "data-testid": "row",
    });

    expect(screen.getByTestId("row")).toHaveClass("group");
    expect(screen.getByText("Delete").closest('[data-slot="reveal"]')).not.toBeNull();
  });
});

describe("PageShell", () => {
  it("is a width-capped column of sections", () => {
    render(PageShell, { width: "sm", children: textSnippet("Section"), "data-testid": "page" });

    expect(screen.getByTestId("page")).toHaveClass("max-w-lg");
    expect(screen.getByText("Section").parentElement).toHaveClass("gap-4");
  });
});

describe("Pagination", () => {
  const props = {
    page: 2,
    totalPages: 4,
    total: 37,
    itemLabel: "users",
    hasPrevious: true,
    hasNext: false,
  };

  it("states the position and reports intent upward", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(Pagination, { ...props, onPrevious, onNext });

    expect(screen.getByText("Page 2 of 4 · 37 users")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByTestId("pagination-next")).toBeDisabled();
  });

  it("counts items by default", () => {
    const { itemLabel: _itemLabel, ...withoutLabel } = props;
    render(Pagination, { ...withoutLabel, onPrevious: () => {}, onNext: () => {} });

    expect(screen.getByText("Page 2 of 4 · 37 items")).toBeInTheDocument();
  });
});
