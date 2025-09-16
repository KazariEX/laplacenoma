import type ts from "typescript";
import type { AccessType, Rule, TriggerType } from "../rules/types";
import type { CollectOptions } from "./index";
import type { ReactiveNode } from "./types";

export interface CollectContext extends Required<CollectOptions> {
    rules: Rule[];
}

export function collect(
    context: CollectContext,
    sourceFile: ts.SourceFile,
) {
    return {
        signals: collectSignals(context, sourceFile),
        ...collectAccesses(context, sourceFile),
    };
}

export function collectSignals(
    context: CollectContext,
    sourceFile: ts.SourceFile,
) {
    const { typescript: ts, rules, toSourceRange } = context;

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
                    const signal = createFunctionSignal(name, initializer.body);
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
            const signal = createFunctionSignal(node.name, node.body);
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
        const signalMatches: [node: ts.Node, accessTypes: AccessType[]][] = [];
        const triggerMatches: [node: ts.Node, type: TriggerType][] = [];

        const name = (expression.expression as ts.Identifier).text;
        if (!isNameMatch(rule.name, name)) {
            return;
        }

        rule.resolve({
            binding,
            expression,
            typescript: ts,
            match(type, node, data?) {
                if (type === "signal" && data) {
                    signalMatches.push([node, data as AccessType[]]);
                }
                else {
                    triggerMatches.push([node, type as TriggerType]);
                }
            },
        });

        const signal: ReactiveNode = {};
        for (const [node, type] of triggerMatches) {
            let ast = node;
            let requireAccess = false;
            if (ts.isFunctionLike(node) && "body" in node && node.body) {
                ast = node.body;
                requireAccess = true;
            }
            const bodyNode = createTsNode(ast);
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
            for (const [node, accessTypes] of signalMatches) {
                const bindingNode = createTsNode(node);
                if (!bindingNode) {
                    continue;
                }
                const cosignal: ReactiveNode = { ...signal };
                cosignal.isDependency = true;
                cosignal.binding = {
                    ...bindingNode,
                    accessTypes,
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
    ): ReactiveNode | undefined {
        const nameNode = createTsNode(name);
        const bodyNode = createTsNode(body);
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

    function createTsNode(node: ts.Node) {
        const range = toSourceRange(node.getStart(sourceFile), node.end);
        if (range) {
            return { ...range, ast: node };
        }
    }
}

export function collectAccesses(
    context: CollectContext,
    sourceFile: ts.SourceFile,
) {
    const { typescript: ts, toSourceRange } = context;

    const propertyAccesses = new Map<number, string>();
    const propertyCalls = new Map<number, string>();
    const functionCalls = new Set<number>();
    visit(sourceFile);

    return {
        propertyAccesses,
        propertyCalls,
        functionCalls,
    };

    function visit(node: ts.Node) {
        if (ts.isPropertyAccessExpression(node)) {
            const range = toSourceRange(node.expression.getStart(sourceFile), node.expression.end);
            if (range) {
                propertyAccesses.set(range.end, node.name.text);
            }
        }
        else if (ts.isElementAccessExpression(node)) {
            const range = toSourceRange(node.expression.getStart(sourceFile), node.expression.end);
            if (range) {
                const text = ts.isStringLiteralLike(node.argumentExpression)
                    ? node.argumentExpression.text
                    : "*";
                propertyAccesses.set(range.end, text);
            }
        }
        else if (ts.isCallExpression(node)) {
            const { expression } = node;
            if (ts.isPropertyAccessExpression(expression)) {
                const range = toSourceRange(
                    expression.expression.getStart(sourceFile),
                    expression.expression.end,
                );
                if (range) {
                    propertyCalls.set(range.end, expression.name.text);
                }
            }
            else if (ts.isIdentifier(expression)) {
                const range = toSourceRange(expression.getStart(sourceFile), expression.end);
                if (range) {
                    functionCalls.add(range.end);
                }
            }
        }
        node.forEachChild(visit);
    }
}

function isNameMatch(ruleName: string | RegExp, name: string) {
    return typeof ruleName === "string"
        ? ruleName === name
        : ruleName.test(name);
}
