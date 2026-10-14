import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { getContext, setContext } from "svelte";

const Theme = Schema.Literals(["dark", "light", "system"]);
export type Theme = typeof Theme.Type;

export type ActualTheme = "dark" | "light";

export class ThemeState {
  public theme = $state<Theme>("system");
  readonly #storageKey: string;

  constructor(defaultTheme: Theme, storageKey: string) {
    this.theme = defaultTheme;
    this.#storageKey = storageKey;
  }

  public get actualTheme(): ActualTheme {
    if (typeof window === "undefined") return "light";
    if (this.theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return this.theme;
  }

  public readonly setTheme = (next: Theme): void => {
    window.localStorage.setItem(this.#storageKey, next);
    this.theme = next;
  };

  public readonly restore = (): void => {
    const stored = Option.fromNullishOr(window.localStorage.getItem(this.#storageKey)).pipe(
      Option.flatMap(Schema.decodeUnknownOption(Theme)),
    );
    if (Option.isSome(stored)) this.theme = stored.value;
  };
}

const THEME = Symbol("theme");

export const provideTheme = (state: ThemeState): ThemeState => setContext(THEME, state);

export const useTheme = (): ThemeState =>
  getContext<ThemeState | undefined>(THEME) ?? new ThemeState("system", "web-ui-theme");
