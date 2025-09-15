import type ts from "typescript";
import { analyze, type AnalyzeContext } from "./analyze";
import { collect, type CollectContext } from "./collect";
import { defaultToSourceRange } from "./utils";
import type { Rule } from "../rules/types";
import type { ToSourceRange } from "./types";

export interface CreateAnalyzerOptions {
    rules: Rule[];
}

export interface CollectOptions {
    typescript: typeof import("typescript");
    toSourceRange?: ToSourceRange;
}

export interface AnalyzeOptions {
    typescript: typeof import("typescript");
    languageService: ts.LanguageService;
    toSourceRange?: ToSourceRange;
}

export type Analyzer = ReturnType<typeof createAnalyzer>;

export function createAnalyzer(options: CreateAnalyzerOptions) {
    const { rules } = options;
    const cache: WeakMap<ts.SourceFile, ReturnType<typeof collect>> = new WeakMap();

    return {
        collect(sourceFile: ts.SourceFile, options: CollectOptions) {
            if (!cache.has(sourceFile)) {
                const context: CollectContext = {
                    rules,
                    toSourceRange: defaultToSourceRange,
                    ...options,
                };
                cache.set(sourceFile, collect(context, sourceFile));
            }
            return cache.get(sourceFile)!;
        },
        analyze(sourceFile: ts.SourceFile, position: number, options: AnalyzeOptions) {
            const context: AnalyzeContext = {
                toSourceRange: defaultToSourceRange,
                ...options,
                ...this.collect(sourceFile, options),
            };
            return analyze(sourceFile, position, context);
        },
    };
}
