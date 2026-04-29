import { makePresenterHarness } from "@/test/presenter-harness";
import { UserContract } from "@org/contracts/api/Contracts";
import { UserId } from "@org/contracts/EntityIds";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCreateUserPresenter } from "./create-user.presenter";

type CreateCalls = ReadonlyArray<UserContract.CreateUserPayload>;

const validPayload: UserContract.CreateUserPayload = UserContract.CreateUserPayload.make({
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const makeApiClient = (opts?: {
  readonly create?: (
    payload: UserContract.CreateUserPayload,
  ) => Effect.Effect<UserContract.CreateUserResponse, UserContract.UserAlreadyExistsError>;
  readonly recordedCalls?: { current: CreateCalls };
}) => {
  const create =
    opts?.create ??
    (() =>
      Effect.succeed(
        new UserContract.CreateUserResponse({
          id: UserId.make("11111111-1111-1111-1111-111111111111"),
        }),
      ));

  return {
    user: {
      find: () =>
        Effect.succeed(
          new UserContract.PaginatedUsers({ users: [], page: 1, pageSize: 10, total: 0 }),
        ),
      create: (args: { payload: UserContract.CreateUserPayload }) => {
        if (opts?.recordedCalls !== undefined) {
          opts.recordedCalls.current = [...opts.recordedCalls.current, args.payload];
        }
        return create(args.payload);
      },
    },
  };
};

const fillValid = (form: ReturnType<typeof useCreateUserPresenter>["form"]) => {
  form.setFieldValue("email", validPayload.email);
  form.setFieldValue("country", validPayload.country);
  form.setFieldValue("street", validPayload.street);
  form.setFieldValue("postalCode", validPayload.postalCode);
};

let harness: ReturnType<typeof makePresenterHarness>;

beforeEach(() => {
  harness = makePresenterHarness({ apiClient: makeApiClient() });
});

afterEach(async () => {
  await harness.dispose();
});

describe("useCreateUserPresenter", () => {
  it("submits a valid payload, calls the create mutation, and resets the form", async () => {
    const recorded: { current: CreateCalls } = { current: [] };
    harness = makePresenterHarness({ apiClient: makeApiClient({ recordedCalls: recorded }) });

    const { result } = renderHook(() => useCreateUserPresenter(), { wrapper: harness.wrapper });

    act(() => {
      fillValid(result.current.form);
    });

    await act(async () => {
      await result.current.form.handleSubmit();
    });

    expect(recorded.current).toHaveLength(1);
    expect(recorded.current[0]?.email).toBe(validPayload.email);

    await waitFor(() => {
      expect(result.current.form.state.values.email).toBe("");
      expect(result.current.form.state.values.country).toBe("");
    });

    const toasts = await harness.getToasts();
    expect(toasts).toEqual([{ kind: "success", message: "User created!" }]);
  });

  it("surfaces field errors and does not call the mutation on invalid submit", async () => {
    const recorded: { current: CreateCalls } = { current: [] };
    harness = makePresenterHarness({ apiClient: makeApiClient({ recordedCalls: recorded }) });

    const { result } = renderHook(() => useCreateUserPresenter(), { wrapper: harness.wrapper });

    await act(async () => {
      await result.current.form.handleSubmit();
    });

    expect(recorded.current).toHaveLength(0);
    expect(result.current.form.state.errorMap.onSubmit?.email).toBeDefined();
    expect(result.current.form.state.errorMap.onSubmit?.country).toBeDefined();
    expect(result.current.form.state.errorMap.onSubmit?.street).toBeDefined();
    expect(result.current.form.state.errorMap.onSubmit?.postalCode).toBeDefined();
  });

  it("emits a tagged error toast and keeps the form value when the user already exists", async () => {
    const recorded: { current: CreateCalls } = { current: [] };
    const failingApi = makeApiClient({
      recordedCalls: recorded,
      create: () =>
        Effect.fail(
          new UserContract.UserAlreadyExistsError({
            email: validPayload.email,
            message: "User already exists",
          }),
        ),
    });
    harness = makePresenterHarness({ apiClient: failingApi });

    const { result } = renderHook(() => useCreateUserPresenter(), { wrapper: harness.wrapper });

    act(() => {
      fillValid(result.current.form);
    });

    await act(async () => {
      try {
        await result.current.form.handleSubmit();
      } catch {
        /* mutateAsync rejects on failure; presenter does not reset on error */
      }
    });

    expect(result.current.form.state.values.email).toBe(validPayload.email);

    const toasts = await harness.getToasts();
    expect(toasts).toEqual([{ kind: "error", message: "User already exists" }]);
  });
});
