#!/usr/bin/env node
/*
 * Regenerates lib/bs-data.js: keeps the published month lengths up to
 * LAST_PUBLISHED and appends years up to LAST_YEAR computed by lib/surya.js.
 * When Nepal publishes a new year's calendar, add its row to the published
 * part, raise LAST_PUBLISHED and run this again.
 *
 *   node tools/project-bs.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const LAST_PUBLISHED = 2083;
const LAST_YEAR = 2100;

const file = path.join(__dirname, "..", "lib", "bs-data.js");
const data = require(file);
const Surya = require("../lib/surya.js");

const published = data.monthLengths.slice(0, LAST_PUBLISHED - data.firstYear + 1);

// Day number of 1 Baisakh after the last published year.
const epoch = Math.round(Date.UTC(data.epochAD.year, data.epochAD.month - 1, data.epochAD.day) / 86400000);
const firstDay = epoch + published.flat().reduce((a, b) => a + b, 0);
const projected = Surya.projectYears(LAST_PUBLISHED + 1, LAST_YEAR, firstDay);

const rows = published.concat(projected).map((r, i) => `    [${r.join(", ")}], // ${data.firstYear + i}`);

fs.writeFileSync(file, `/*
 * Days in each Bikram Sambat month, Baisakh..Chaitra, for ${data.firstYear}-${LAST_YEAR} BS.
 *
 * ${data.firstYear}-${LAST_PUBLISHED}: from nepali-date-converter@3.4.0 (MIT,
 * github.com/subeshb1/Nepali-Date), checked month by month against
 * bikram-sambat@1.8.1 (Apache-2.0, github.com/medic/bikram-sambat).
 *
 * ${LAST_PUBLISHED + 1}-${LAST_YEAR}: no official calendar is published yet. These rows are
 * computed from Surya Siddhanta sankrantis by lib/surya.js, which reproduces
 * all but a handful of the published months; regenerate them with
 * tools/project-bs.js. The app labels these years as estimated.
 */
(function (root) {
  "use strict";

  var data = {
    firstYear: ${data.firstYear},
    // First year whose month lengths are computed, not published.
    projectedFrom: ${LAST_PUBLISHED + 1},
    // 1 Baisakh ${data.firstYear} BS
    epochAD: { year: ${data.epochAD.year}, month: ${data.epochAD.month}, day: ${data.epochAD.day} },
    monthLengths: [
${rows.join("\n")}
    ]
  };

  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.PatroBSData = data;
})(this);
`);
console.log(`Wrote ${file}: ${published.length} published + ${projected.length} computed years`);
