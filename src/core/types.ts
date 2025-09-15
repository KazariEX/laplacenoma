import type ts from "typescript";
import type { AccessType } from "../rules/types";

export interface TSNode extends ts.TextRange {
    ast: ts.Node;
}

export interface ReactiveNode {
    isDependency?: boolean;
    isDependent?: boolean;
    binding?: TSNode & {
        accessTypes: AccessType[];
    };
    accessor?: TSNode & {
        requireAccess?: boolean;
    };
    callback?: TSNode;
}

export interface ToSourceRange {
    (pos: number, end: number): ts.TextRange | undefined;
}
