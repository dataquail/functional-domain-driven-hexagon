import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { html, htmlResponse } from "./html.js";

describe("html", () => {
  it("escapes every interpolated string, so a form field cannot inject markup", () => {
    const value = `"><script>alert('x')</script>&`;
    expect(html`<input value="${value}" />`.value).toBe(
      `<input value="&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;" />`,
    );
  });

  it("nests fragments and lists without escaping them twice", () => {
    const items = ["a<b", "c"].map((item) => html`<li>${item}</li>`);
    expect(
      html`<ul>
        ${items}
      </ul>`.value.replace(/\s+/g, ""),
    ).toBe("<ul><li>a&lt;b</li><li>c</li></ul>");
  });

  it("renders a missing value as nothing", () => {
    expect(html`<p>${undefined}${null}</p>`.value).toBe("<p></p>");
  });

  it.effect("serves a fragment as an HTML response with the status asked for", () =>
    Effect.gen(function* () {
      const response = htmlResponse(html`<p>gone</p>`, 404);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(yield* Effect.promise(() => response.text())).toBe("<p>gone</p>");
    }),
  );
});
