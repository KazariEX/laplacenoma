import { resolve } from "node:path";
import { compilerOptions } from "@zinkawaii/tsconfig/tsconfig.json";
import ts from "typescript";

const { options } = ts.convertCompilerOptionsFromJson(compilerOptions, ".");
const snapshots: Map<string, ts.IScriptSnapshot> = new Map();
const versions: Map<string, number> = new Map();

export const languageService = ts.createLanguageService({
    getScriptFileNames: () => [...snapshots.keys()],
    getScriptVersion: (fileName) => (versions.get(fileName) ?? 0).toString(),
    getScriptSnapshot: (fileName) => snapshots.get(fileName),
    getCurrentDirectory: () => resolve(import.meta.dirname, "fixtures"),
    getCompilationSettings: () => options,
    getDefaultLibFileName: () => ts.getDefaultLibFilePath(options),
    fileExists: (fileName) => snapshots.has(fileName),
    readFile: (fileName) => {
        const snapshot = snapshots.get(fileName);
        return snapshot ? snapshot.getText(0, snapshot.getLength()) : "";
    },
});

export function createSourceFile(fileName: string, content: string) {
    updateFile(fileName, content);
    const program = languageService.getProgram()!;
    return program.getSourceFile(fileName)!;
}

function updateFile(fileName: string, content: string) {
    const version = (versions.get(fileName) ?? 0) + 1;
    versions.set(fileName, version);
    snapshots.set(fileName, ts.ScriptSnapshot.fromString(content));
}
