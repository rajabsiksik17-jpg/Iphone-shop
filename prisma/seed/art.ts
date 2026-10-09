/**
 * Procedural "studio render" artwork for demo products, slides and brands.
 * Produces original SVGs (no copyrighted photography) that are rasterised and
 * pushed through the real media pipeline during seeding.
 */

export type DeviceKind =
  | "phone"
  | "phone-pro"
  | "fold"
  | "flip"
  | "tablet"
  | "laptop"
  | "watch"
  | "band"
  | "earbuds"
  | "headphones"
  | "charger"
  | "cable"
  | "case"
  | "powerbank";

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 170;
};

export function frame(inner: string, opts: { bg?: [string, string]; shadow?: boolean } = {}) {
  const [a, b] = opts.bg ?? ["#f7f7f8", "#e9eaee"];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200">
<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".5" stop-color="#4338ca"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient>
<linearGradient id="screen2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7c2d12"/><stop offset=".55" stop-color="#ea580c"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
</defs>
<rect width="1200" height="1200" fill="url(#bg)"/>
${opts.shadow === false ? "" : `<ellipse cx="600" cy="1010" rx="300" ry="34" fill="#0b1220" opacity=".16" filter="url(#sh)"/>`}
${inner}
</svg>`;
}

function lens(cx: number, cy: number, r: number, body: string) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="${shade(body, -25)}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b0f19"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#1f2a44"/><circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.18}" fill="#93c5fd" opacity=".7"/>`;
}

function phoneBack(color: string, pro: boolean) {
  const edge = shade(color, -30);
  const cam = pro
    ? `<rect x="470" y="235" width="250" height="250" rx="62" fill="${shade(color, -12)}" stroke="${edge}" stroke-width="4"/>${lens(540, 305, 42, color)}${lens(540, 415, 42, color)}${lens(650, 360, 42, color)}<circle cx="655" cy="270" r="12" fill="#fef3c7"/>`
    : `<rect x="470" y="235" width="140" height="250" rx="60" fill="${shade(color, -12)}" stroke="${edge}" stroke-width="4"/>${lens(540, 300, 40, color)}${lens(540, 420, 40, color)}`;
  return `<g transform="rotate(-8 600 600)"><rect x="440" y="200" width="340" height="700" rx="70" fill="${edge}"/><rect x="448" y="208" width="324" height="684" rx="64" fill="${color}"/><rect x="448" y="208" width="324" height="684" rx="64" fill="url(#gloss)" opacity=".6"/>${cam}<circle cx="610" cy="640" r="34" fill="${shade(color, -16)}" opacity=".5"/></g>`;
}

function phoneFront(color: string, screen = "url(#screen)") {
  const edge = shade(color, -35);
  return `<g transform="translate(-40 0) rotate(6 600 600)"><rect x="440" y="200" width="340" height="700" rx="70" fill="${edge}"/><rect x="452" y="212" width="316" height="676" rx="60" fill="#05070d"/><rect x="466" y="226" width="288" height="648" rx="48" fill="${screen}"/><rect x="560" y="246" width="100" height="28" rx="14" fill="#05070d"/><g fill="#fff" opacity=".9"><rect x="500" y="330" width="110" height="18" rx="9"/><rect x="500" y="364" width="190" height="44" rx="12" opacity=".95"/></g><g opacity=".85">${[0, 1, 2, 3]
    .map((c) => [0, 1, 2].map((r) => `<rect x="${500 + c * 62}" y="${560 + r * 70}" width="46" height="46" rx="13" fill="#fff" opacity="${0.18 + ((c + r) % 3) * 0.12}"/>`).join(""))
    .join("")}</g><rect x="466" y="226" width="288" height="648" rx="48" fill="url(#gloss)" opacity=".35"/></g>`;
}

