import { describe, expect, it } from "vitest";
import { createDeterministicExecutor } from "../src/deterministic-executor.js";
import type {
  ActionReceipt,
  AppOpenInput,
  DesktopActionService,
  InstalledApp,
  WindowActionInput,
  WorkspaceActionInput
} from "../src/tools/desktop.js";

const receipt: ActionReceipt = {
  action: "test",
  target: {},
  requested: {},
  before: undefined,
  after: undefined,
  changed: true,
  verified: true
};

function fakeActions(): {
  actions: DesktopActionService;
  opened: AppOpenInput[];
  windows: WindowActionInput[];
  workspaces: WorkspaceActionInput[];
} {
  const opened: AppOpenInput[] = [];
  const windows: WindowActionInput[] = [];
  const workspaces: WorkspaceActionInput[] = [];

  const actions: DesktopActionService = {
    openApp(input) {
      opened.push(input);
      return Promise.resolve(receipt);
    },

    windowAction(input) {
      windows.push(input);
      return Promise.resolve(receipt);
    },

    workspaceAction(input) {
      workspaces.push(input);
      return Promise.resolve(receipt);
    }
  };

  return { actions, opened, windows, workspaces };
}

describe("deterministic executor", () => {
  it("opens one unambiguous discovered app through the shared desktop service", async () => {
    const { actions, opened } = fakeActions();

    const apps: InstalledApp[] = [
      {
        kind: "desktop",
        id: "spotify",
        name: "Spotify"
      }
    ];

    const executor = createDeterministicExecutor(
      actions,
      () => apps,
      {}
    );

    const result = await executor.execute({
      family: "app",
      operation: "open",
      query: "Spotify"
    });

    expect(result.handled).toBe(true);
    expect(opened).toEqual([
      {
        kind: "desktop",
        id: "spotify",
        mode: "focus_or_launch"
      }
    ]);
  });

  it("selects one exact app from multiple search results", async () => {
    const { actions, opened } = fakeActions();

    const apps: InstalledApp[] = [
      {
        kind: "desktop",
        id: "spotify",
        name: "Spotify"
      },
      {
        kind: "desktop",
        id: "spotify-player-extra",
        name: "Spotify Player Extra"
      }
    ];

    const executor = createDeterministicExecutor(
      actions,
      () => apps,
      {}
    );

    const result = await executor.execute({
      family: "app",
      operation: "open",
      query: "Spotify"
    });

    expect(result.handled).toBe(true);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.id).toBe("spotify");
  });

  it("prefers an exact desktop app over a duplicate CLI identity", async () => {
    const { actions, opened } = fakeActions();

    const apps: InstalledApp[] = [
      {
        kind: "cli",
        id: "spotify",
        name: "spotify"
      },
      {
        kind: "desktop",
        id: "spotify",
        name: "Spotify"
      }
    ];

    const executor = createDeterministicExecutor(
      actions,
      () => apps,
      {}
    );

    const result = await executor.execute({
      family: "app",
      operation: "open",
      query: "Spotify"
    });

    expect(result.handled).toBe(true);
    expect(opened).toEqual([
      {
        kind: "desktop",
        id: "spotify",
        mode: "focus_or_launch"
      }
    ]);
  });

  it("resolves the configured Omarchy terminal instead of guessing one", async () => {
    const { actions, opened } = fakeActions();

    const foot: InstalledApp = {
      kind: "desktop",
      id: "foot",
      name: "Foot",
      description: "Terminal"
    };

    const ghostty: InstalledApp = {
      kind: "desktop",
      id: "com.mitchellh.ghostty",
      name: "Ghostty",
      description: "A terminal emulator"
    };

    const executor = createDeterministicExecutor(
      actions,
      (query, kind) => {
        if (query === "terminal") return [foot, ghostty];
        if (query === "foot" && kind === "desktop") return [foot];
        return [];
      },
      {},
      {
        control(action) {
          return Promise.resolve({
            ok: true,
            action,
            method: action
          });
        }
      },
      (query) => Promise.resolve(
        query === "terminal" ? "foot" : undefined
      )
    );

    const result = await executor.execute({
      family: "app",
      operation: "open",
      query: "terminal"
    });

    expect(result.handled).toBe(true);
    expect(opened).toEqual([
      {
        kind: "desktop",
        id: "foot",
        mode: "focus_or_launch"
      }
    ]);
  });

  it("falls through when app discovery returns no matches", async () => {
    const { actions, opened } = fakeActions();

    const executor = createDeterministicExecutor(
      actions,
      () => [],
      {}
    );

    const result = await executor.execute({
      family: "app",
      operation: "open",
      query: "Unknown App"
    });

    expect(result).toEqual({
      handled: false,
      reason: "app_not_found"
    });
    expect(opened).toHaveLength(0);
  });

  it("falls through when app discovery remains ambiguous", async () => {
    const { actions, opened } = fakeActions();

    const apps: InstalledApp[] = [
      {
        kind: "desktop",
        id: "editor-one",
        name: "Editor One"
      },
      {
        kind: "desktop",
        id: "editor-two",
        name: "Editor Two"
      }
    ];

    const executor = createDeterministicExecutor(
      actions,
      () => apps,
      {}
    );

    const result = await executor.execute({
      family: "app",
      operation: "open",
      query: "Editor"
    });

    expect(result).toEqual({
      handled: false,
      reason: "app_ambiguous"
    });
    expect(opened).toHaveLength(0);
  });

  it("focuses a workspace through the shared desktop service", async () => {
    const { actions, workspaces } = fakeActions();

    const executor = createDeterministicExecutor(
      actions,
      () => [],
      {}
    );

    const result = await executor.execute({
      family: "workspace",
      operation: "focus",
      workspace: 4
    });

    expect(result.handled).toBe(true);
    expect(workspaces).toEqual([
      {
        action: "focus",
        workspace: 4
      }
    ]);
  });

  it("controls media through the shared media service", async () => {
    const { actions } = fakeActions();
    const calls: string[] = [];

    const executor = createDeterministicExecutor(
      actions,
      () => [],
      {},
      {
        control(action) {
          calls.push(action);
          return Promise.resolve({
            ok: true,
            action,
            method: action
          });
        }
      }
    );

    const result = await executor.execute({
      family: "media",
      operation: "pause"
    });

    expect(result.handled).toBe(true);
    expect(calls).toEqual(["pause"]);
  });
  it("keeps recognized media commands local when no player handles them", async () => {
    const { actions } = fakeActions();

    const executor = createDeterministicExecutor(
      actions,
      () => [],
      {},
      {
        control(action) {
          return Promise.resolve({
            ok: false,
            action,
            method: action,
            reason: "unhandled"
          });
        }
      }
    );

    const result = await executor.execute({
      family: "media",
      operation: "pause"
    });

    expect(result.handled).toBe(true);

    if (result.handled) {
      expect(result.message).toBe(
        "No active media player could handle that action."
      );
    }
  });

  it("moves the active window using live desktop context", async () => {
    const { actions, windows } = fakeActions();

    const executor = createDeterministicExecutor(
      actions,
      () => [],
      {},
      {
        control(action) {
          return Promise.resolve({
            ok: true,
            action,
            method: action
          });
        }
      },
      () => Promise.resolve(undefined),
      () => Promise.resolve({
        activeWindow: {
          address: "0xabc123",
          pid: 4242,
          workspace: 1,
          class: "foot"
        },
        activeWorkspace: 1
      })
    );

    const result = await executor.execute({
      family: "window",
      operation: "move_to_workspace",
      target: "active",
      workspace: 2
    });

    expect(result.handled).toBe(true);

    expect(windows).toEqual([
      {
        action: "move_to_workspace",
        address: "0xabc123",
        pid: 4242,
        workspace: 2,
        follow: false
      }
    ]);
  });

  it("keeps an active-window command local when no window is focused", async () => {
    const { actions, windows } = fakeActions();

    const executor = createDeterministicExecutor(
      actions,
      () => [],
      {},
      {
        control(action) {
          return Promise.resolve({
            ok: true,
            action,
            method: action
          });
        }
      },
      () => Promise.resolve(undefined),
      () => Promise.resolve({
        activeWorkspace: 1
      })
    );

    const result = await executor.execute({
      family: "window",
      operation: "move_to_workspace",
      target: "active",
      workspace: 2
    });

    expect(result.handled).toBe(true);
    expect(windows).toHaveLength(0);

    if (result.handled) {
      expect(result.message).toBe("No active window is available.");
    }
  });

});
