import { describe, expect, it } from "vitest";
import { createAnalysisUtils } from "../../../test/utils";
import rules from "./index";

const { collect, expectAnalysis } = createAnalysisUtils("vue", rules);

describe("collect", () => {
    it("ref", () => {
        const { signals } = collect(/* TS */`
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
        const { signals } = collect(/* TS */`
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
        const { signals } = collect(/* TS */`
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
        const { signals } = collect(/* TS */`
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
        const { signals } = collect(/* TS */`
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
        const { signals } = collect(/* TS */`
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
        const { signals } = collect(/* TS */`
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

describe("analyze", () => {
    it("dependents of ref", () => {
        expectAnalysis(/* TS */`
            const count| = ref(0);
            const doubleCount = computed(() => count.value * 2);
            //                                 #^^^^^^^^^^^^^^
            watchEffect(() => {
                console.log(count.value);
            //  #^^^^^^^^^^^^^^^^^^^^^^^^
            });
            watch(count, (newVal, oldVal) => {
                console.log({ newVal, oldVal });
            //  #^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            });
        `);
    });

    it("dependents of reactive", () => {
        expectAnalysis(/* TS */`
            const state| = reactive({ count: 0 });
            const doubleCount = computed(() => state.count * 2);
            //                                 #^^^^^^^^^^^^^^
            watchEffect(() => {
                console.log(state.count);
            //  #^^^^^^^^^^^^^^^^^^^^^^^^
            });
        `);
    });

    it("dependents of toRefs", () => {
        expectAnalysis(/* TS */`
            const { count| } = toRefs(state);
            const doubleCount = computed(() => count.value * 2);
            //                                 #^^^^^^^^^^^^^^
            watchEffect(() => {
                console.log(count.value);
            //  #^^^^^^^^^^^^^^^^^^^^^^^^
            });
        `);
    });

    it("dependencies of computed", () => {
        expectAnalysis(/* TS */`
            const foo = ref(0);
            //    $^^
            const bar = reactive({ count: 0 });
            //    $^^
            const baz| = computed(() => {
                return foo.value + bar.count;
            });
        `);
    });

    it("dependencies of watchEffect", () => {
        expectAnalysis(/* TS */`
            const foo = ref(0);
            //    $^^
            const bar = reactive({ count: 0 });
            //    $^^
            watchEffect(() => {
                console.log(foo.value, bar.count);|
            });
        `);
    });

    it("dependencies of watch", () => {
        expectAnalysis(/* TS */`
            const foo = ref(0);
            //    $^^
            const bar = reactive({ count: 0 });
            //    $^^
            watch([foo, () => bar.count], (val) => {
                console.log(val);|
            });
        `);
    });
});
