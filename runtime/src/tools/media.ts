import type { DesktopCommandRunner } from "./desktop.js";

export type MediaAction =
  | "play_pause"
  | "play"
  | "pause"
  | "next"
  | "previous"
  | "source_next"
  | "source_previous";

export type MediaActionResult =
  | {
      ok: true;
      action: MediaAction;
      method: string;
    }
  | {
      ok: false;
      action: MediaAction;
      method: string;
      reason: "unhandled" | "unexpected_result";
    };

export type MediaActionService = {
  control(action: MediaAction, signal?: AbortSignal): Promise<MediaActionResult>;
};

export function mediaMethod(action: string): string | undefined {
  const methods: Record<string, string> = {
    play_pause: "playPause",
    play: "play",
    pause: "pause",
    next: "next",
    previous: "previous",
    source_next: "sourceNext",
    source_previous: "sourcePrevious"
  };

  return methods[action];
}

export function createMediaActionService(
  run: DesktopCommandRunner
): MediaActionService {
  return {
    async control(action, signal) {
      const method = mediaMethod(action);

      if (method === undefined) {
        throw new Error("Unsupported media action");
      }

      const result = await run(
        "omarchy-shell",
        ["media", method],
        signal
      );

      const output = `${result.stdout}\n${result.stderr}`.trim();

      if (output === "unhandled") {
        return {
          ok: false,
          action,
          method,
          reason: "unhandled"
        };
      }

      if (output !== "ok") {
        return {
          ok: false,
          action,
          method,
          reason: "unexpected_result"
        };
      }

      return {
        ok: true,
        action,
        method
      };
    }
  };
}
