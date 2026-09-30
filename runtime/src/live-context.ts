import {
  readDesktopState,
  runDesktopCommand,
  type DesktopCommandRunner
} from "./tools/desktop.js";

export type LiveWindowTarget = {
  address: string;
  pid: number;
  workspace?: number;
  class?: string;
  initialClass?: string;
};

export type LiveContextSnapshot = {
  activeWindow?: LiveWindowTarget;
  activeWorkspace?: number;
};

export type LiveContextResolver = (
  signal?: AbortSignal
) => Promise<LiveContextSnapshot>;

export async function resolveLiveContext(
  run: DesktopCommandRunner = runDesktopCommand,
  signal?: AbortSignal
): Promise<LiveContextSnapshot> {
  const state = await readDesktopState(run, false, signal);
  const window = state.activeWindow;

  const activeWindow =
    window !== undefined && window.pid !== undefined
      ? {
          address: window.address,
          pid: window.pid,
          ...(window.workspace === undefined
            ? {}
            : { workspace: window.workspace }),
          ...(window.class === undefined
            ? {}
            : { class: window.class }),
          ...(window.initialClass === undefined
            ? {}
            : { initialClass: window.initialClass })
        }
      : undefined;

  return {
    ...(activeWindow === undefined ? {} : { activeWindow }),
    ...(state.activeWorkspace?.id === undefined
      ? {}
      : { activeWorkspace: state.activeWorkspace.id })
  };
}
