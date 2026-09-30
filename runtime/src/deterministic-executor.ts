import type {
  ActionReceipt,
  DesktopActionService,
  InstalledApp
} from "./tools/desktop.js";
import {
  createDesktopActionService,
  discoverInstalledApps
} from "./tools/desktop.js";
import {
  createMediaActionService,
  type MediaActionService
} from "./tools/media.js";
import type { DeterministicRoute } from "./deterministic-router.js";

export type DeterministicExecutionResult =
  | {
      handled: true;
      message: string;
      receipt: ActionReceipt;
    }
  | {
      handled: false;
      reason: "app_not_found" | "app_ambiguous" | "unsupported_route";
    };

type DiscoverApps = (
  query: string,
  kind: "all" | "desktop" | "cli",
  limit: number,
  env: NodeJS.ProcessEnv
) => InstalledApp[];

function normalizeAppIdentity(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/\.desktop$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function selectApp(query: string, apps: InstalledApp[]): InstalledApp | undefined {
  if (apps.length === 1) return apps[0];

  const wanted = normalizeAppIdentity(query);

  const exact = apps.filter((app) => {
    return normalizeAppIdentity(app.name) === wanted
      || normalizeAppIdentity(app.id) === wanted
      || normalizeAppIdentity(app.id.split(".").at(-1) ?? "") === wanted;
  });

  return exact.length === 1 ? exact[0] : undefined;
}

export type DeterministicExecutor = {
  execute(
    route: DeterministicRoute,
    signal?: AbortSignal
  ): Promise<DeterministicExecutionResult>;
};

export function createDeterministicExecutor(
  actions: DesktopActionService = createDesktopActionService(),
  discoverApps: DiscoverApps = discoverInstalledApps,
  env: NodeJS.ProcessEnv = process.env,
  media: MediaActionService = createMediaActionService(
    async (file, args, signal) => {
      const { runDesktopCommand } = await import("./tools/desktop.js");
      return runDesktopCommand(file, args, signal);
    }
  )
): DeterministicExecutor {
  return {
    async execute(
      route: DeterministicRoute,
      signal?: AbortSignal
    ): Promise<DeterministicExecutionResult> {
      if (route.family === "app") {
        const apps = discoverApps(route.query, "all", 10, env);
        const app = selectApp(route.query, apps);

        if (app === undefined) {
          return {
            handled: false,
            reason: apps.length === 0 ? "app_not_found" : "app_ambiguous"
          };
        }

        const receipt = await actions.openApp({
          kind: app.kind,
          id: app.id,
          mode: "focus_or_launch"
        }, signal);

        return {
          handled: true,
          message: `${app.name} is ready.`,
          receipt
        };
      }

      if (route.family === "media") {
        const result = await media.control(route.operation, signal);

        if (!result.ok && result.reason === "unhandled") {
          return {
            handled: true,
            message: "No active media player could handle that action.",
            receipt: {
              action: `media_${route.operation}`,
              target: { media: true },
              requested: { action: route.operation },
              before: undefined,
              after: { ok: false, reason: "unhandled" },
              changed: false,
              verified: true
            }
          };
        }

        if (!result.ok) {
          throw new Error("Unexpected media control result");
        }

        return {
          handled: true,
          message: `Media ${route.operation}.`,
          receipt: {
            action: `media_${route.operation}`,
            target: { media: true },
            requested: { action: route.operation },
            before: undefined,
            after: { ok: true },
            changed: true,
            verified: true
          }
        };
      }

      if (route.family === "workspace") {
        const receipt = await actions.workspaceAction({
          action: "focus",
          workspace: route.workspace
        }, signal);

        return {
          handled: true,
          message: `Workspace ${route.workspace}.`,
          receipt
        };
      }

      return {
        handled: false,
        reason: "unsupported_route"
      };
    }
  };
}
