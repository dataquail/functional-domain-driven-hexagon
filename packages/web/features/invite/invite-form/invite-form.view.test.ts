import { screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";
import { ORG_A_ID } from "@/test/fixtures/organization";

import InviteForm from "./invite-form.view.svelte";
import { fieldsAtom, submitAttemptedAtom } from "./invite-form.view-model";

describe("InviteForm view", () => {
  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(InviteForm, { orgId: ORG_A_ID });

    await user.type(screen.getByLabelText("Invitee email"), "ada@example.com");

    expect(registry.get(fieldsAtom).email).toBe("ada@example.com");
  });

  it("announces an invalid email once submission has been attempted", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(InviteForm, { orgId: ORG_A_ID });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);

    await user.click(screen.getByTestId("invite-submit"));

    expect(registry.get(submitAttemptedAtom)).toBe(true);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
