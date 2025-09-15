import type ts from "typescript";
import type { collect } from "./collect";
import type { AnalyzeOptions } from "./index";
import type { ReactiveNode, TSNode } from "./types";

export interface AnalyzeContext extends Required<AnalyzeOptions>, ReturnType<typeof collect> {}

export function analyze(sourceFile: ts.SourceFile, position: number, context: AnalyzeContext) {
    const {
        typescript: ts,
        languageService,
        toSourceRange,
        signals,
        propertyAccesses,
        propertyCalls,
        functionCalls,
    } = context;

    const signal = findSignalByBindingRange(position) ?? findSignalByCallbackRange(position);
    if (!signal) {
        return;
    }

    const dependencies = findDependencies(signal);
    const dependents = findDependents(signal);

    if (
        (!signal.isDependency && !dependencies.length) ||
        (!signal.isDependent && !dependents.length)
    ) {
        return;
    }

    const dependencyRanges: ts.TextRange[] = [];
    const dependentRanges: ts.TextRange[] = [];

    for (const dependency of dependencies) {
        if (ts.isBlock(dependency.ast) && dependency.ast.statements.length) {
            const { statements } = dependency.ast;
            const sourceRange = toSourceRange(statements[0].getStart(sourceFile), statements.at(-1)!.end);
            if (sourceRange) {
                dependencyRanges.push(sourceRange);
            }
        }
        else {
            dependencyRanges.push({
                pos: dependency.pos,
                end: dependency.end,
            });
        }
    }
    for (const { callback } of dependents) {
        if (!callback) {
            continue;
        }
        if (ts.isBlock(callback.ast) && callback.ast.statements.length) {
            const { statements } = callback.ast;
            const sourceRange = toSourceRange(statements[0].getStart(sourceFile), statements.at(-1)!.end);
            if (sourceRange) {
                dependentRanges.push(sourceRange);
            }
        }
        else {
            dependentRanges.push({
                pos: callback.pos,
                end: callback.end,
            });
        }
    }

    return {
        dependencies,
        dependents,
    };

    function findDependencies(signal: ReactiveNode, visited = new Set<ReactiveNode>()) {
        if (visited.has(signal)) {
            return [];
        }
        visited.add(signal);

        const nodes: TSNode[] = [];
        let hasDependency = signal.isDependency;

        if (signal.accessor) {
            const { requireAccess } = signal.accessor;
            visit(signal.accessor, requireAccess);
            signal.accessor.ast.forEachChild((child) => {
                const childNode = createTsNode(child);
                if (childNode) {
                    visit(childNode, requireAccess);
                }
            });
        }

        if (!hasDependency) {
            return [];
        }
        return nodes;

        function visit(node: TSNode, requireAccess?: boolean, parentIsPropertyAccess = false) {
            if (!requireAccess) {
                if (!parentIsPropertyAccess && ts.isIdentifier(node.ast)) {
                    const definition = languageService.getDefinitionAtPosition(sourceFile.fileName, node.pos) ?? [];
                    for (const info of definition) {
                        if (info.fileName !== sourceFile.fileName) {
                            continue;
                        }
                        const signal = findSignalByBindingRange(info.textSpan.start);
                        if (!signal) {
                            continue;
                        }
                        if (signal.binding) {
                            nodes.push(signal.binding);
                            hasDependency ||= signal.isDependency;
                        }
                        if (signal.callback) {
                            nodes.push(signal.callback);
                        }
                        const deps = findDependencies(signal, visited);
                        nodes.push(...deps);
                        hasDependency ||= deps.length > 0;
                    }
                }
            }
            else if (
                ts.isPropertyAccessExpression(node.ast)
                || ts.isElementAccessExpression(node.ast)
                || ts.isCallExpression(node.ast)
            ) {
                const definition = languageService.getDefinitionAtPosition(sourceFile.fileName, node.pos) ?? [];
                for (const info of definition) {
                    if (info.fileName !== sourceFile.fileName) {
                        continue;
                    }
                    const signal = findSignalByBindingRange(info.textSpan.start);
                    if (!signal) {
                        continue;
                    }
                    const oldSize = nodes.length;
                    for (const accessType of signal.binding?.accessTypes ?? []) {
                        if (ts.isPropertyAccessExpression(node.ast)) {
                            if (
                                accessType === ".*" && node.ast.name.text !== ""
                                || accessType === "." + node.ast.name.text
                            ) {
                                nodes.push(signal.binding!);
                                hasDependency ||= signal.isDependency;
                            }
                        }
                        else if (ts.isElementAccessExpression(node.ast)) {
                            if (accessType === ".*") {
                                nodes.push(signal.binding!);
                                hasDependency ||= signal.isDependency;
                            }
                        }
                        else if (ts.isCallExpression(node.ast)) {
                            if (accessType.endsWith("()")) {
                                nodes.push(signal.binding!);
                                hasDependency ||= signal.isDependency;
                            }
                        }
                    }
                    if (nodes.length > oldSize) {
                        if (signal.callback) {
                            nodes.push(signal.callback);
                        }
                        const deps = findDependencies(signal, visited);
                        nodes.push(...deps);
                        hasDependency ||= deps.length > 0;
                    }
                }
            }
            node.ast.forEachChild((child) => {
                const childNode = createTsNode(child);
                if (childNode) {
                    visit(
                        childNode,
                        requireAccess,
                        ts.isPropertyAccessExpression(node.ast) || ts.isElementAccessExpression(node.ast),
                    );
                }
            });
        }
    }

    function findDependents(signal: ReactiveNode, visited = new Set<ReactiveNode>()) {
        if (!signal.binding) {
            return [];
        }

        if (visited.has(signal)) {
            return [];
        }
        visited.add(signal);

        const references = languageService.findReferences(sourceFile.fileName, signal.binding.pos);
        if (!references) {
            return [];
        }

        const result: ReactiveNode[] = [];
        for (const entry of references.flatMap((symbol) => symbol.references)) {
            if (entry.fileName !== sourceFile.fileName) {
                continue;
            }
            const effect = findSignalByAccessorRange(entry.textSpan.start);
            if (effect?.accessor) {
                let match = false;
                if (effect.accessor.requireAccess) {
                    for (const accessType of signal.binding.accessTypes) {
                        if (accessType === ".*") {
                            match ||= propertyAccesses.has(entry.textSpan.start + entry.textSpan.length);
                        }
                        else if (accessType === "()") {
                            match ||= functionCalls.has(entry.textSpan.start + entry.textSpan.length);
                        }
                        else if (accessType.endsWith("()")) {
                            const property = propertyCalls.get(entry.textSpan.start + entry.textSpan.length);
                            match ||= "." + property + "()" === accessType;
                        }
                        else {
                            const property = propertyAccesses.get(entry.textSpan.start + entry.textSpan.length);
                            match ||= "." + property === accessType;
                        }
                    }
                }
                else {
                    match = true;
                }
                if (match) {
                    const dependents = findDependents(effect, visited);
                    result.push(...dependents);
                    if (effect.isDependent || dependents.length) {
                        result.push(effect);
                    }
                }
            }
        }
        return result;
    }

    function findSignalByBindingRange(position: number): ReactiveNode | undefined {
        return signals.find((ref) => ref.binding && ref.binding.pos <= position && ref.binding.end >= position);
    }

    function findSignalByCallbackRange(position: number): ReactiveNode | undefined {
        return signals
            .filter((ref) => ref.callback && ref.callback.pos <= position && ref.callback.end >= position)
            .sort((a, b) => (a.callback!.end - a.callback!.pos) - (b.callback!.end - b.callback!.pos))[0];
    }

    function findSignalByAccessorRange(position: number): ReactiveNode | undefined {
        return signals
            .filter((ref) => ref.accessor && ref.accessor.pos <= position && ref.accessor.end >= position)
            .sort((a, b) => (a.accessor!.end - a.accessor!.pos) - (b.accessor!.end - b.accessor!.pos))[0];
    }

    function createTsNode(node: ts.Node) {
        const range = toSourceRange(node.getStart(sourceFile), node.end);
        if (range) {
            return { ...range, ast: node };
        }
    }
}
