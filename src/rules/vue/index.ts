import { defineRules } from "../index";

export default defineRules([
    {
        name: /^(?:ref|customRef|shallowRef|toRef|useTemplateRef|defineModel)$/,
        resolve({ binding, typescript: ts, match }) {
            if (binding && ts.isIdentifier(binding)) {
                match("signal", binding, {
                    accessTypes: [
                        ".value",
                    ],
                });
            }
        },
    },
    {
        name: /^(?:reactive|shallowReactive|defineProps|withDefaults)$/,
        resolve({ binding, typescript: ts, match }) {
            if (binding && ts.isIdentifier(binding)) {
                match("signal", binding, {
                    accessTypes: [
                        ".*",
                    ],
                });
            }
        },
    },
    {
        name: "toRefs",
        resolve({ binding, typescript: ts, match }) {
            if (binding && ts.isObjectBindingPattern(binding)) {
                for (const element of binding.elements) {
                    if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                        match("signal", element, {
                            accessTypes: [
                                ".value",
                            ],
                        });
                    }
                }
            }
        },
    },
    {
        name: "computed",
        resolve({ binding, expression, typescript: ts, match }) {
            if (binding && ts.isIdentifier(binding)) {
                match("signal", binding, {
                    accessTypes: [
                        ".value",
                    ],
                });
            }
            if (expression.arguments.length) {
                const arg0 = expression.arguments[0];
                if (ts.isObjectLiteralExpression(arg0)) {
                    const getProp = arg0.properties.find(
                        (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "get",
                    );
                    if (getProp && ts.isPropertyAssignment(getProp)) {
                        match("effect", getProp.initializer);
                    }
                }
                else {
                    match("effect", arg0);
                }
            }
        },
    },
    {
        name: /^(?:effect|watchEffect)$/,
        resolve: ({ expression, match }) => {
            if (expression.arguments.length) {
                const arg0 = expression.arguments[0];
                match("effect", arg0);
            }
        },
    },
    {
        name: "watch",
        resolve: ({ expression, match }) => {
            const [arg0, arg1] = expression.arguments;
            if (arg0) {
                match("accessor", arg0);
            }
            if (arg1) {
                match("callback", arg1);
            }
        },
    },
]);
