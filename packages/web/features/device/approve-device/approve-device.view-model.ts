// ViewModel for CLI device approval.
//
// The code arrives in the URL (`?code=`), and a View may not run an effect to
// copy a prop into state -- so the initial code is the family key instead. The
// atom for `"ABCD-2345"` starts pre-filled with it; the atom for `""` starts
// empty. No effect, no synchronisation, and a test can address either.
//
// The success state is durable rather than transient: once approved, the page
// swaps to a "return to your terminal" confirmation, so the flag outlives the
// toast that announced it.

import { AuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { type FieldErrors, validateWithSchema } from "@/services/atom/form-validation";
import { notify } from "@/services/atom/notifications.shared";
import { approveDeviceAtom } from "@/services/data-access/device.atoms";

export type ApproveDeviceFields = {
  readonly userCode: string;
};

const validate = validateWithSchema(AuthContract.DeviceApprovalPayload);

export const fieldsAtom = Atom.family((initialCode: string) =>
  Atom.make<ApproveDeviceFields>({ userCode: initialCode }),
);

export const submitAttemptedAtom = Atom.family((_initialCode: string) => Atom.make(false));

export const errorsAtom = Atom.family((initialCode: string) =>
  Atom.make((get): FieldErrors<ApproveDeviceFields> | null =>
    validate(get(fieldsAtom(initialCode))),
  ),
);

export const visibleErrorsAtom = Atom.family((initialCode: string) =>
  Atom.make((get): FieldErrors<ApproveDeviceFields> | null =>
    get(submitAttemptedAtom(initialCode)) ? get(errorsAtom(initialCode)) : null,
  ),
);

export const setUserCodeAtom = Atom.family((initialCode: string) =>
  Atom.fnSync<string>()((userCode, get) => {
    get.set(fieldsAtom(initialCode), { userCode });
  }),
);

export const submitAtom = Atom.family((initialCode: string) =>
  ApiAtoms.runtime.fn<void>()((_, get) =>
    Effect.gen(function* () {
      get.set(submitAttemptedAtom(initialCode), true);
      if (get(errorsAtom(initialCode)) !== null) return;

      yield* get
        .setResult(approveDeviceAtom, {
          payload: new AuthContract.DeviceApprovalPayload(get(fieldsAtom(initialCode))),
        })
        .pipe(
          notify(get, {
            success: () => "Device approved — return to your terminal.",
            errors: {
              NotFound: (error) => error.message,
              Gone: (error) => error.message,
            },
          }),
        );
    }),
  ),
);

export const isApprovedAtom = Atom.make((get): boolean =>
  AsyncResult.isSuccess(get(approveDeviceAtom)),
);
