import type ts from "typescript";
import { defineRules } from "../index";
import type { AccessType, ResolveContext } from "../types";

export default defineRules([
    {
        name: /^(?:ref(?:[A-Z].*)?|createRef|customRef|extendRef|shallowRef|toRef|useTemplateRef|defineModel)$/,
        resolve(context) {
            resolveBinding(context, [".value"]);
        },
    },
    {
        name: /^(?:reactive(?:[A-Z].*)?|shallowReactive|toReactive|defineProps|withDefaults)$/,
        resolve(context) {
            resolveBinding(context, [".*"]);
        },
    },
    {
        name: /^(?:toRefs|storeToRefs)$/,
        resolve(context) {
            resolveBindingElements(context, [".value"]);
        },
    },
    {
        name: "computedWithControl",
        resolve(context) {
            resolveBinding(context, [".value"]);
            const [arg0, arg1] = context.expression.arguments;
            if (arg0) {
                context.match("accessor", arg0);
            }
            if (arg1) {
                resolveComputedGetter(context, arg1);
            }
        },
    },
    {
        name: /^computed(?:[A-Z].*)?$/,
        resolve(context) {
            resolveBinding(context, [".value"]);
            const [arg0] = context.expression.arguments;
            if (arg0) {
                resolveComputedGetter(context, arg0);
            }
        },
    },
    {
        name: /^(?:effect|watchEffect)$/,
        resolve({ expression, match }) {
            const [arg0] = expression.arguments;
            if (arg0) {
                match("effect", arg0);
            }
        },
    },
    {
        name: /^(?:watch(?:[A-Z].*)?|whenever)$/,
        resolve({ expression, match }) {
            const [arg0, arg1] = expression.arguments;
            if (arg0) {
                match("accessor", arg0);
            }
            if (arg1) {
                match("callback", arg1);
            }
        },
    },
    {
        name: /^use[A-Z].*$/,
        resolve(context) {
            resolveBinding(context, [".*"]);
            resolveBindingElements(context, [".value"]);
        },
    },
]);

function resolveBinding(
    context: ResolveContext,
    accessTypes: AccessType[],
) {
    const { binding, typescript: ts, match } = context;
    if (binding && ts.isIdentifier(binding)) {
        match("signal", binding, accessTypes);
    }
}

function resolveBindingElements(
    context: ResolveContext,
    accessTypes: AccessType[],
) {
    const { binding, typescript: ts, match } = context;
    if (binding && ts.isObjectBindingPattern(binding)) {
        for (const element of binding.elements) {
            if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                match("signal", element, accessTypes);
            }
        }
    }
}

function resolveComputedGetter(context: ResolveContext, node: ts.Expression) {
    const { typescript: ts, match } = context;
    if (ts.isObjectLiteralExpression(node)) {
        for (const prop of node.properties) {
            if (ts.isPropertyAssignment(prop)) {
                if (ts.isIdentifier(prop.name) && prop.name.text === "get") {
                    match("effect", prop.initializer);
                    break;
                }
            }
            else if (ts.isMethodDeclaration(prop)) {
                if (ts.isIdentifier(prop.name) && prop.name.text === "get") {
                    match("effect", prop);
                    break;
                }
            }
        }
    }
    else {
        match("effect", node);
    }
}
