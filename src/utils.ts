import type ts from "typescript";
import type { TSNode } from "./types";

export function createTsNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
): TSNode {
    return {
        start: node.getStart(sourceFile),
        end: node.end,
        ast: node,
    };
}
