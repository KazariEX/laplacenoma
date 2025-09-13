import { expect } from "vitest";

expect.addSnapshotSerializer({
    test: (val) => val && typeof val === "object" && "ast" in val,
    print: (val, serialize) => {
        const { ast, ...rest } = val as any;
        return serialize({ ...rest });
    },
});
