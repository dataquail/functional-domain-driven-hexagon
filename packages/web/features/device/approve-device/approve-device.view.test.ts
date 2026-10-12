import { screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";

import ApproveDevice from "./approve-device.view.svelte";
import { fieldsAtom, submitAttemptedAtom } from "./approve-device.view-model";

describe("ApproveDevice view", () => {
  it("starts pre-filled with the code the CLI put in the URL", () => {
    renderView(ApproveDevice, { initialCode: "ABCD-2345" });

    expect(screen.getByTestId("device-code-input")).toHaveValue("ABCD-2345");
    expect(screen.getByLabelText("Device code")).toBe(screen.getByTestId("device-code-input"));
  });

  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(ApproveDevice, { initialCode: "" });

    await user.type(screen.getByTestId("device-code-input"), "WXYZ");

    expect(registry.get(fieldsAtom("")).userCode).toBe("WXYZ");
  });

  it("announces an invalid code once submission has been attempted", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(ApproveDevice, { initialCode: "" });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);

    await user.click(screen.getByTestId("device-approve-submit"));

    expect(registry.get(submitAttemptedAtom(""))).toBe(true);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
