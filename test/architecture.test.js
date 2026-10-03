// Guards the layering described in docs/ARCHITECTURE.md, so it can't erode
// silently: app -> features -> shared, never the other way round.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;

function sourceFiles(directory) {
  return readdirSync(join(root, directory), { recursive: true })
    .filter((file) => file.endsWith(".js"))
    .map((file) => join(directory, file));
}

function imports(file) {
  const source = readFileSync(join(root, file), "utf8");
  return [...source.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((match) => match[1]);
}

const resolveImport = (file, specifier) => relative(root, join(root, file, "..", specifier));

test("shared kernel does not depend on features or the app", () => {
  for (const file of sourceFiles("lib/shared")) {
    for (const specifier of imports(file)) {
      const target = resolveImport(file, specifier);
      assert.ok(!target.startsWith("lib/features") && !target.startsWith("lib/app"), `${file} imports ${specifier}`);
    }
  }
});

test("features never import another feature, the app, or undici", () => {
  for (const file of sourceFiles("lib/features").filter((file) => file !== "lib/features/index.js")) {
    const feature = file.split("/")[2];
    for (const specifier of imports(file)) {
      assert.notEqual(specifier, "undici", `${file} must use context.web instead of undici`);
      if (!specifier.startsWith(".")) continue;

      const target = resolveImport(file, specifier);
      assert.ok(!target.startsWith("lib/app"), `${file} imports the app layer`);
      if (target.startsWith("lib/features/")) {
        assert.equal(target.split("/")[2], feature, `${file} imports another feature: ${specifier}`);
      }
    }
  }
});

test("only the composition root reads environment variables", () => {
  for (const file of [...sourceFiles("lib/shared"), ...sourceFiles("lib/features")]) {
    assert.ok(!readFileSync(join(root, file), "utf8").includes("process.env"), `${file} reads process.env`);
  }
});
