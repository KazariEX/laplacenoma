import type { ToSourceRange } from "./types";

export const defaultToSourceRange: ToSourceRange = (pos, end) => ({ pos, end });
