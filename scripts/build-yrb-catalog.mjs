#!/usr/bin/env node
/**
 * Merges digit-based and quoted-string patterns from
 * shared/sources/youtube-recycle-bin.txt (export of KVN AUST's "YouTube's Recycle Bin")
 * into shared/element_catalog.json.
 *
 * Run from repo root: node scripts/build-yrb-catalog.mjs
 *
 * Doc: https://docs.google.com/document/d/1mV5PhumaIJ8mtH8XmohqXkk5fjK_HlqcineMccPQm5A/
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "shared/sources/youtube-recycle-bin.txt");
const CATALOG_PATH = path.join(ROOT, "shared/element_catalog.json");

const CATEGORIES = [
  { id: "webcams", title: "Webcams" },
  { id: "body_cameras", title: "Body cameras" },
  { id: "action_cameras", title: "Action cameras" },
  { id: "smartphone", title: "Smartphone filenames" },
  { id: "digicam", title: "Digital cameras (DCIM-style)" },
  { id: "drone_dashcam", title: "Drones & dashcams" },
  { id: "game_capture", title: "Game capture" },
  { id: "screen_recorder", title: "Screen recording" },
  { id: "video_editor", title: "Video editors & slideshows" },
  { id: "phone_mms", title: "Phones & MMS / carrier" },
  { id: "dvd_vob", title: "DVD & VOB" },
  { id: "formats", title: "File extensions" },
  { id: "misc_apps", title: "Apps & messaging" },
  { id: "misc", title: "Misc" },
];

function mapCategory(line) {
  if (/BODY\s*CAM|AXON|WOLFCOM|VIEVU|WC-\d/i.test(line)) return "body_cameras";
  if (/GOPRO|GP01|GX01|GH01|M2U0|YDXJ|AMBAXXXX|FHDX|ACTION\s*CAM|LOOP0/i.test(line)) return "action_cameras";
  if (/WEBCAM/i.test(line)) return "webcams";
  if (/DRONE|DASHCAM|DJI|DJI\s|FILEX|REC\sX|MOVIX/i.test(line)) return "drone_dashcam";
  if (/GAME\s*CAPTURE|ROBLOX|MINECRAFT|JAVAW|CHROME\s+YYYY|\bCOD\b|HALF\s+LIFE|GTA|IW3MP|CODWAW/i.test(line))
    return "game_capture";
  if (/SCREEN\s*RECORD|BANDICAM|KAZAM|RPREPLAY|OBS|XRECORDER|SIMPLESCREEN/i.test(line)) return "screen_recorder";
  if (/\bDVD\b|VTS\b|VOB|\.DAT\b|MUSIC0X/i.test(line)) return "dvd_vob";
  if (/VIDEO\s*EDITOR|SLIDESHOW|CLIPCHAMP|STUPEFLIX|EZVID|YOUTUBE\s+VIDEO\s+EDITOR|FILMATO|SEQUENCE/i.test(line))
    return "video_editor";
  if (/PHONE|MMS|WHATSAPP|BLACKBERRY|SPRINT\s+PICTURE|TWEETCASTER|UPLOADED\s+FROM\s+AN\s+ANDROID|FLIP\s+VIDEO|FLIPSHARE/i.test(
    line,
  ))
    return "phone_mms";
  if (/\.MP4|\.MOV|\.AVI|\.WMV|\.3GP|\.3G2|\.WAV|\.FLAC|FORMAT\b/i.test(line)) return "formats";
  if (/ZOOM|INSHOT|KAKAO|KM\s+YYYY|YOU CUT|APP\b/i.test(line)) return "misc_apps";
  if (/SMARTPHONE|PXL|FULLSIZE|INSHOT/i.test(line)) return "smartphone";
  if (/CAMERA|CAMCORDER|DS\s*NINTENDO|\bDS\b|TRAIL\s*CAM|NINTENDO/i.test(line)) return "digicam";
  return "misc";
}

function yearRangeFromYmdLine(line) {
  if (/SCR\s+YYYYMMDD/i.test(line)) {
    return { yearMin: 2014, yearMax: 2018 };
  }
  const pair = line.match(/\(>\s*(\d{4})\s*,\s*<\s*(\d{4})\)/);
  if (pair) {
    const lo = +pair[1] + 1;
    const hi = +pair[2] - 1;
    if (lo <= hi) return { yearMin: lo, yearMax: hi };
  }
  const gt = line.match(/\(>\s*(\d{4})\)/);
  if (gt) {
    return { yearMin: +gt[1] + 1, yearMax: 2035 };
  }
  const ltOnly = line.match(/\(<\s*(\d{4})\)/);
  if (ltOnly) {
    const hi = +ltOnly[1] - 1;
    if (hi >= 1900) return { yearMin: 1990, yearMax: hi };
  }
  return { yearMin: 1990, yearMax: 2035 };
}

function slug(s) {
  return s
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48)
    .toLowerCase() || "x";
}

function shortHash(s) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

function shouldSkipLine(line) {
  if (line.length < 4) return true;
  if (/^_{5,}/.test(line)) return true;
  if (/^tab\s+\d/i.test(line)) return true;
  if (/^kvn\s+aust/i.test(line)) return true;
  if (/^preface|^shout\s+out|^special\s+thanks|^map\s+legend|^sort\s+by:/i.test(line)) return true;
  if (/^search\s+tools:/i.test(line)) return true;
  if (/^youtube.u2019?s\s+recycle\s+bin$/i.test(line)) return true;
  if (/^maps?\s*$/i.test(line)) return true;
  if (/^@\w/.test(line) && line.length < 80 && !line.includes('"') && !line.includes("\u201c")) return true;
  if (/clips4sale|nsfw\s*\^/i.test(line)) return true;
  if (/^\d+https?:/i.test(line)) return true;
  if (/(A-F,\s*0-9|AAA-FFF|MONTH\b|MTH\b|HHMMSS|VYOND|GOANIMATE)/i.test(line)) return true;
  if (line.split(/\s+/).length > 25) return true;
  return false;
}

/**
 * @returns {{ categoryId: string, title: string, segments: object[] } | null}
 */
