import ts from "typescript";
import { expect } from "vitest";
import { createAnalyzer } from "../src/index";
import { createSourceFile, languageService } from "./shared";
import type { Rule } from "../src/rules/types";

export function createAnalysisUtils(name: string, rules: Rule[]) {
    const analyzer = createAnalyzer({
        rules,
    });

    return {
        collect,
        expectAnalysis,
    };

    function collect(text: string) {
        const sourceFile = createSourceFile(`${name}.ts`, text);
        return analyzer.collect(sourceFile, {
            typescript: ts,
        });
    }

    function expectAnalysis(text: string) {
        const pos = text.indexOf("|");
        if (pos !== -1) {
            text = text.slice(0, pos) + text.slice(pos + 1);
        }

        const sourceFile = createSourceFile(`${name}.ts`, text);
        const analyzed = analyzer.analyze(sourceFile, pos, {
            typescript: ts,
            languageService,
        });

        expect(analyzed).toBeDefined();

        let length = 0;
        const lineCounts: number[] = [];
        for (const line of text.split("\n")) {
            lineCounts.push(length);
            length += line.length + 1;
        }

        const actual = {
            dependencies: stringifyRanges(analyzed!.dependencyRanges),
            dependents: stringifyRanges(analyzed!.dependentRanges),
        };

        const expected = {
            dependencies: stringifyRanges(getIndicatedRanges(text, lineCounts, /\$\^+/g)),
            dependents: stringifyRanges(getIndicatedRanges(text, lineCounts, /#\^+/g)),
        };

        expect(actual.dependencies).toEqual(expected.dependencies);
        expect(actual.dependents).toEqual(expected.dependents);
    }
}

function stringifyRanges(ranges: ts.TextRange[]) {
    return ranges
        .toSorted((a, b) => a.pos - b.pos)
        .map(({ pos, end }) => `${pos},${end}`)
        .join("|");
}

function getIndicatedRanges(text: string, lineCounts: number[], pattern: RegExp) {
    const ranges: ts.TextRange[] = [];
    for (const match of text.matchAll(pattern)) {
        const index = lineCounts.findIndex((count) => count > match.index!) - 1;
        const leadingCount = match.index! - lineCounts[index];
        const pos = lineCounts[index - 1] + leadingCount;
        const end = pos + match[0].length;
        ranges.push({ pos, end });
    }
    return ranges;
}
