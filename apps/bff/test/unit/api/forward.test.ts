import { describe, expect, it } from "vitest";
import { FORWARDED, forwarding } from "../../../src/lib/server/api/forward.ts";
import { postTodo } from "../../../src/lib/server/api/todos.ts";

/** A fake binding that keeps each request it is sent, and the `cf` it was given beside it. */
const recording = () => {
  const sent: Request[] = [];
  const cfs: unknown[] = [];
  const api = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push(new Request(input, init));
      cfs.push((init as { cf?: unknown } | undefined)?.cf);
      return Response.json({ ok: true, data: { id: "id-1", title: "buy milk", completed: false } });
    },
  };
  return { api, sent, cfs };
};

/** A browser request, with `cf` as the platform puts it on one when given. */
const browser = (headers: Record<string, string>, cf?: unknown) => {
  const request = new Request("http://localhost:5173/?/add", { method: "POST", headers });
  if (cf !== undefined) {
    Object.defineProperty(request, "cf", { value: cf });
  }
  return request;
};

describe("the forwarding fetcher", () => {
  it("forwards the cookie and where the request came from", async () => {
    const { api, sent } = recording();
    const from = browser({
      Cookie: "sid=abc",
      Origin: "http://localhost:5173",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "navigate",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
    });

    await postTodo(forwarding(api, from), { title: "buy milk" });

    const [call] = sent;
    expect(call?.headers.get("Cookie")).toBe("sid=abc");
    expect(call?.headers.get("Origin")).toBe("http://localhost:5173");
    expect(call?.headers.get("Sec-Fetch-Site")).toBe("same-origin");
    expect(call?.headers.get("Sec-Fetch-Mode")).toBe("navigate");
    expect(call?.headers.get("User-Agent")).toContain("Firefox/132.0");
  });

  it("carries the browser request's city on the call's cf, and nothing else of it (L51)", async () => {
    const { api, cfs } = recording();

    await postTodo(forwarding(api, browser({}, { city: "Lisbon", country: "PT", latitude: "38.7" })), { title: "buy milk" });

    expect(cfs).toEqual([{ city: "Lisbon" }]);
  });

  it("gives no cf when the browser request's has no city", async () => {
    for (const cf of [undefined, {}, { city: "" }, { city: 7 }]) {
      const { api, cfs } = recording();
      await postTodo(forwarding(api, browser({}, cf)), { title: "buy milk" });
      expect(cfs, JSON.stringify(cf)).toEqual([undefined]);
    }
  });

  it("keeps the call's own method, path, headers and body", async () => {
    const { api, sent } = recording();

    await postTodo(forwarding(api, browser({ Cookie: "sid=abc" })), { title: "buy milk" });

    const [call] = sent;
    expect(call?.method).toBe("POST");
    expect(call?.url).toBe("https://todo-api/todos");
    expect(call?.headers.get("Content-Type")).toBe("application/json");
    expect(await call?.json()).toEqual({ title: "buy milk" });
  });

  it("sends no forwarded header the browser did not send", async () => {
    const { api, sent } = recording();

    await postTodo(forwarding(api, browser({})), { title: "buy milk" });

    const [call] = sent;
    for (const name of FORWARDED) {
      expect(call?.headers.has(name), name).toBe(false);
    }
  });

  it("forwards no other browser header", async () => {
    const { api, sent } = recording();

    await postTodo(forwarding(api, browser({ Authorization: "Bearer xyz", "X-Other": "1" })), { title: "buy milk" });

    const [call] = sent;
    expect(call?.headers.has("Authorization")).toBe(false);
    expect(call?.headers.has("X-Other")).toBe(false);
  });
});
