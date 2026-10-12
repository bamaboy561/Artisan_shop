import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute source with explicit dependency stubs, never a live database.
export function loadAction(path, stubs) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const loaded = { exports: {} };
  const requireStub = (id) => {
    if (!Object.hasOwn(stubs, id))
      throw new Error(`Unstubbed dependency: ${id}`);
    return stubs[id];
  };
  new Function("require", "module", "exports", outputText)(
    requireStub,
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