export const devices: Record<DeviceKind, (color: string, view: number) => string> = {
  phone: (c, v) => (v % 2 === 0 ? phoneBack(c, false) : phoneFront(c)),
  "phone-pro": (c, v) => (v % 2 === 0 ? phoneBack(c, true) : phoneFront(c, "url(#screen2)")),
  fold: (c, v) =>
    v % 2 === 0
      ? `<g transform="rotate(-6 600 600)"><rect x="330" y="230" width="560" height="660" rx="50" fill="${shade(c, -35)}"/><rect x="342" y="242" width="536" height="636" rx="42" fill="#05070d"/><rect x="354" y="254" width="512" height="612" rx="34" fill="url(#screen)"/><line x1="610" y1="254" x2="610" y2="866" stroke="#fff" stroke-opacity=".12" stroke-width="3"/><rect x="354" y="254" width="512" height="612" rx="34" fill="url(#gloss)" opacity=".3"/></g>`
      : phoneBack(c, true),
  flip: (c, v) =>
    v % 2 === 0
      ? `<g transform="rotate(-8 600 600)"><rect x="455" y="300" width="290" height="300" rx="56" fill="${c}"/><rect x="455" y="600" width="290" height="300" rx="56" fill="${shade(c, -10)}"/><rect x="475" y="320" width="250" height="250" rx="40" fill="#05070d"/><rect x="487" y="332" width="226" height="226" rx="32" fill="url(#screen2)"/>${lens(535, 380, 26, c)}${lens(535, 470, 26, c)}<rect x="455" y="592" width="290" height="16" fill="${shade(c, -40)}"/></g>`
      : phoneFront(c),
  tablet: (c, v) =>
    v % 2 === 0
      ? `<g transform="rotate(-4 600 600)"><rect x="250" y="250" width="700" height="520" rx="48" fill="${shade(c, -30)}"/><rect x="262" y="262" width="676" height="496" rx="38" fill="#05070d"/><rect x="282" y="282" width="636" height="456" rx="22" fill="url(#screen)"/><rect x="282" y="282" width="636" height="456" rx="22" fill="url(#gloss)" opacity=".3"/></g>`
      : `<g transform="rotate(5 600 600)"><rect x="330" y="190" width="540" height="760" rx="48" fill="${shade(c, -25)}"/><rect x="338" y="198" width="524" height="744" rx="42" fill="${c}"/><rect x="338" y="198" width="524" height="744" rx="42" fill="url(#gloss)" opacity=".5"/>${lens(410, 270, 30, c)}</g>`,
  laptop: (c) =>
    `<g><path d="M300 300 Q300 270 330 270 L870 270 Q900 270 900 300 L900 700 L300 700 Z" fill="${shade(c, -30)}"/><rect x="318" y="288" width="564" height="396" rx="10" fill="#05070d"/><rect x="330" y="300" width="540" height="372" rx="6" fill="url(#screen)"/><rect x="330" y="300" width="540" height="372" rx="6" fill="url(#gloss)" opacity=".25"/><path d="M200 720 L1000 720 L960 770 Q950 780 930 780 L270 780 Q250 780 240 770 Z" fill="${c}"/><rect x="200" y="700" width="800" height="24" rx="6" fill="${shade(c, 15)}"/><rect x="540" y="700" width="120" height="10" rx="5" fill="${shade(c, -20)}"/></g>`,
  watch: (c, v) =>
    `<g transform="rotate(${v % 2 ? 6 : -6} 600 600)"><rect x="500" y="130" width="200" height="300" rx="40" fill="${shade(c, -20)}"/><rect x="500" y="770" width="200" height="300" rx="40" fill="${shade(c, -20)}"/><rect x="430" y="390" width="340" height="420" rx="96" fill="${shade(c, -40)}"/><rect x="446" y="406" width="308" height="388" rx="84" fill="#05070d"/><rect x="468" y="428" width="264" height="344" rx="66" fill="url(#screen2)"/><text x="600" y="610" text-anchor="middle" font-family="Arial" font-size="92" font-weight="700" fill="#fff">10:09</text><rect x="770" y="520" width="22" height="80" rx="11" fill="${shade(c, -10)}"/></g>`,
  band: (c) =>
    `<g transform="rotate(-10 600 600)"><rect x="530" y="160" width="140" height="880" rx="70" fill="${c}"/><rect x="505" y="420" width="190" height="360" rx="80" fill="#0b0f19"/><rect x="525" y="440" width="150" height="320" rx="64" fill="url(#screen)"/><text x="600" y="620" text-anchor="middle" font-family="Arial" font-size="54" font-weight="700" fill="#fff">8,421</text></g>`,
  earbuds: (c) =>
    `<g><rect x="380" y="430" width="440" height="380" rx="150" fill="${shade(c, -18)}"/><rect x="380" y="430" width="440" height="190" rx="95" fill="${c}"/><line x1="390" y1="620" x2="810" y2="620" stroke="${shade(c, -40)}" stroke-width="5"/><circle cx="600" cy="700" r="8" fill="#22c55e"/><g transform="translate(250 230) rotate(-25)"><ellipse cx="80" cy="80" rx="72" ry="66" fill="${c}"/><rect x="62" y="120" width="40" height="150" rx="20" fill="${c}"/><ellipse cx="80" cy="80" rx="40" ry="34" fill="${shade(c, -30)}"/></g><g transform="translate(790 210) rotate(25)"><ellipse cx="80" cy="80" rx="72" ry="66" fill="${c}"/><rect x="58" y="120" width="40" height="150" rx="20" fill="${c}"/><ellipse cx="80" cy="80" rx="40" ry="34" fill="${shade(c, -30)}"/></g></g>`,
  headphones: (c) =>
    `<g><path d="M350 640 Q350 260 600 260 Q850 260 850 640" fill="none" stroke="${shade(c, -25)}" stroke-width="56" stroke-linecap="round"/><path d="M350 640 Q350 260 600 260 Q850 260 850 640" fill="none" stroke="${c}" stroke-width="40" stroke-linecap="round"/><rect x="270" y="560" width="170" height="300" rx="80" fill="${c}"/><rect x="760" y="560" width="170" height="300" rx="80" fill="${c}"/><rect x="300" y="590" width="110" height="240" rx="55" fill="${shade(c, -30)}"/><rect x="790" y="590" width="110" height="240" rx="55" fill="${shade(c, -30)}"/></g>`,
  charger: (c) =>
    `<g transform="rotate(-8 600 600)"><rect x="440" y="360" width="320" height="380" rx="56" fill="${shade(c, -15)}"/><rect x="440" y="360" width="320" height="380" rx="56" fill="url(#gloss)" opacity=".7"/><rect x="545" y="230" width="22" height="140" rx="6" fill="#cbd5e1"/><rect x="633" y="230" width="22" height="140" rx="6" fill="#cbd5e1"/><rect x="560" y="640" width="80" height="28" rx="14" fill="${isLight(c) ? "#1f2937" : "#e2e8f0"}"/></g>`,
  cable: (c) =>
    `<g fill="none" stroke-linecap="round"><path d="M330 330 C 330 650, 870 360, 860 760 S 520 900, 470 840" stroke="${shade(c, -25)}" stroke-width="40"/><path d="M330 330 C 330 650, 870 360, 860 760 S 520 900, 470 840" stroke="${c}" stroke-width="28"/></g><rect x="290" y="210" width="80" height="140" rx="22" fill="${shade(c, 10)}"/><rect x="310" y="170" width="40" height="60" rx="8" fill="#cbd5e1"/><rect x="430" y="820" width="80" height="140" rx="22" fill="${shade(c, 10)}" transform="rotate(30 470 890)"/>`,
  case: (c) =>
    `<g transform="rotate(-8 600 600)"><rect x="430" y="190" width="360" height="720" rx="80" fill="${c}"/><rect x="430" y="190" width="360" height="720" rx="80" fill="url(#gloss)" opacity=".55"/><rect x="465" y="230" width="260" height="260" rx="64" fill="${shade(c, -35)}"/><circle cx="610" cy="640" r="105" fill="none" stroke="${shade(c, -18)}" stroke-width="10" opacity=".6"/></g>`,
  powerbank: (c) =>
    `<g transform="rotate(-6 600 600)"><rect x="400" y="300" width="400" height="600" rx="60" fill="${c}"/><rect x="400" y="300" width="400" height="600" rx="60" fill="url(#gloss)" opacity=".5"/><g fill="#22c55e">${[0, 1, 2, 3].map((i) => `<circle cx="${545 + i * 36}" cy="830" r="10"/>`).join("")}</g><circle cx="600" cy="560" r="110" fill="none" stroke="${shade(c, -20)}" stroke-width="10" opacity=".5"/></g>`,
};

