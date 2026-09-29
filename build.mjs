import * as esbuild from "esbuild";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

const common = {
  entryPoints: ["src/index.js"],
  bundle: true,
  target: ["es2020"],
  logLevel: "info",
  // Bundled packages' own "/*!" comments are dropped; the banner carries
  // every bundled package's full license instead, once each.
  legalComments: "none",
};

const builds = [
  // <script src="epubier.min.js"> defines a global `epubier` function and
  // contains everything it needs: epub.js, JSZip and their dependencies.
  {
    ...common,
    outfile: "dist/epubier.min.js",
    format: "iife",
    globalName: "epubier",
    footer: { js: "epubier = epubier.default;" },
    minify: true,
    sourcemap: true,
  },
  // For bundlers: `import epubier from "epubier"`. epubjs is a dependency
  // that the app's bundler resolves, so it isn't duplicated.
  {
    ...common,
    outfile: "dist/epubier.esm.js",
    format: "esm",
    external: ["epubjs"],
  },
];

// --- Licenses ---------------------------------------------------------------
//
// Every built file starts with epubier's license followed by the license of
// each package bundled into it. The list comes from esbuild's metafile, so it
// follows whatever the dependencies actually pull in.

// JSZip's prebuilt dist file (which epub.js imports) has these packages
// compiled into it, so they don't show up as separate inputs.
const EMBEDDED = { jszip: ["pako", "lie", "immediate", "setimmediate"] };

// Notes and license text adjustments for particular packages.
const NOTES = {
  jszip: {
    note: "JSZip is dual licensed under MIT or GPLv3. epubier uses it under the MIT license.",
    text: (text) => text.slice(0, text.indexOf("GPL version 3")),
  },
  pako: {
    note: "pako's zlib port carries this notice in addition to the MIT license below:",
    extra: `(C) 1995-2013 Jean-loup Gailly and Mark Adler
(C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
  claim that you wrote the original software. If you use this software
  in a product, an acknowledgment in the product documentation would be
  appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
  misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.`,
  },
  "path-webpack": {
    note: "Adapted from the Node.js path module, Copyright Joyent, Inc. and other Node contributors.",
  },
};

const MIT = (holder) => `Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

// "node_modules/a/node_modules/@b/c/lib/x.js" -> "node_modules/a/node_modules/@b/c"
function packageDir(input) {
  const match = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  return match && match[1];
}

function describe(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const file = readdirSync(dir).find((name) => /^(licen[sc]e|copying)(\.|$)/i.test(name));
  const { note, extra, text: adjust = (text) => text } = NOTES[pkg.name] || {};
  let text;
  if (file) {
    text = adjust(readFileSync(join(dir, file), "utf8"));
  } else if (pkg.license === "MIT") {
    // Declared MIT in package.json but shipped without a license file
    const author = typeof pkg.author === "object" ? pkg.author.name : pkg.author;
    text = MIT(author || `the ${pkg.name} authors`);
  } else {
    throw new Error(`No license file found for ${pkg.name} in ${dir}`);
  }
  const url = typeof pkg.repository === "object" ? pkg.repository.url : pkg.repository || pkg.homepage || "";
  return {
    name: pkg.name,
    heading: `${pkg.name} ${pkg.version} (${pkg.license})${url ? `\n${url.replace(/^git\+/, "")}` : ""}`,
    body: [note, extra, text.trim()].filter(Boolean).join("\n\n"),
  };
}

async function bundledPackages(options) {
  const { metafile } = await esbuild.build({ ...options, write: false, metafile: true, logLevel: "silent" });
  const dirs = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const dir = packageDir(input);
    if (!dir) continue;
    dirs.add(dir);
    const name = dir.slice(dir.lastIndexOf("node_modules/") + "node_modules/".length);
    for (const embedded of EMBEDDED[name] || []) {
      // Resolve the way Node would from the embedding package
      let from = dir;
      while (!existsSync(join(from, "node_modules", embedded)) && from !== ".") from = dirname(from);
      dirs.add(join(from, "node_modules", embedded));
    }
  }
  // epub.js first, as the main one; the rest alphabetically
  return [...dirs]
    .map(describe)
    .sort((a, b) => (b.name === "epubjs") - (a.name === "epubjs") || a.name.localeCompare(b.name));
}

function thirdPartyNotices(packages) {
  const rule = "-".repeat(80);
  const intro = `Third-party notices

epubier started from the epub.js "highlights" example. dist/epubier.min.js
contains the following packages, each distributed under the license below.
dist/epubier.esm.js contains none of them; it imports epub.js, which brings
the same packages.`;
  return [intro, ...packages.map((pkg) => `${rule}\n${pkg.heading}\n${rule}\n\n${pkg.body}`)].join("\n\n\n") + "\n";
}

const packages = await bundledPackages(builds[0]);
const notices = thirdPartyNotices(packages);
writeFileSync("THIRD_PARTY_LICENSES", notices);

// "/*!" comments survive minification
const banner = (licenses) =>
  `/*! epubier ${version}\n\n${licenses.join("\n\n").trim().replaceAll("*/", "* /")}\n*/`;
const license = readFileSync("LICENSE", "utf8");
builds[0].banner = { js: banner([license, notices]) };
// The ESM build bundles nothing, but keeps the epub.js notice for the example
// epubier started from.
const epubjs = packages.find((pkg) => pkg.name === "epubjs");
builds[1].banner = { js: banner([license, `Portions derived from epub.js:\n\n${epubjs.body}`]) };

console.log(`Bundled packages: ${packages.map((pkg) => pkg.name).join(", ")}`);

if (watch || serve) {
  const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
  await Promise.all(contexts.map((context) => context.watch()));
  if (serve) {
    const { port } = await contexts[0].serve({ servedir: ".", port: 8000 });
    console.log(`Example: http://localhost:${port}/example/`);
  }
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
