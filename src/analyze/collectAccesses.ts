import type ts from "typescript";
import { defaultToSourceRange } from "../utils";
import type { AnalyzeOptions } from "./index";

export function collectAccesses(
    context: AnalyzeOptions,
    sourceFile: ts.SourceFile,
) {
    const { typescript: ts, toSourceRange = defaultToSourceRange } = context;

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
