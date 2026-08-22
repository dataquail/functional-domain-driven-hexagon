// ViewModel for accepting an invitation. On success the caller is moved into
// the org they just joined; the 410 Gone cases (accepted / revoked / expired)
// leave them on the page with the server's own explanation.

import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { navigateTo } from "@/services/atom/navigation.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import { acceptInvitationAtom } from "@/services/data-access/orgs.atoms";

export const acceptAtom = ApiAtoms.runtime.fn<string>()((token, get) =>
  Effect.gen(function* () {
    const accepted = yield* get.setResult(acceptInvitationAtom, {
      params: { token },
      reactivityKeys: ReactivityKeys.organizations,
    });

    navigateTo(get, `/orgs/${accepted.organizationId}`);
  }).pipe(
    notify(get, {
      success: () => "Invitation accepted!",
      errors: {
        InvitationNotFoundError: (error) => error.message,
        InvitationGoneError: (error) => error.message,
      },
    }),
  ),
);

export const isAcceptingAtom = Atom.make((get): boolean => get(acceptAtom).waiting);
