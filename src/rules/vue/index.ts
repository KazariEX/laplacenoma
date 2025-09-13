import { defineRules } from "../index";

export default defineRules([
    {
        name: /^(?:ref|customRef|shallowRef|toRef|useTemplateRef|defineModel)$/,
        binding: {
            accessTypes: [
                ".value",
            ],
        },
    },
    {
        name: /^(?:reactive|shallowReactive|defineProps|withDefaults)$/,
        binding: {
            accessTypes: [
                ".*",
            ],
        },
    },
    {
        name: "toRefs",
        bindings: {
            $any: {
                accessTypes: [
                    ".value",
                ],
            },
        },
    },
    {
        name: "computed",
        binding: {
            accessTypes: [
                ".value",
            ],
        },
        arguments: [
            {
                $or: [
                    {
                        $properties: {
                            get: {
                                type: "effect",
                            },
                        },
                    },
                    {
                        type: "effect",
                    },
                ],
            },
        ],
    },
    {
        name: /^(?:effect|watchEffect)$/,
        arguments: [
            {
                type: "effect",
            },
        ],
    },
    {
        name: "watch",
        arguments: [
            {
                type: "accessor",
            },
            {
                type: "callback",
            },
        ],
    },
]);
