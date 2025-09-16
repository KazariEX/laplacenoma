import type ts from "typescript";

export interface Rule {
    name: string | RegExp;
    resolve: (context: ResolveContext) => void;
}

export interface ResolveContext {
    binding: ts.BindingName | undefined;
    expression: ts.CallExpression;
    typescript: typeof ts;
    match: {
        (type: "signal", node: ts.Node, accessTypes: AccessType[]): void;
        (type: TriggerType, node: ts.Node): void;
    };
}

export type AccessType = `.${string}` | "()" | `.${string}()`;

export type TriggerType = "accessor" | "callback" | "effect";
