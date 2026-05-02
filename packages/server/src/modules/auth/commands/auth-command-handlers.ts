import { signInCommandSpanAttributes } from "@/modules/auth/commands/sign-in-command.js";
import { signIn } from "@/modules/auth/commands/sign-in.js";
import { touchSessionCommandSpanAttributes } from "@/modules/auth/commands/touch-session-command.js";
import { touchSession } from "@/modules/auth/commands/touch-session.js";
import { commandHandlers } from "@/platform/command-bus.js";

export const authCommandHandlers = commandHandlers({
  SignInCommand: { handle: signIn, spanAttributes: signInCommandSpanAttributes },
  TouchSessionCommand: {
    handle: touchSession,
    spanAttributes: touchSessionCommandSpanAttributes,
  },
});
