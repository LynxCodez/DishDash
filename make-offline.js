'use strict';
/* ============================================================
   DISHDASH — offline copy builder
   ------------------------------------------------------------
   Refreshes a plain, always-openable copy of the app so the
   site can be used offline after any round of changes.

     node make-offline.js [destination]

   Default destination: <Desktop>\DishDash-offline
   (assumes this folder lives at <Desktop>\NewCodeTest\dishdash;
    pass a custom path as the first argument to override)
   ============================================================ */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname);
const DEFAULT_DEST = path.resolve(SRC, '..', '..', 'DishDash-offline');
const DEST = path.resolve(process.argv[2] || DEFAULT_DEST);

if (DEST === SRC || DEST.startsWith(SRC + path.sep)) {
  console.error('Destination must be outside the dishdash folder.');
  process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(SRC, DEST, { recursive: true });

let files = 0;
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files++;
  });
}(DEST));

console.log('Offline copy refreshed: ' + DEST);
console.log('Files copied: ' + files);
console.log('Open anytime: double-click index.html inside that folder.');
