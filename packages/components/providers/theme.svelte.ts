import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { getContext, hasContext, setContext } from "svelte";

const Theme = Schema.Literals(["dark", "light", "system"]);

export type Theme = typeof Theme.Type;

export type ActualTheme = "dark" | "light";

export type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

// Resolved on use, not on construction: a server render has no browser storage.
export const browserThemeStorage = (): ThemeStorage => window.localStorage;

const prefersDark = (): boolean => window.matchMedia("(prefers-color-scheme: dark)").matches;

export class ThemeState {
  public theme = $state<Theme>("system");
  readonly #storageKey: string;
  readonly #storage: () => ThemeStorage;

  constructor(defaultTheme: Theme, storageKey: string, storage: () => ThemeStorage) {
    this.theme = defaultTheme;
    this.#storageKey = storageKey;
    this.#storage = storage;
  }

  public get actualTheme(): ActualTheme {
    if (typeof window === "undefined") return "light";

    if (this.theme !== "system") return this.theme;

    if (prefersDark()) return "dark";

    return "light";
  }

  public readonly setTheme = (next: Theme): void => {
    this.#storage().setItem(this.#storageKey, next);
    this.theme = next;
  };

  public readonly restore = (): void => {
    const stored = Option.fromNullishOr(this.#storage().getItem(this.#storageKey)).pipe(
      Option.flatMap(Schema.decodeUnknownOption(Theme)),
    );

    if (Option.isSome(stored)) this.theme = stored.value;
  };
}

const THEME = Symbol("theme");

export const provideTheme = (state: ThemeState): ThemeState => setContext(THEME, state);

export const useTheme = (): ThemeState => {
  if (hasContext(THEME)) return getContext<ThemeState>(THEME);

  return new ThemeState("system", "web-ui-theme", browserThemeStorage);
};
