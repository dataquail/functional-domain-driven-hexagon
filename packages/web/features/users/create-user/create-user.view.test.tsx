import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";

import { CreateUser } from "./create-user.view";
import { fieldsAtom, submitAtom, submitAttemptedAtom } from "./create-user.view-model";

const FILLED = {
  email: "ada@example.com",
  country: "US",
  street: "2 B St",
  postalCode: "10002",
};

describe("CreateUser view", () => {
  it("renders each field with the value held in the ViewModel", () => {
    renderView(<CreateUser />, { initialValues: [[fieldsAtom, FILLED]] });

    expect(screen.getByTestId("create-user-email")).toHaveValue("ada@example.com");
    expect(screen.getByTestId("create-user-country")).toHaveValue("US");
    expect(screen.getByTestId("create-user-street")).toHaveValue("2 B St");
    expect(screen.getByTestId("create-user-postal-code")).toHaveValue("10002");
  });

  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(<CreateUser />);

    await user.type(screen.getByTestId("create-user-country"), "GB");

    expect(registry.get(fieldsAtom).country).toBe("GB");
  });

  it("shows no errors before a submit attempt", () => {
    renderView(<CreateUser />);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows one alert per invalid field once submission has been attempted", () => {
    renderView(<CreateUser />, { initialValues: [[submitAttemptedAtom, true]] });

    // Every field of an untouched form violates the contract's minimum length.
    expect(screen.getAllByRole("alert")).toHaveLength(4);
  });

  it("dispatches submit to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(<CreateUser />, { initialValues: [[fieldsAtom, FILLED]] });

    await user.click(screen.getByTestId("create-user-submit"));

    expect(registry.get(submitAttemptedAtom)).toBe(true);
  });

  it("disables the button and says so while the request is in flight", () => {
    renderView(<CreateUser />, {
      initialValues: [[submitAtom, AsyncResult.initial(true)]],
    });

    const button = screen.getByTestId("create-user-submit");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Creating…");
  });
});
