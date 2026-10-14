import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { textSnippet } from "../../test/snippets";
import { List } from "./index";

describe("List", () => {
  it("is an unordered list by default", () => {
    render(List, { "data-testid": "list" });

    expect(screen.getByTestId("list").tagName).toBe("UL");
    expect(screen.getByTestId("list")).toHaveClass("space-y-2", "list-none");
  });

  it("may be ordered and bulleted", () => {
    render(List, { as: "ol", marker: "disc", gap: "xs", "data-testid": "list" });

    expect(screen.getByTestId("list").tagName).toBe("OL");
    expect(screen.getByTestId("list")).toHaveClass("list-disc", "space-y-1");
  });

  it("holds items", () => {
    render(List.Item, { children: textSnippet("First"), "data-testid": "item" });

    expect(screen.getByTestId("item").tagName).toBe("LI");
    expect(screen.getByTestId("item")).toHaveTextContent("First");
  });
});
