import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";

import { CreateOrg } from "./create-org.view";
import { fieldsAtom, submitAtom, submitAttemptedAtom } from "./create-org.view-model";

describe("CreateOrg view", () => {
  it("renders the name held in the ViewModel", () => {
    renderView(<CreateOrg />, { initialValues: [[fieldsAtom, { name: "Acme Inc." }]] });

    expect(screen.getByTestId("create-org-name")).toHaveValue("Acme Inc.");
  });

  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(<CreateOrg />);

    await user.type(screen.getByTestId("create-org-name"), "Acme");

    expect(registry.get(fieldsAtom).name).toBe("Acme");
  });

  it("shows no error before a submit attempt", () => {
    renderView(<CreateOrg />);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows the error once submission has been attempted with a blank name", () => {
    renderView(<CreateOrg />, { initialValues: [[submitAttemptedAtom, true]] });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("dispatches submit to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(<CreateOrg />, {
      initialValues: [[fieldsAtom, { name: "Acme Inc." }]],
    });

    await user.click(screen.getByTestId("create-org-submit"));

    expect(registry.get(submitAttemptedAtom)).toBe(true);
  });

  it("disables the button and says so while the request is in flight", () => {
    renderView(<CreateOrg />, { initialValues: [[submitAtom, AsyncResult.initial(true)]] });

    const button = screen.getByTestId("create-org-submit");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Creating…");
  });
});
