import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "./src/index.ts",
        "rules/vue": "./src/rules/vue/index.ts",
    },
    format: [
        "cjs",
        "esm",
    ],
    exports: true,
});
