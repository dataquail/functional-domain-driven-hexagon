const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export class SafeHtml {
  constructor(public readonly value: string) {}
}

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

type Interpolation = SafeHtml | string | number | null | undefined | ReadonlyArray<Interpolation>;

const render = (value: Interpolation): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(String(value));
};

export const html = (
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Interpolation>
): SafeHtml => new SafeHtml(strings.reduce((out, chunk, i) => out + chunk + render(values[i]), ""));

export const htmlResponse = (body: SafeHtml, status = 200): Response =>
  new Response(body.value, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
