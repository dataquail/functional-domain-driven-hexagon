import { signIn } from "@/modules/auth/commands/sign-in.js";
import { signInCommandSpanAttributes } from "@/modules/auth/commands/sign-in-command.js";
import { touchSession } from "@/modules/auth/commands/touch-session.js";
import { touchSessionCommandSpanAttributes } from "@/modules/auth/commands/touch-session-command.js";
import { commandHandlers } from "@/platform/ddd/command-bus.js";

export const authCommandHandlers = commandHandlers({
  SignInCommand: { handle: signIn, spanAttributes: signInCommandSpanAttributes },
  TouchSessionCommand: {
    handle: touchSession,
    spanAttributes: touchSessionCommandSpanAttributes,
  },
});
