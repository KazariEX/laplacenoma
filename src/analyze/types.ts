import type ts from "typescript";
import type { AccessType } from "../rules/types";

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
        accessTypes: AccessType[];
    };
    accessor?: TSNode & {
        requireAccess?: boolean;
    };
    callback?: TSNode;
}
