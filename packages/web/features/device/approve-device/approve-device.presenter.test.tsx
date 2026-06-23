// Presenter test: stubs the mutation hook so we can assert the wiring
// without a QueryClient. Submitting the form should dispatch the decoded
// user code; `isApproved` mirrors the mutation's success flag.

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApproveDevicePresenter } from "./approve-device.presenter";

const mutateAsync = vi.fn();
let isSuccess = false;

vi.mock("@/services/data-access/use-device-queries", () => ({
  useApproveDeviceMutation: () => ({ mutateAsync, isSuccess }),
}));

describe("useApproveDevicePresenter", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    isSuccess = false;
  });

  it("submits the decoded user code", async () => {
    mutateAsync.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useApproveDevicePresenter(""));
    result.current.form.setFieldValue("userCode", "ABCD-2345");

    await act(async () => {
      await result.current.form.handleSubmit();
    });

    expect(mutateAsync).toHaveBeenCalledWith({ userCode: "ABCD-2345" });
  });

  it("prefills the user code from the verification link", () => {
    const { result } = renderHook(() => useApproveDevicePresenter("WXYZ-2345"));
    expect(result.current.form.state.values.userCode).toBe("WXYZ-2345");
  });

  it("reflects the mutation success flag as isApproved", () => {
    isSuccess = true;
    const { result } = renderHook(() => useApproveDevicePresenter(""));
    expect(result.current.isApproved).toBe(true);
  });
});
