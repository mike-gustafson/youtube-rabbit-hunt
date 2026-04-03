#!/usr/bin/env node
/**
 * Replaces 8-digit random "digits" segments (invalid calendar dates) with
 * date_ymd segments (random valid Gregorian YYYYMMDD).
 * Run: node scripts/migrate-ymd-to-date-segments.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(__dirname, "../shared/element_catalog.json");

function yearRangeFromTitle(title) {
  if (/^SCR YYYYMMDD/i.test(title)) {
    return { yearMin: 2014, yearMax: 2018 };
  }

  const pair = title.match(/\(>\s*(\d{4})\s*,\s*<\s*(\d{4})\)/);
  if (pair) {
    const lo = +pair[1] + 1;
    const hi = +pair[2] - 1;
    if (lo <= hi) return { yearMin: lo, yearMax: hi };
  }

  const gt = title.match(/\(>\s*(?:May\s+)?(\d{4})\)/i);
  if (gt) {
    return { yearMin: +gt[1] + 1, yearMax: 2035 };
  }

  const ltOnly = title.match(/\(<\s*(\d{4})\)/);
  if (ltOnly) {
    const hi = +ltOnly[1] - 1;
    if (hi >= 1900) return { yearMin: 1990, yearMax: hi };
  }

  return null;
}

const raw = fs.readFileSync(CATALOG, "utf8");
const catalog = JSON.parse(raw);
let n = 0;

for (const el of catalog.elements) {
  el.segments = el.segments.map((seg) => {
    if (seg.kind !== "digits" || seg.count !== 8 || seg.padZeros !== true) return seg;
    n++;
    const hinted = yearRangeFromTitle(el.title);
    let yearMin;
    let yearMax;
    if (hinted) {
      yearMin = hinted.yearMin;
      yearMax = hinted.yearMax;
    } else {
      yearMin = Math.floor(seg.min / 10000);
      yearMax = Math.floor(seg.max / 10000);
    }
    if (yearMin > yearMax) [yearMin, yearMax] = [yearMax, yearMin];
    return { kind: "date_ymd", yearMin, yearMax };
  });
}

catalog.version = Math.max(catalog.version ?? 1, 4);
fs.writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);
console.error(`Converted ${n} eight-digit segments to date_ymd.`);
