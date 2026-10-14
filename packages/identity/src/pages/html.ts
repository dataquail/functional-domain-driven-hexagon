import * as Option from "effect/Option";

const ESCAPES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
]);

export class SafeHtml {
  constructor(public readonly value: string) {}
}

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ESCAPES.get(c) ?? c);

type Fragment = SafeHtml | string | number;

// An absent value renders as nothing.
type Interpolation = Fragment | Option.Option<Fragment> | ReadonlyArray<Interpolation>;

const render = (value: Interpolation): string => {
  if (Option.isOption(value)) return Option.match(value, { onNone: () => "", onSome: render });

  if (value instanceof SafeHtml) return value.value;

  if (Array.isArray(value)) return value.map(render).join("");

  return escapeHtml(String(value));
};

export const html = (
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Interpolation>
): SafeHtml =>
  new SafeHtml(strings.reduce((out, chunk, i) => out + chunk + render(values[i] ?? ""), ""));

export const htmlResponse = (body: SafeHtml, status = 200): Response =>
  new Response(body.value, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
