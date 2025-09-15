import ts from "typescript";
import { describe, expect, it } from "vitest";
import { type CollectContext, collectSignals } from "../../src/core/collect";
import { defaultToSourceRange } from "../../src/core/utils";
import rulesVue from "../../src/rules/vue";

describe("rules/vue", () => {
    const context: CollectContext = {
        typescript: ts,
        rules: rulesVue,
        toSourceRange: defaultToSourceRange,
    };

    function collect(text: string) {
        const sourceFile = ts.createSourceFile("vue.ts", text, ts.ScriptTarget.ESNext);
        return collectSignals(context, sourceFile);
    }

    it("ref", () => {
        const signals = collect(`
            const count = ref(0);
        `);

        expect(signals).toMatchInlineSnapshot(`
          [
            {
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 24,
                "pos": 19,
              },
              "isDependency": true,
            },
          ]
        `);
    });

    it("reactive", () => {
        const signals = collect(`
            const state = reactive({ count: 0 });
        `);

        expect(signals).toMatchInlineSnapshot(`
          [
            {
              "binding": {
                "accessTypes": [
                  ".*",
                ],
                "end": 24,
                "pos": 19,
              },
              "isDependency": true,
            },
          ]
        `);
    });

    it("toRefs", () => {
        const signals = collect(`
            const { count, name } = toRefs(state);
        `);

        expect(signals).toMatchInlineSnapshot(`
          [
            {
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 26,
                "pos": 21,
              },
              "isDependency": true,
            },
            {
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 32,
                "pos": 28,
              },
              "isDependency": true,
            },
          ]
        `);
    });

    it("computed", () => {
        const signals = collect(`
            const doubleCount = computed(() => count.value * 2);
        `);

        expect(signals).toMatchInlineSnapshot(`
          [
            {
              "accessor": {
                "end": 63,
                "pos": 48,
                "requireAccess": true,
              },
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 30,
                "pos": 19,
              },
              "callback": {
                "end": 63,
                "pos": 48,
              },
              "isDependency": true,
              "isDependent": true,
            },
          ]
        `);
    });

    it("computed w/ get()", () => {
        const signals = collect(`
            const doubleCount = computed({
                get: () => count.value * 2,
                set: (val) => (count.value = val / 2),
            });
        `);

        expect(signals).toMatchInlineSnapshot(`
          [
            {
              "accessor": {
                "end": 86,
                "pos": 71,
                "requireAccess": true,
              },
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 30,
                "pos": 19,
              },
              "callback": {
                "end": 86,
                "pos": 71,
              },
              "isDependency": true,
              "isDependent": true,
            },
          ]
        `);
    });

    it("watchEffect", () => {
        const signals = collect(`
            watchEffect(() => {
                console.log(count.value);
            });
        `);

        expect(signals).toMatchInlineSnapshot(`
          [
            {
              "accessor": {
                "end": 88,
                "pos": 31,
                "requireAccess": true,
              },
              "callback": {
                "end": 88,
                "pos": 31,
              },
              "isDependent": true,
            },
          ]
        `);
    });

    it("watch", () => {
        const signals = collect(`
            watch(count, (newVal, oldVal) => {
                console.log({ newVal, oldVal });
            });
        `);

        expect(signals).toMatchInlineSnapshot(`
          [
            {
              "accessor": {
                "end": 24,
                "pos": 19,
                "requireAccess": false,
              },
              "callback": {
                "end": 110,
                "pos": 46,
              },
              "isDependent": true,
            },
          ]
        `);
    });
});
