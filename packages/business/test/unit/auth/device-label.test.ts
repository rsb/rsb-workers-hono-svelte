import { describe, expect, it } from "vitest";
import { deviceLabel } from "../../../src/auth/device-label.ts";

// Real User-Agent strings, as each browser sends them.
const AGENTS = {
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  operaMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  firefoxAndroid: "Mozilla/5.0 (Android 15; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0",
  chromeChromeOs: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
};

describe("deviceLabel", () => {
  it.each([
    ["firefoxLinux", "Firefox on Linux"],
    ["chromeWindows", "Chrome on Windows"],
    ["edgeWindows", "Edge on Windows"],
    ["operaMac", "Opera on macOS"],
    ["safariMac", "Safari on macOS"],
    ["safariIphone", "Safari on iOS"],
    ["chromeIphone", "Chrome on iOS"],
    ["chromeAndroid", "Chrome on Android"],
    ["firefoxAndroid", "Firefox on Android"],
    ["chromeChromeOs", "Chrome on ChromeOS"],
    ["safariIpad", "Safari on iPadOS"],
  ] as const)("names %s as %s", (agent, label) => {
    expect(deviceLabel(AGENTS[agent])).toBe(label);
  });

  it("names the browser alone when the system is not in the table", () => {
    expect(deviceLabel("Mozilla/5.0 (FreeBSD amd64; rv:132.0) Gecko/20100101 Firefox/132.0")).toBe("Firefox");
  });

  it("names the system alone when the browser is not in the table", () => {
    expect(deviceLabel("SomeApp/1.0 (Windows NT 10.0)")).toBe("Windows");
  });

  it("is null for a User-Agent it knows nothing of, or none", () => {
    expect(deviceLabel("curl/8.10.1")).toBeNull();
    expect(deviceLabel("")).toBeNull();
    expect(deviceLabel(undefined)).toBeNull();
  });
});
