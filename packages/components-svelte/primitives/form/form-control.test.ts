import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { textSnippet } from "../../test/snippets";
import FormControl from "./form-control.part.svelte";

describe("Form.Control", () => {
  it("stacks a label, its field and its error", () => {
    const { container } = render(FormControl, { children: textSnippet("Email") });

    expect(screen.getByText("Email").parentElement).toBe(
      container.querySelector('[data-slot="form-control"]'),
    );
  });
});
