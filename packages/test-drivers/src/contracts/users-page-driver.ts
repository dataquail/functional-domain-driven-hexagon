// Tier-agnostic UsersPage driver contract. The driver speaks
// business intent (createUser, expectUserInList) at user-perceivable
// granularity (visible text, ARIA roles, presence/absence) — never
// DOM internals or CSS classes. The same set of methods is
// implemented at every tier:
//
//   - presenter (in-memory ApiClient stub): exercised from
//     presenter tests via the rtl adapter
//   - integration (in-process backend): exercised from
//     @org/web's integration tests via the rtl adapter
//   - acceptance (Playwright + live server): exercised from
//     @org/acceptance via the playwright adapter
//
// The spec body is identical at the integration and acceptance tiers;
// only the setup phase and the driver factory differ. See the
// worked example in @org/web's createUser tests.

export type CreateUserInput = {
  readonly email: string;
  readonly country: string;
  readonly street: string;
  readonly postalCode: string;
};

export type CreateUserField = keyof CreateUserInput;

export type ToastKind = "success" | "error";

export interface UsersPageDriver {
  // Visit the users page. Acceptance: navigate. Integration:
  // render the page component. Presenter: render the create-user
  // form only (no page chrome).
  readonly goto: () => Promise<void>;

  // Fill the form and submit. The driver wraps the field-level
  // interactions so tests don't enumerate every input.
  readonly createUser: (input: CreateUserInput) => Promise<void>;

  // Assert a user appears in the list, keyed by email.
  readonly expectUserInList: (email: string) => Promise<void>;

  // Assert a per-field validation error is visible.
  readonly expectFieldError: (field: CreateUserField) => Promise<void>;

  // Assert a toast of the given kind with the given message is
  // visible. Acceptance: sonner's DOM. Integration: the
  // RecordingToast in the presenter harness, or the page-level
  // toaster mounted in the integration harness.
  readonly expectToast: (kind: ToastKind, message: string) => Promise<void>;
}
