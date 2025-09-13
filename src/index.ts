import { analyze } from "./analyze";
import type { Rule } from "./rules/types";

export interface CreateAnalyzerOptions {
    typescript: typeof import("typescript");
    rules: Rule[];
}

export function createAnalyzer(options: CreateAnalyzerOptions) {
    return {
        analyze: analyze.bind(null, options),
    };
}
