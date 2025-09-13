import type ts from "typescript";
import { createTsNode } from "./utils";
import type { CreateAnalyzerOptions } from "./index";
import type { ArgumentSchema, ArraySchema, BindingElementSchema, BindingSchema, Rule, SchemaRaw } from "./rules/types";
import type { ReactiveNode } from "./types";

export function analyze(
    context: CreateAnalyzerOptions,
    sourceFile: ts.SourceFile,
) {
    const { typescript: ts, rules } = context;

    const signals: ReactiveNode[] = [];
    collectSignals(sourceFile);
    return signals;

    function collectSignals(node: ts.Node) {
        if (ts.isVariableDeclaration(node)) {
            const { name, initializer } = node;
            if (initializer) {
                if (ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression)) {
                    for (const rule of rules) {
                        const succeeded = executeRule(rule, initializer, name);
                        if (succeeded) {
                            break;
                        }
                    }
                }
                else if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
                    const signal = createFunctionSignal(name, initializer.body, sourceFile);
                    signals.push(signal);
                }
            }
        }
        else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
            for (const rule of rules) {
                const succeeded = executeRule(rule, node);
                if (succeeded) {
                    break;
                }
            }
        }
        else if (ts.isFunctionDeclaration(node) && node.name && node.body) {
            const signal = createFunctionSignal(node.name, node.body, sourceFile);
            signals.push(signal);
        }
        node.forEachChild(collectSignals);
    }

    function executeRule(
        rule: Rule,
        expression: ts.CallExpression,
        binding?: ts.BindingName,
    ) {
        const bindingMatches: [schema: SchemaRaw<BindingSchema>, node: ts.Node][] = [];
        const argumentMatches: [schema: SchemaRaw<ArgumentSchema>, node: ts.Node][] = [];

        const name = (expression.expression as ts.Identifier).text;
        if (!isNameMatch(rule.name, name)) {
            return;
        }

        if (rule.binding) {
            if (!binding || !ts.isIdentifier(binding)) {
                return;
            }
            executeBindingSchema(ts, rule.binding, binding, bindingMatches);
        }
        else if (rule.bindings) {
            if (!binding || !ts.isObjectBindingPattern(binding)) {
                return;
            }
            for (let i = 0; i < binding.elements.length; i++) {
                const element = binding.elements[i];
                const name = element.propertyName ?? element.name;
                if (!ts.isIdentifier(name)) {
                    continue;
                }
                executeBindingElementSchema(ts, rule.bindings, element, bindingMatches);
            }
        }

        if (rule.arguments) {
            const { length } = "$any" in rule.arguments ? expression.arguments : rule.arguments;
            for (let i = 0; i < length; i++) {
                const schema = "$any" in rule.arguments ? rule.arguments.$any : rule.arguments[i];
                const arg = expression.arguments[i];
                if (!schema) {
                    return;
                }
                if (!arg) {
                    break;
                }
                const matched = isArgumentMatch(ts, schema, arg, argumentMatches);
                if (!matched) {
                    return;
                }
            }
        }

        const signal: ReactiveNode = {};
        for (const [schema, node] of argumentMatches) {
            let ast = node;
            let requireAccess = false;
            if (ts.isFunctionLike(node) && "body" in node && node.body) {
                ast = node.body;
                requireAccess = true;
            }
            const bodyNode = createTsNode(ast, sourceFile);

            if (schema.type === "accessor" || schema.type === "effect" && requireAccess) {
                signal.accessor = {
                    ...bodyNode,
                    requireAccess,
                };
            }
            if (schema.type === "callback" || schema.type === "effect") {
                signal.isDependent = true;
                signal.callback = {
                    ...bodyNode,
                };
            }
        }

        if (bindingMatches.length) {
            for (const [schema, node] of bindingMatches) {
                const cosignal: ReactiveNode = { ...signal };
                cosignal.isDependency = true;
                cosignal.binding = {
                    ...createTsNode(node, sourceFile),
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
}

function createFunctionSignal(
    name: ts.BindingName,
    body: ts.Block | ts.Expression,
    sourceFile: ts.SourceFile,
): ReactiveNode {
    const nameNode = createTsNode(name, sourceFile);
    const bodyNode = createTsNode(body, sourceFile);
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

function isNameMatch(ruleName: string | RegExp, name: string) {
    return typeof ruleName === "string"
        ? ruleName === name
        : ruleName.test(name);
}

function executeBindingSchema(
    ts: typeof import("typescript"),
    schema: BindingSchema,
    node: ts.Identifier,
    matches: [schema: SchemaRaw<BindingSchema>, node: ts.Node][],
) {
    if ("$or" in schema) {
        for (const sub of schema.$or) {
            executeBindingSchema(ts, sub, node, matches);
        }
        return;
    }
    else if ("$properties" in schema) {
        return;
    }
    matches.push([schema, node]);
}

function executeBindingElementSchema(
    ts: typeof import("typescript"),
    schemas: ArraySchema<BindingElementSchema>,
    node: ts.BindingElement,
    matches: [schema: SchemaRaw<BindingElementSchema>, node: ts.Node][],
) {
    if ("$any" in schemas) {
        matches.push([schemas.$any, node]);
        return;
    }
    for (const schema of schemas) {
        if ("$or" in schema) {
            executeBindingElementSchema(ts, schema.$or, node, matches);
        }
        else if ("$properties" in schema) {
            continue;
        }
        else if (schema.name) {
            const name = node.propertyName ?? node.name;
            if (ts.isIdentifier(name) && isNameMatch(schema.name, name.text)) {
                matches.push([schema, node]);
                return;
            }
        }
    }
}

function isArgumentMatch(
    ts: typeof import("typescript"),
    schema: ArgumentSchema,
    node: ts.Node,
    matches: [schema: SchemaRaw<ArgumentSchema>, node: ts.Node][],
): boolean {
    if ("$or" in schema) {
        return schema.$or.some((sub) => isArgumentMatch(ts, sub, node, matches));
    }
    if ("$properties" in schema) {
        if (!ts.isObjectLiteralExpression(node)) {
            return false;
        }
        return Object.entries(schema.$properties).every(([key, sub]) => {
            const property = node.properties.find((p) => {
                return p.name && ts.isIdentifier(p.name) && p.name.text === key;
            });
            const target = property && getPropertyTarget(ts, property);
            if (!target) {
                return false;
            }
            return isArgumentMatch(ts, sub, target, matches);
        });
    }
    matches.push([schema, node]);
    return true;
}

function getPropertyTarget(
    ts: typeof import("typescript"),
    node: ts.ObjectLiteralElementLike,
) {
    if (ts.isPropertyAssignment(node)) {
        return node.initializer;
    }
    if (ts.isShorthandPropertyAssignment(node)) {
        return node.name;
    }
    if ("body" in node && node.body) {
        return node.body;
    }
}
