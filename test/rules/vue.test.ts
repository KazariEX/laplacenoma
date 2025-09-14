import ts from "typescript";
import { describe, expect, it } from "vitest";
import { collectSignals } from "../../src/analyze/collectSignals";
import rulesVue from "../../src/rules/vue";
import type { AnalyzeOptions } from "../../src/analyze";

describe("rules/vue", () => {
    const options: AnalyzeOptions = {
        typescript: ts,
        rules: rulesVue,
    };

    function collect(text: string) {
        const sourceFile = ts.createSourceFile("vue.ts", text, ts.ScriptTarget.ESNext);
        return collectSignals(options, sourceFile);
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
                "start": 19,
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
                "start": 19,
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
                "start": 21,
              },
              "isDependency": true,
            },
            {
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 32,
                "start": 28,
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
                "requireAccess": true,
                "start": 48,
              },
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 30,
                "start": 19,
              },
              "callback": {
                "end": 63,
                "start": 48,
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
                "requireAccess": true,
                "start": 71,
              },
              "binding": {
                "accessTypes": [
                  ".value",
                ],
                "end": 30,
                "start": 19,
              },
              "callback": {
                "end": 86,
                "start": 71,
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
                "requireAccess": true,
                "start": 31,
              },
              "callback": {
                "end": 88,
                "start": 31,
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
                "requireAccess": false,
                "start": 19,
              },
              "callback": {
                "end": 110,
                "start": 46,
              },
              "isDependent": true,
            },
          ]
        `);
    });
});
