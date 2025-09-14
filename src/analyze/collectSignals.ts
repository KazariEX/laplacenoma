import type ts from "typescript";
import { defaultToSourceRange } from "../utils";
import type { Rule, SignalSchema, TriggerType } from "../rules/types";
import type { AnalyzeOptions } from "./index";
import type { ReactiveNode } from "./types";

export function collectSignals(
    context: AnalyzeOptions,
    sourceFile: ts.SourceFile,
) {
    const { typescript: ts, rules, toSourceRange = defaultToSourceRange } = context;

    const signals: ReactiveNode[] = [];
    const resolved = new Set<ts.Node>();
    visit(sourceFile);

    return signals;

    function visit(node: ts.Node) {
        if (ts.isVariableDeclaration(node)) {
            const { name, initializer } = node;
            if (initializer) {
                if (ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression)) {
                    for (const rule of rules) {
                        const succeeded = executeRule(rule, initializer, name);
                        if (succeeded) {
                            resolved.add(initializer);
                            break;
                        }
                    }
                }
                else if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
                    const signal = createFunctionSignal(name, initializer.body, sourceFile);
                    if (signal) {
                        signals.push(signal);
                    }
                }
            }
        }
        else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && !resolved.has(node)) {
            for (const rule of rules) {
                const succeeded = executeRule(rule, node);
                if (succeeded) {
                    break;
                }
            }
        }
        else if (ts.isFunctionDeclaration(node) && node.name && node.body) {
            const signal = createFunctionSignal(node.name, node.body, sourceFile);
            if (signal) {
                signals.push(signal);
            }
        }
        node.forEachChild(visit);
    }

    function executeRule(
        rule: Rule,
        expression: ts.CallExpression,
        binding?: ts.BindingName,
    ) {
        const signalMatches: [schema: SignalSchema, node: ts.Node][] = [];
        const triggerMatches: [type: TriggerType, node: ts.Node][] = [];

        const name = (expression.expression as ts.Identifier).text;
        if (!isNameMatch(rule.name, name)) {
            return;
        }

        rule.resolve({
            binding,
            expression,
            typescript: ts,
            match(type, node, schema?) {
                if (type === "signal" && schema) {
                    signalMatches.push([schema as SignalSchema, node]);
                }
                else {
                    triggerMatches.push([type as TriggerType, node]);
                }
            },
        });

        const signal: ReactiveNode = {};
        for (const [type, node] of triggerMatches) {
            let ast = node;
            let requireAccess = false;
            if (ts.isFunctionLike(node) && "body" in node && node.body) {
                ast = node.body;
                requireAccess = true;
            }
            const bodyNode = createTsNode(ast, sourceFile);
            if (!bodyNode) {
                continue;
            }
            if (type === "accessor" || type === "effect" && requireAccess) {
                signal.accessor = {
                    ...bodyNode,
                    requireAccess,
                };
            }
            if (type === "callback" || type === "effect") {
                signal.isDependent = true;
                signal.callback = {
                    ...bodyNode,
                };
            }
        }

        if (signalMatches.length) {
            for (const [schema, node] of signalMatches) {
                const bindingNode = createTsNode(node, sourceFile);
                if (!bindingNode) {
                    continue;
                }
                const cosignal: ReactiveNode = { ...signal };
                cosignal.isDependency = true;
                cosignal.binding = {
                    ...bindingNode,
                    accessTypes: schema.accessTypes,
                };
                signals.push(cosignal);
            }
        }
        else {
            signals.push(signal);
        }

        return true;
    }

    function createFunctionSignal(
        name: ts.BindingName,
        body: ts.Block | ts.Expression,
        sourceFile: ts.SourceFile,
    ): ReactiveNode | undefined {
        const nameNode = createTsNode(name, sourceFile);
        const bodyNode = createTsNode(body, sourceFile);
        if (nameNode && bodyNode) {
            return {
                binding: {
                    ...nameNode,
                    accessTypes: ["()"],
                },
                accessor: {
                    ...bodyNode,
                    requireAccess: true,
                },
                callback: bodyNode,
            };
        }
    }

    function createTsNode(
        node: ts.Node,
        sourceFile: ts.SourceFile,
    ) {
        const range = toSourceRange(node.getStart(sourceFile), node.end);
        if (range) {
            return { ...range, ast: node };
        }
    }
}

function isNameMatch(ruleName: string | RegExp, name: string) {
    return typeof ruleName === "string"
        ? ruleName === name
        : ruleName.test(name);
}
