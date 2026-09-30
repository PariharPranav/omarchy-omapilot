export type DeterministicRoute =
  | {
      family: "app";
      operation: "open";
      query: string;
    }
  | {
      family: "media";
      operation: "pause" | "play" | "next" | "previous";
    }
  | {
      family: "workspace";
      operation: "focus";
      workspace: number;
    };

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function looksLikeWebTarget(value: string): boolean {
  const target = value.trim().toLowerCase();

  if (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("www" + ".")
  ) {
    return true;
  }

  if (target.includes(" ") || !target.includes(".")) {
    return false;
  }

  try {
    const parsed = new URL(`https://${target}`);
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function matchDeterministicRoute(
  question: string
): DeterministicRoute | undefined {
  const input = compact(question);

  const normalized = input
    .toLowerCase()
    .replace(/[.!?]+$/u, "")
    .trim();

  if (/^(?:pause|pause (?:the )?(?:music|media))$/u.test(normalized)) {
    return { family: "media", operation: "pause" };
  }

  if (/^(?:play|play (?:the )?(?:music|media))$/u.test(normalized)) {
    return { family: "media", operation: "play" };
  }

  if (/^(?:next|next (?:track|song)|skip)$/u.test(normalized)) {
    return { family: "media", operation: "next" };
  }

  if (/^(?:previous|previous (?:track|song))$/u.test(normalized)) {
    return { family: "media", operation: "previous" };
  }

  const workspaceMatch = /^(?:workspace|switch to workspace|switch workspace|go to workspace)\s+([1-9][0-9]?)$/u.exec(normalized);

  if (workspaceMatch !== null) {
    const workspace = Number(workspaceMatch[1]);

    if (workspace >= 1 && workspace <= 99) {
      return {
        family: "workspace",
        operation: "focus",
        workspace
      };
    }
  }

  const openMatch = /^(?:open|launch|start)\s+(.+)$/iu.exec(input);

  if (openMatch !== null) {
    const query = openMatch[1]?.trim();

    if (
      query !== undefined &&
      query.length > 0 &&
      query.length <= 128 &&
      !looksLikeWebTarget(query)
    ) {
      return {
        family: "app",
        operation: "open",
        query
      };
    }
  }

  return undefined;
}