function parseLine(raw) {
  let line = raw.replace(/\u00a0/g, " ").replace(/–/g, "-").trim();
  if (shouldSkipLine(line)) return null;

  const categoryId = mapCategory(line);
  const title = line.replace(/\s+/g, " ").slice(0, 200);

  // Quoted phrase (fixed search); skip date templates
  const qm = line.match(/^["\u201c](.+?)["\u201d]/);
  if (qm) {
    if (/XXXX|YYYYMMDD|Month|\bYYY\b|DDMMYYYY|YYMMDD/i.test(line)) return null;
    const text = qm[1].trim();
    if (text.length < 2 || text.length > 180) return null;
    return {
      categoryId,
      title,
      segments: [{ kind: "literal", text }],
    };
  }

  // Plain YYYYMMDD (valid Gregorian calendar date in range from line hints)
  if (/^YYYYMMDD\b/i.test(line)) {
    const { yearMin, yearMax } = yearRangeFromYmdLine(line);
    return {
      categoryId,
      title,
      segments: [{ kind: "date_ymd", yearMin, yearMax }],
    };
  }

  // Prefix + YYYYMMDD (e.g. WIN YYYYMMDD, Capture YYYYMMDD)
  let m = line.match(/^(.+?)\s+YYYYMMDD\b/i);
  if (m && !/^["\u201c]/.test(line)) {
    const prefix = `${m[1].trim()} `;
    if (prefix.length > 40) return null;
    const { yearMin, yearMax } = yearRangeFromYmdLine(line);
    return {
      categoryId,
      title,
      segments: [
        { kind: "literal", text: prefix },
        { kind: "date_ymd", yearMin, yearMax },
      ],
    };
  }

  // WhatsApp Video YYYY
  m = line.match(/^WhatsApp\s+Video\s+YYYY\b/i);
  if (m) {
    return {
      categoryId: "misc_apps",
      title,
      segments: [
        { kind: "literal", text: "WhatsApp Video " },
        { kind: "digits", count: 4, min: 2005, max: 2030, padZeros: false },
      ],
    };
  }

  // Spaced prefix + X-run + (min-max or tag)
  m = line.match(/^(.+?)(X{2,8})\s*\(([^)]*)\)/i);
  if (m) {
    let prefix = m[1];
    const width = m[2].length;
    const inner = m[3];
    let min = 0;
    let max = Math.min(10 ** width - 1, 999_999);
    const range = inner.match(/(\d+)\s*-\s*(\d+)/);
    if (range) {
      min = +range[1];
      max = +range[2];
    }
    if (max < min) return null;
    const segments = [];
    if (prefix.length) segments.push({ kind: "literal", text: prefix });
    segments.push({ kind: "digits", count: width, min, max, padZeros: true });
    return { categoryId, title, segments };
  }

  return null;
}

function elementKey(el) {
  return JSON.stringify(el.segments);
}

function main() {
  const body = fs.readFileSync(SOURCE, "utf8");
  const lines = body.split(/\n/);

  const existing = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
  for (const c of existing.categories ?? []) {
    if (!categoryById.has(c.id)) categoryById.set(c.id, c);
  }
  const mergedCategories = Array.from(categoryById.values()).sort((a, b) => a.id.localeCompare(b.id));

  const existingIds = new Set(existing.elements.map((e) => e.id));
  const seenKeys = new Set(existing.elements.map((e) => elementKey(e)));
  const generated = [];

  for (const raw of lines) {
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const key = elementKey(parsed);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    let id;
    if (parsed.segments.length === 1 && parsed.segments[0].kind === "literal") {
      id = `yrb_lit_${shortHash(parsed.segments[0].text)}`;
    } else {
      const lit = parsed.segments
        .filter((s) => s.kind === "literal")
        .map((s) => s.text)
        .join("");
      const dym = parsed.segments.find((s) => s.kind === "date_ymd");
      const dig = parsed.segments.find((s) => s.kind === "digits");
      if (dym) {
        id = `yrb_${slug(`${lit}_ymd_${dym.yearMin}_${dym.yearMax}`)}`;
      } else {
        id = `yrb_${slug(`${lit}_${dig?.count ?? 0}_${dig?.min ?? 0}_${dig?.max ?? 0}`)}`;
      }
    }

    if (existingIds.has(id)) {
      id = `${id}_${shortHash(key).slice(0, 6)}`;
    }
    existingIds.add(id);

    generated.push({
      id,
      categoryId: parsed.categoryId,
      title: parsed.title,
      segments: parsed.segments,
    });
  }

  const elements = [...existing.elements, ...generated].sort((a, b) => a.id.localeCompare(b.id));

  const out = {
    version: Math.max(existing.version ?? 2, 3),
    categories: mergedCategories,
    elements,
  };

  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(out, null, 2)}\n`);
  console.error(
    `Wrote ${elements.length} elements (${generated.length} new from shared/sources/youtube-recycle-bin.txt). Source doc: https://docs.google.com/document/d/1mV5PhumaIJ8mtH8XmohqXkk5fjK_HlqcineMccPQm5A/`,
  );
}

main();