export function productArt(kind: DeviceKind, color: string, view = 0) {
  const bgs: [string, string][] = [
    ["#f8f8fa", "#e6e8ee"],
    ["#f5f6f8", "#dfe3ea"],
    ["#fbfaf8", "#ebe7e1"],
  ];
  return frame(devices[kind](color, view), { bg: bgs[view % bgs.length] });
}

/** Wide hero slide background with abstract light and a device silhouette. */
export function slideArt(opts: { from: string; to: string; accent: string; kind: DeviceKind; color: string; width?: number; height?: number }) {
  const w = opts.width ?? 2400;
  const h = opts.height ?? 1000;
  const device = devices[opts.kind](opts.color, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${opts.from}"/><stop offset="1" stop-color="${opts.to}"/></linearGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${opts.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${opts.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".5" stop-color="#4338ca"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient>
<linearGradient id="screen2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7c2d12"/><stop offset=".55" stop-color="#ea580c"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
<filter id="sh"><feGaussianBlur stdDeviation="30"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${w * 0.72}" cy="${h * 0.5}" r="${h * 0.62}" fill="url(#glow)"/>
<circle cx="${w * 0.1}" cy="${h * 1.05}" r="${h * 0.5}" fill="url(#glow)" opacity=".5"/>
<g opacity=".08" stroke="#fff">${Array.from({ length: 14 }, (_, i) => `<line x1="${i * (w / 13)}" y1="0" x2="${i * (w / 13) - h * 0.4}" y2="${h}"/>`).join("")}</g>
<g transform="translate(${w * 0.72 - 600 * 0.85} ${h * 0.5 - 560 * 0.85}) scale(0.85)">${device}</g>
<g transform="translate(${w * 0.86 - 600 * 0.55} ${h * 0.62 - 600 * 0.55}) scale(0.55)" opacity=".9">${devices[opts.kind === "phone-pro" ? "watch" : "earbuds"](shade(opts.color, 30), 1)}</g>
</svg>`;
}

/** Wordmark-style brand logo (original typography, not the trademark artwork). */
export function brandLogo(name: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><rect width="600" height="240" fill="#ffffff"/><text x="300" y="148" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="700" letter-spacing="-2" fill="${color}">${name}</text></svg>`;
}

/** Category tile artwork. */
export function categoryArt(kind: DeviceKind, color: string, tint: [string, string]) {
  return frame(devices[kind](color, 0), { bg: tint });
}

export function bannerArt(opts: { from: string; to: string; kind: DeviceKind; color: string }) {
  return slideArt({ ...opts, accent: "#ffffff", width: 1600, height: 900 });
}
