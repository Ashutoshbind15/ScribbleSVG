#!/usr/bin/env node
/**
 * Generate scribble wordmark SVG/PNG assets for ScribbleSVG.
 *
 *   node utils/brand/generate-wordmarks.mjs
 */
import { writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../../docs/public/brand");
const APP_OUT = join(__dirname, "../../docs/app");
const SITE_BRAND_OUT = join(__dirname, "../../apps/site/public/brand");
const SITE_PUBLIC_OUT = join(__dirname, "../../apps/site/public");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Hand-drawn skeletons in a ~100×120 box (baseline ~90).
 * Each glyph = array of strokes; each stroke = control points [x,y].
 */
const LETTERS = {
  // everyday lowercase s
  s: [
    [
      [74, 30],
      [58, 16],
      [32, 18],
      [20, 34],
      [34, 48],
      [58, 54],
      [74, 68],
      [66, 86],
      [42, 94],
      [24, 84],
    ],
  ],
  // abbreviation mark — taller, looser, with a little kick
  S: [
    [
      [92, 18],
      [60, 2],
      [24, 10],
      [10, 34],
      [28, 54],
      [68, 60],
      [92, 78],
      [80, 108],
      [44, 122],
      [14, 110],
      [8, 88],
    ],
  ],
  c: [
    [
      [78, 36],
      [60, 20],
      [34, 20],
      [16, 40],
      [16, 68],
      [32, 88],
      [58, 92],
      [78, 76],
    ],
  ],
  r: [
    [
      [20, 92],
      [22, 52],
      [24, 24],
    ],
    [
      [24, 36],
      [40, 18],
      [62, 18],
      [74, 32],
    ],
  ],
  i: [
    [[36, 36], [38, 92]],
    [[36, 14], [38, 18]],
  ],
  b: [
    [
      [22, 4],
      [24, 48],
      [26, 92],
    ],
    [
      [26, 40],
      [48, 26],
      [70, 34],
      [74, 56],
      [66, 78],
      [44, 90],
      [26, 80],
    ],
  ],
  l: [[[34, 4], [36, 48], [38, 92]]],
  e: [
    [
      [18, 58],
      [72, 52],
      [74, 34],
      [54, 20],
      [28, 24],
      [16, 44],
      [22, 72],
      [44, 90],
      [70, 84],
    ],
  ],
  v: [
    [
      [14, 24],
      [36, 90],
      [48, 90],
      [80, 22],
    ],
  ],
  g: [
    [
      [74, 36],
      [54, 20],
      [30, 24],
      [16, 46],
      [22, 74],
      [46, 88],
      [70, 78],
      [76, 52],
    ],
    [
      [76, 58],
      [78, 96],
      [66, 114],
      [40, 116],
      [24, 102],
    ],
  ],
};

const ADVANCES = {
  s: 76,
  S: 98,
  c: 80,
  r: 70,
  i: 40,
  b: 76,
  l: 40,
  e: 78,
  v: 80,
  g: 78,
};

function jitterPoint([x, y], rng, amount) {
  return [x + (rng() - 0.5) * 2 * amount, y + (rng() - 0.5) * 2 * amount];
}

/** Catmull-Rom open spline → SVG cubic path (smooth handwriting, not vibrating) */
function strokeToCubicPath(rawPoints, rng, wobble) {
  const pts = rawPoints.map((p, i) => {
    const edge = Math.min(i, rawPoints.length - 1 - i);
    const amp = wobble * Math.min(1, edge / 2);
    return jitterPoint(p, rng, amp);
  });

  if (pts.length === 1) {
    const [x, y] = pts[0];
    return `M ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  if (pts.length === 2) {
    const [a, b] = pts;
    // slight bow for short strokes (i tittle, stems)
    const mx = (a[0] + b[0]) / 2 + (rng() - 0.5) * wobble;
    const my = (a[1] + b[1]) / 2 + (rng() - 0.5) * wobble;
    return `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  }

  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    // Catmull-Rom to Bezier
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function layoutWord(chars, opts) {
  const {
    seed,
    scale = 1,
    tracking = 8,
    startX = 16,
    baselineY = 0,
    wobble = 3.2,
    overshoot = true,
  } = opts;
  const rng = mulberry32(seed);
  const paths = [];
  let x = startX;

  for (const ch of chars) {
    const glyph = LETTERS[ch];
    if (!glyph) throw new Error(`Missing glyph: ${ch}`);
    const adv = ADVANCES[ch] * scale;
    const letterScale = scale * (overshoot ? 0.95 + rng() * 0.1 : 1);
    const yNudge = overshoot ? (rng() - 0.5) * 5 * scale : 0;
    const rot = overshoot ? (rng() - 0.5) * 0.08 : 0;

    for (const stroke of glyph) {
      const mapped = stroke.map(([px, py]) => {
        let sx = px * letterScale;
        let sy = py * letterScale;
        const cx = 50 * letterScale;
        const cy = 60 * letterScale;
        const dx = sx - cx;
        const dy = sy - cy;
        sx = cx + dx * Math.cos(rot) - dy * Math.sin(rot);
        sy = cy + dx * Math.sin(rot) + dy * Math.cos(rot);
        return [sx + x, sy + baselineY + yNudge];
      });

      paths.push({
        d: strokeToCubicPath(mapped, rng, wobble * scale),
        weight: 1,
      });

      // occasional ghost second pass (ink revisit)
      if (rng() > 0.55) {
        const ghost = mapped.map((p) =>
          jitterPoint(
            [p[0] + (rng() - 0.5) * 1.4 * scale, p[1] + (rng() - 0.5) * 1.1 * scale],
            rng,
            0.6 * scale,
          ),
        );
        paths.push({
          d: strokeToCubicPath(ghost, rng, wobble * 0.55 * scale),
          weight: 0.55,
        });
      }
    }

    x += adv + tracking * scale * (0.8 + rng() * 0.4);
  }

  return { paths, width: x + 20, height: 128 * scale + 28 };
}

function svgDocument({
  width,
  height,
  paths,
  stroke = "#141414",
  strokeWidth = 4.2,
  pad = 14,
  label = "ScribbleSVG",
}) {
  const vbW = width + pad * 2;
  const vbH = height + pad * 2;
  const body = paths
    .map(({ d, weight }) => {
      const sw = (strokeWidth * weight).toFixed(2);
      const op = weight < 1 ? ` opacity="${(0.45 + weight * 0.4).toFixed(2)}"` : "";
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${op}/>`;
    })
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${vbW} ${vbH}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" role="img" aria-label="${label}">
  ${body}
</svg>
`;
}

function rasterize(svgPath, pngPath, { zoom, width, height } = {}) {
  const args = [];
  if (width) args.push("-w", String(width));
  if (height) args.push("-h", String(height));
  if (zoom && !width) args.push("-z", String(zoom));
  args.push("-o", pngPath, svgPath);
  const res = spawnSync("rsvg-convert", args, { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || "rsvg-convert failed");
  }
}

/** Square app / favicon mark: dark badge + light scribble S. */
function svgAppIcon({ paths, contentW, contentH, size = 256, strokeWidth = 5.2, label = "ScribbleSVG" }) {
  const inset = size * 0.16;
  const avail = size - inset * 2;
  const scale = Math.min(avail / contentW, avail / contentH);
  const ox = (size - contentW * scale) / 2;
  const oy = (size - contentH * scale) / 2 - size * 0.02;
  const radius = Math.round(size * 0.22);
  const body = paths
    .map(({ d, weight }) => {
      const sw = (strokeWidth * weight).toFixed(2);
      const op = weight < 1 ? ` opacity="${(0.5 + weight * 0.35).toFixed(2)}"` : "";
      return `<path d="${d}" fill="none" stroke="#f4f4f5" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${op}/>`;
    })
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${label}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#141414"/>
  <g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${scale.toFixed(5)})">
    ${body}
  </g>
</svg>
`;
}

function emit(name, layout, { strokeWidth, label, zoom = 3 }) {
  mkdirSync(OUT, { recursive: true });

  const themed = svgDocument({
    ...layout,
    stroke: "currentColor",
    strokeWidth,
    label,
  });
  const ink = svgDocument({
    ...layout,
    stroke: "#141414",
    strokeWidth,
    label,
  });
  const light = svgDocument({
    ...layout,
    stroke: "#f4f4f5",
    strokeWidth,
    label,
  });

  const svgPath = join(OUT, `${name}.svg`);
  writeFileSync(svgPath, themed, "utf8");

  const inkTmp = join(OUT, `${name}.ink.svg`);
  writeFileSync(inkTmp, ink, "utf8");
  rasterize(inkTmp, join(OUT, `${name}.png`), { zoom });
  rmSync(inkTmp);

  const lightTmp = join(OUT, `${name}.light.svg`);
  writeFileSync(lightTmp, light, "utf8");
  rasterize(lightTmp, join(OUT, `${name}-light.png`), { zoom });
  rmSync(lightTmp);

  console.log(`wrote ${name}.svg / .png / -light.png`);
}

// Full wordmark
{
  const layout = layoutWord("scribblesvg".split(""), {
    seed: hashSeed("scribblesvg-wordmark-v2"),
    scale: 1,
    tracking: 5,
    startX: 10,
    baselineY: 6,
    wobble: 3.4,
  });
  emit("scribblesvg", layout, {
    strokeWidth: 4.4,
    label: "scribblesvg",
    zoom: 3,
  });
}

// Abbreviation mark: large S + smaller svg + scribble underline
{
  const seed = hashSeed("ssvg-mark-v2");
  const rng = mulberry32(seed ^ 0xabcdef);

  const big = layoutWord(["S"], {
    seed: seed ^ 0x1111,
    scale: 1.4,
    tracking: 0,
    startX: 8,
    baselineY: -10,
    wobble: 3.8,
  });

  const rest = layoutWord("svg".split(""), {
    seed: seed ^ 0x2222,
    scale: 0.72,
    tracking: 4,
    startX: big.width - 36,
    baselineY: 42,
    wobble: 2.8,
  });

  // abbreviation underline under "svg"
  const y = 42 + 98 * 0.72 + 6;
  const x0 = big.width - 30;
  const x1 = rest.width - 18;
  const underPts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    underPts.push([
      x0 + (x1 - x0) * t,
      y + Math.sin(t * Math.PI) * 3 + (rng() - 0.5) * 2,
    ]);
  }

  const paths = [
    ...big.paths,
    ...rest.paths,
    { d: strokeToCubicPath(underPts, rng, 1.6), weight: 0.75 },
  ];

  emit(
    "ssvg",
    {
      paths,
      width: Math.max(big.width, rest.width) + 10,
      height: 160,
    },
    { strokeWidth: 4.6, label: "ssvg", zoom: 3 },
  );
}

// Square app / favicon / apple-touch mark (large S on dark badge)
{
  const seed = hashSeed("ssvg-icon-v1");
  const glyph = layoutWord(["S"], {
    seed: seed ^ 0x4242,
    scale: 1.55,
    tracking: 0,
    startX: 6,
    baselineY: 0,
    wobble: 3.6,
  });

  const svg = svgAppIcon({
    paths: glyph.paths,
    contentW: glyph.width,
    contentH: glyph.height,
    size: 256,
    strokeWidth: 5.4,
    label: "ScribbleSVG",
  });

  mkdirSync(OUT, { recursive: true });
  mkdirSync(APP_OUT, { recursive: true });

  const brandSvg = join(OUT, "icon.svg");
  writeFileSync(brandSvg, svg, "utf8");
  rasterize(brandSvg, join(OUT, "icon.png"), { width: 512, height: 512 });

  // Next.js App Router file conventions (favicon + Apple touch)
  writeFileSync(join(APP_OUT, "icon.svg"), svg, "utf8");
  rasterize(brandSvg, join(APP_OUT, "apple-icon.png"), { width: 180, height: 180 });

  console.log("wrote icon.svg / icon.png + app/icon.svg + apple-icon.png");
}

// Vite site (header mark, empty-state wordmark, favicon)
{
  mkdirSync(SITE_BRAND_OUT, { recursive: true });
  mkdirSync(SITE_PUBLIC_OUT, { recursive: true });
  for (const name of ["icon", "ssvg", "scribblesvg"]) {
    copyFileSync(join(OUT, `${name}.svg`), join(SITE_BRAND_OUT, `${name}.svg`));
  }
  copyFileSync(join(OUT, "icon.svg"), join(SITE_PUBLIC_OUT, "favicon.svg"));
  console.log("wrote apps/site/public/brand/*.svg + favicon.svg");
}

console.log(`\nAssets → ${OUT}`);
console.log(`App icons → ${APP_OUT}`);
console.log(`Site assets → ${SITE_BRAND_OUT}`);
