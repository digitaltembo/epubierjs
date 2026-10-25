// Checks the built package as it would be published. Run after `npm run build`.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8" }));
const files = new Set(packed[0].files.map((file) => file.path));

// Every path package.json points at, from "main", "types", "exports" and so on
const targets = [
  pkg.main,
  pkg.module,
  pkg.types,
  pkg.unpkg,
  pkg.jsdelivr,
  ...Object.values(pkg.exports).flatMap((target) => (typeof target === "string" ? [target] : Object.values(target))),
].map((path) => path.replace(/^\.\//, ""));

test("every entry point is built and published", () => {
  for (const path of new Set(targets)) {
    assert.ok(existsSync(path), `${path} is missing; run npm run build`);
    if (path !== "package.json") assert.ok(files.has(path), `${path} isn't in the package`);
  }
});

test("the package leaves out the example", () => {
  assert.deepEqual([...files].filter((path) => path.startsWith("example/")), []);
});

test("built files carry the license banner for this version", () => {
  for (const path of ["dist/epubier.min.js", "dist/epubier.all.min.js", "dist/esm/index.js", "dist/comicarchive.worker.js"]) {
    const head = readFileSync(path, "utf8").slice(0, 200);
    assert.ok(head.startsWith(`/*! epubier ${pkg.version}\n`), `${path} has no banner for ${pkg.version}`);
    assert.match(head, /MIT License/);
  }
});

test("the ES modules parse", () => {
  for (const path of targets.filter((path) => path.startsWith("dist/esm/"))) {
    execFileSync(process.execPath, ["--check", path]);
  }
});

test("strings.json is valid JSON", () => {
  assert.equal(typeof JSON.parse(readFileSync("src/strings.json", "utf8")), "object");
});
