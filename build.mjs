import * as esbuild from "esbuild";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

const common = {
  bundle: true,
  target: ["es2020"],
  logLevel: "info",
  // Bundled packages' own "/*!" comments are dropped; the banner carries
  // every bundled package's full license instead, once each.
  legalComments: "none",
  // The comic archive format fetches its worker from the CDN in this version
  define: { EPUBIER_VERSION: JSON.stringify(version) },
};

// <script src="…"> builds define a global `epubier` function and contain
// everything they need.
const script = (entry, outfile) => ({
  ...common,
  entryPoints: [entry],
  outfile,
  format: "iife",
  globalName: "epubier",
  footer: { js: "epubier = epubier.default;" },
  minify: true,
  sourcemap: true,
  // PDF.js looks at import.meta.url only under Node
  logOverride: { "empty-import-meta": "silent" },
});

const builds = [
  // ePubs only: epub.js, JSZip and their dependencies
  script("src/index.js", "dist/epubier.min.js"),
  // Every format: adds PDF.js and the Kindle parser. The workers for PDF.js
  // and comic archives are beside it (see copyPdfWorker and the build
  // below), where it looks for them.
  script("src/all.js", "dist/epubier.all.min.js"),
  // For bundlers: `import epubier from "epubier"`, and the other entry
  // points in package.json's exports. They share code through chunks, and
  // leave the formats' libraries for the app's bundler to resolve, so they
  // aren't duplicated, and so that formats loaded on demand (PDF, comics,
  // Kindle) are separate chunks the app's bundler splits off too.
  {
    ...common,
    entryPoints: {
      index: "src/index.js",
      all: "src/all.js",
      core: "src/core.js",
      "formats/epub": "src/formats/epub/index.js",
      "formats/pdf": "src/formats/pdf/index.js",
      "formats/comic": "src/formats/comic/index.js",
      "formats/comicarchive": "src/formats/comicarchive/index.js",
      "formats/mobi": "src/formats/mobi/index.js",
    },
    outdir: "dist/esm",
    format: "esm",
    splitting: true,
    chunkNames: "chunks/[name]-[hash]",
    external: ["epubjs", "jszip", "pdfjs-dist", "@lingo-reader/mobi-parser"],
  },
  // The comic archive worker, with libarchive.js's glue for libarchive.wasm
  // (copied beside it, where it looks for it). It's the same for every way
  // of using epubier, so the ES modules use it too, from here or the CDN.
  {
    ...common,
    entryPoints: ["src/formats/comicarchive/worker.js"],
    outfile: "dist/comicarchive.worker.js",
    format: "esm",
    platform: "browser",
    minify: true,
    // Emscripten's glue imports Node's modules only under Node
    external: ["module", "fs", "path", "url"],
  },
];

/** PDF.js's worker, which epubier.all.min.js loads from its own folder by default */
function copyPdfWorker() {
  copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "dist/pdf.worker.min.mjs");
}

/** libarchive itself, which the comic archive worker loads from its own folder */
function copyLibarchive() {
  copyFileSync("node_modules/libarchive.js/dist/libarchive.wasm", "dist/libarchive.wasm");
}

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
  "libarchive.js": {
    note: `libarchive.js's glue is in dist/comicarchive.worker.js, and dist/libarchive.wasm is its build of
libarchive 3.7.2 (https://libarchive.org), with zlib (zlib license), bzip2 (BSD-style), xz's liblzma
(public domain) and OpenSSL (Apache-2.0). libarchive's license:

Copyright (c) 2003-2018 Tim Kientzle and the libarchive authors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer
   in this position and unchanged.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE AUTHOR(S) \`\`AS IS'' AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
IN NO EVENT SHALL THE AUTHOR(S) BE LIABLE FOR ANY DIRECT, INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

libarchive.js's own license:`,
  },
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

function thirdPartyNotices(packages, epubOnly, workerOnly) {
  const rule = "-".repeat(80);
  const intro = `Third-party notices

epubier started from the epub.js "highlights" example. dist/epubier.all.min.js
contains the following packages, each distributed under the license below;
dist/epubier.min.js contains those not marked as only in the former.
dist/pdf.worker.min.mjs is PDF.js's own worker, with its license at its top.
dist/comicarchive.worker.js and dist/libarchive.wasm, which read .cbr and
.cb7 comics, contain libarchive.js, marked as only in those below.
The ES modules in dist/esm/ contain none of them; they import the packages,
which bring their own.`;
  const heading = (pkg) =>
    epubOnly.has(pkg.name)
      ? pkg.heading
      : `${pkg.heading}\n(only in ${workerOnly.has(pkg.name) ? "comicarchive.worker.js and libarchive.wasm" : "epubier.all.min.js"})`;
  return [intro, ...packages.map((pkg) => `${rule}\n${heading(pkg)}\n${rule}\n\n${pkg.body}`)].join("\n\n\n") + "\n";
}

/** Just the licenses, for a built file's banner */
const licenseTexts = (packages) => packages.map((pkg) => `${pkg.heading}\n\n${pkg.body}`).join("\n\n\n");

const epubPackages = await bundledPackages(builds[0]);
const allPackages = await bundledPackages(builds[1]);
const workerPackages = await bundledPackages(builds[3]);
const workerOnly = workerPackages.filter((pkg) => !allPackages.some((p) => p.name === pkg.name));
writeFileSync(
  "THIRD_PARTY_LICENSES",
  thirdPartyNotices(
    [...allPackages, ...workerOnly],
    new Set(epubPackages.map((pkg) => pkg.name)),
    new Set(workerOnly.map((pkg) => pkg.name)),
  ),
);

// "/*!" comments survive minification
const banner = (licenses) =>
  `/*! epubier ${version}\n\n${licenses.join("\n\n").trim().replaceAll("*/", "* /")}\n*/`;
const license = readFileSync("LICENSE", "utf8");
builds[0].banner = { js: banner([license, "Third-party notices:", licenseTexts(epubPackages)]) };
builds[1].banner = { js: banner([license, "Third-party notices:", licenseTexts(allPackages)]) };
// The ES modules bundle nothing, but keep the epub.js notice for the example
// epubier started from.
const epubjs = epubPackages.find((pkg) => pkg.name === "epubjs");
builds[2].banner = { js: banner([license, `Portions derived from epub.js:\n\n${epubjs.body}`]) };
builds[3].banner = { js: banner([license, "Third-party notices:", licenseTexts(workerPackages)]) };

console.log(`Bundled packages: ${allPackages.map((pkg) => pkg.name).join(", ")}`);

rmSync("dist/esm", { recursive: true, force: true });
copyPdfWorker();
copyLibarchive();
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
