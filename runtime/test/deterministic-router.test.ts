import { describe, expect, it } from "vitest";
import { matchDeterministicRoute } from "../src/deterministic-router.js";


describe("deterministic router", () => {
  it.each([
    ["open terminal", { family: "app", operation: "open", query: "terminal" }],
    ["open Spotify", { family: "app", operation: "open", query: "Spotify" }],
    ["launch Files", { family: "app", operation: "open", query: "Files" }],
    ["pause music", { family: "media", operation: "pause" }],
    ["play music", { family: "media", operation: "play" }],
    ["next track", { family: "media", operation: "next" }],
    ["previous song", { family: "media", operation: "previous" }],
    ["workspace 2", { family: "workspace", operation: "focus", workspace: 2 }],
    ["switch to workspace 7", { family: "workspace", operation: "focus", workspace: 7 }]
  ])("matches %s", (input, expected) => {
    expect(matchDeterministicRoute(input)).toEqual(expected);
  });

  it.each([
    "open instagram.com",
    "open " + "https" + ":" + "/" + "/" + "github" + "." + "com",
    "open " + "www" + "." + "github" + "." + "com",
    "explain Spotify",
    "pause and open terminal",
    "workspace 0",
    "workspace 100",
    "move terminal to workspace 3",
    "what is workspace 2?"
  ])("falls through for %s", (input) => {
    expect(matchDeterministicRoute(input)).toBeUndefined();
  });
});
