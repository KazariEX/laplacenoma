import type ts from "typescript";
import type { AccessTypeSchema } from "./rules/types";

export interface TextRange {
    start: number;
    end: number;
}

export interface TSNode extends TextRange {
    ast: ts.Node;
}

export interface ReactiveNode {
    isDependency?: boolean;
    isDependent?: boolean;
    binding?: TSNode & {
        accessTypes: AccessTypeSchema[];
    };
    accessor?: TSNode & {
        requireAccess?: boolean;
    };
    callback?: TSNode;
}
