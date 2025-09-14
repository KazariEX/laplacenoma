import type ts from "typescript";
import { collectAccesses } from "./collectAccesses";
import { collectSignals } from "./collectSignals";
import type { Rule } from "../rules/types";
import type { TextRange } from "./types";

export interface AnalyzeOptions {
    typescript: typeof import("typescript");
    rules: Rule[];
    toSourceRange?: (start: number, end: number) => TextRange | void;
}

export type AnalyzeReturns = ReturnType<typeof analyze>;

export function analyze(
    options: AnalyzeOptions,
    sourceFile: ts.SourceFile,
) {
    return {
        signals: collectSignals(options, sourceFile),
        ...collectAccesses(options, sourceFile),
    };
}
