/**
 * Procedural demo artwork for store-type templates — original flat "studio"
 * illustrations (no third-party photography), rasterised once into the media
 * pipeline and shared by every template that uses the same kind + colour.
 */
import { devices, frame, shade, type DeviceKind } from "../../../prisma/seed/art";

const DEVICE_KINDS = Object.keys(devices) as DeviceKind[];

const objects = {
  bottle: (c: string) =>
    `<rect x="455" y="420" width="290" height="520" rx="70" fill="${c}"/><rect x="455" y="420" width="290" height="520" rx="70" fill="url(#gloss)" opacity=".55"/><rect x="545" y="330" width="110" height="110" rx="14" fill="${shade(c, -40)}"/><rect x="510" y="230" width="180" height="120" rx="26" fill="#c9a24a"/><rect x="510" y="230" width="180" height="120" rx="26" fill="url(#gloss)" opacity=".6"/><rect x="505" y="640" width="190" height="110" rx="10" fill="#fff" opacity=".85"/><rect x="535" y="672" width="130" height="14" rx="7" fill="${shade(c, -50)}" opacity=".7"/><rect x="560" y="702" width="80" height="10" rx="5" fill="${shade(c, -50)}" opacity=".5"/>`,
  jar: (c: string) =>
    `<rect x="380" y="560" width="440" height="380" rx="60" fill="${c}"/><rect x="380" y="560" width="440" height="380" rx="60" fill="url(#gloss)" opacity=".5"/><rect x="360" y="470" width="480" height="130" rx="40" fill="${shade(c, -45)}"/><rect x="430" y="690" width="340" height="130" rx="18" fill="#fff" opacity=".85"/><rect x="470" y="730" width="260" height="16" rx="8" fill="${shade(c, -55)}" opacity=".7"/>`,
  lipstick: (c: string) =>
    `<g transform="rotate(-14 600 600)"><rect x="500" y="560" width="200" height="400" rx="26" fill="#1f1f24"/><rect x="500" y="560" width="200" height="400" rx="26" fill="url(#gloss)" opacity=".4"/><rect x="520" y="440" width="160" height="140" rx="12" fill="#c9a24a"/><path d="M540 450 L540 300 Q600 220 660 260 L660 450 Z" fill="${c}"/></g>`,
  tshirt: (c: string) =>
    `<path d="M430 260 L330 310 L240 470 L350 530 L400 470 L400 930 L800 930 L800 470 L850 530 L960 470 L870 310 L770 260 Q700 330 600 330 Q500 330 430 260 Z" fill="${c}"/><path d="M430 260 Q500 330 600 330 Q700 330 770 260 Q700 300 600 300 Q500 300 430 260 Z" fill="${shade(c, -30)}"/><path d="M400 470 L400 930 L800 930 L800 470" fill="url(#gloss)" opacity=".25"/>`,
  robe: (c: string) =>
    `<path d="M500 220 L700 220 L760 330 L860 950 L340 950 L440 330 Z" fill="${c}"/><path d="M560 220 L600 330 L640 220 Z" fill="${shade(c, 35)}"/><path d="M600 330 L600 950" stroke="${shade(c, -25)}" stroke-width="6"/><path d="M440 330 L340 950 L600 950 L600 330 Z" fill="url(#gloss)" opacity=".2"/>`,
  shoe: (c: string) =>
    `<path d="M260 760 Q260 560 400 520 L560 500 Q640 560 760 600 Q930 640 950 760 Z" fill="${c}"/><path d="M250 760 L960 760 Q970 830 900 840 L300 840 Q240 830 250 760 Z" fill="#f4f4f5"/><path d="M420 540 L470 640 M480 528 L530 630 M540 518 L590 620" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M260 760 Q260 560 400 520 L560 500 Q640 560 760 600 Q930 640 950 760 Z" fill="url(#gloss)" opacity=".35"/>`,
  bag: (c: string) =>
    `<path d="M470 470 Q470 300 600 300 Q730 300 730 470" fill="none" stroke="${shade(c, -35)}" stroke-width="34"/><path d="M340 470 L860 470 L900 930 L300 930 Z" fill="${c}"/><path d="M340 470 L860 470 L900 930 L300 930 Z" fill="url(#gloss)" opacity=".35"/><rect x="560" y="560" width="80" height="60" rx="10" fill="#c9a24a"/>`,
  ring: (c: string) =>
    `<circle cx="600" cy="660" r="230" fill="none" stroke="${c}" stroke-width="60"/><circle cx="600" cy="660" r="230" fill="none" stroke="#fff" stroke-width="10" opacity=".45"/><path d="M520 400 L600 300 L680 400 L600 470 Z" fill="#e0f2fe"/><path d="M520 400 L680 400 L600 470 Z" fill="#bae6fd"/><path d="M560 400 L600 300 L640 400 Z" fill="#fff" opacity=".7"/>`,
  necklace: (c: string) =>
    `<path d="M330 260 Q600 900 870 260" fill="none" stroke="${c}" stroke-width="16" stroke-dasharray="4 18" stroke-linecap="round"/><path d="M600 700 L540 790 L600 900 L660 790 Z" fill="${c}"/><path d="M600 700 L540 790 L600 900 Z" fill="#fff" opacity=".35"/>`,
  sofa: (c: string) =>
    `<rect x="250" y="440" width="700" height="280" rx="60" fill="${shade(c, -15)}"/><rect x="200" y="560" width="150" height="300" rx="50" fill="${c}"/><rect x="850" y="560" width="150" height="300" rx="50" fill="${c}"/><rect x="320" y="640" width="560" height="200" rx="40" fill="${c}"/><rect x="320" y="640" width="560" height="200" rx="40" fill="url(#gloss)" opacity=".3"/><rect x="260" y="860" width="30" height="80" fill="#3f3f46"/><rect x="910" y="860" width="30" height="80" fill="#3f3f46"/>`,
  lamp: (c: string) =>
    `<path d="M430 260 L770 260 L860 520 L340 520 Z" fill="${c}"/><path d="M430 260 L770 260 L860 520 L340 520 Z" fill="url(#gloss)" opacity=".4"/><rect x="585" y="520" width="30" height="340" fill="#52525b"/><ellipse cx="600" cy="900" rx="170" ry="40" fill="#3f3f46"/><ellipse cx="600" cy="540" rx="200" ry="30" fill="#fef3c7" opacity=".6"/>`,
  pot: (c: string) =>
    `<rect x="330" y="500" width="540" height="380" rx="50" fill="${c}"/><rect x="330" y="500" width="540" height="380" rx="50" fill="url(#gloss)" opacity=".45"/><rect x="230" y="560" width="120" height="40" rx="20" fill="#27272a"/><rect x="850" y="560" width="120" height="40" rx="20" fill="#27272a"/><ellipse cx="600" cy="490" rx="300" ry="50" fill="${shade(c, -30)}"/><rect x="560" y="400" width="80" height="60" rx="18" fill="#27272a"/>`,
  produce: (c: string) =>
    `<ellipse cx="600" cy="860" rx="360" ry="90" fill="#a16207"/><circle cx="470" cy="700" r="150" fill="${c}"/><circle cx="730" cy="700" r="150" fill="${shade(c, 25)}"/><circle cx="600" cy="560" r="150" fill="${shade(c, -15)}"/><path d="M600 410 Q620 360 670 350" stroke="#3f6212" stroke-width="16" fill="none"/><ellipse cx="680" cy="355" rx="40" ry="20" fill="#65a30d"/><circle cx="550" cy="510" r="40" fill="#fff" opacity=".35"/>`,
  box: (c: string) =>
    `<path d="M420 260 L780 260 L780 940 L420 940 Z" fill="${c}"/><path d="M780 260 L860 300 L860 900 L780 940 Z" fill="${shade(c, -35)}"/><rect x="450" y="420" width="300" height="300" rx="24" fill="#fff" opacity=".9"/><circle cx="600" cy="560" r="90" fill="${shade(c, 20)}"/><rect x="470" y="770" width="260" height="22" rx="11" fill="#fff" opacity=".7"/>`,
  can: (c: string) =>
    `<rect x="440" y="300" width="320" height="620" rx="40" fill="${c}"/><rect x="440" y="300" width="320" height="620" rx="40" fill="url(#gloss)" opacity=".5"/><ellipse cx="600" cy="300" rx="160" ry="30" fill="#d4d4d8"/><rect x="440" y="520" width="320" height="160" fill="#fff" opacity=".85"/><rect x="490" y="585" width="220" height="24" rx="12" fill="${shade(c, -30)}"/>`,
  pills: (c: string) =>
    `<rect x="420" y="420" width="360" height="500" rx="50" fill="#f8fafc"/><rect x="420" y="420" width="360" height="500" rx="50" fill="url(#gloss)" opacity=".4"/><rect x="400" y="310" width="400" height="140" rx="30" fill="${c}"/><rect x="460" y="580" width="280" height="200" rx="18" fill="${c}" opacity=".9"/><rect x="560" y="620" width="80" height="120" rx="10" fill="#fff"/><rect x="540" y="640" width="120" height="80" rx="10" fill="#fff"/><g transform="rotate(-30 850 860)"><rect x="770" y="830" width="180" height="70" rx="35" fill="${c}"/><rect x="860" y="830" width="90" height="70" rx="35" fill="#fff"/></g>`,
  book: (c: string) =>
    `<g transform="rotate(-6 600 600)"><rect x="380" y="260" width="460" height="660" rx="16" fill="${c}"/><rect x="380" y="260" width="60" height="660" fill="${shade(c, -35)}"/><rect x="500" y="380" width="280" height="40" rx="8" fill="#fff" opacity=".85"/><rect x="500" y="440" width="200" height="22" rx="8" fill="#fff" opacity=".6"/><rect x="840" y="280" width="24" height="620" fill="#f5f5f4"/></g>`,
  blocks: (c: string) =>
    `<rect x="300" y="640" width="280" height="280" rx="26" fill="${c}"/><rect x="620" y="640" width="280" height="280" rx="26" fill="#f59e0b"/><rect x="460" y="360" width="280" height="280" rx="26" fill="#22c55e"/><g fill="#fff" opacity=".85" font-family="Arial" font-weight="700" font-size="150" text-anchor="middle"><text x="440" y="835">A</text><text x="760" y="835">B</text><text x="600" y="555">C</text></g>`,
  dumbbell: (c: string) =>
    `<rect x="380" y="575" width="440" height="50" rx="20" fill="#a1a1aa"/><rect x="250" y="420" width="90" height="360" rx="26" fill="${c}"/><rect x="340" y="470" width="70" height="260" rx="20" fill="${shade(c, -25)}"/><rect x="860" y="420" width="90" height="360" rx="26" fill="${c}"/><rect x="790" y="470" width="70" height="260" rx="20" fill="${shade(c, -25)}"/>`,
  ball: (c: string) =>
    `<circle cx="600" cy="600" r="320" fill="#fafafa"/><path d="M600 400 L700 470 L665 590 L535 590 L500 470 Z" fill="${c}"/><path d="M600 280 L600 400 M700 470 L860 430 M665 590 L760 720 M535 590 L440 720 M500 470 L340 430" stroke="${c}" stroke-width="14"/><circle cx="600" cy="600" r="320" fill="url(#gloss)" opacity=".4"/>`,
  tire: (c: string) =>
    `<circle cx="600" cy="600" r="340" fill="#18181b"/><circle cx="600" cy="600" r="210" fill="${c}"/><circle cx="600" cy="600" r="70" fill="#3f3f46"/><g stroke="#3f3f46" stroke-width="34">${[0, 72, 144, 216, 288].map((a) => `<line x1="600" y1="600" x2="${600 + 190 * Math.cos((a * Math.PI) / 180)}" y2="${600 + 190 * Math.sin((a * Math.PI) / 180)}"/>`).join("")}</g><circle cx="600" cy="600" r="300" fill="none" stroke="#27272a" stroke-width="16" stroke-dasharray="20 22"/>`,
  oil: (c: string) =>
    `<path d="M400 360 L740 360 L800 440 L800 930 L400 930 Z" fill="${c}"/><path d="M640 300 L740 300 L740 360 L640 360 Z" fill="#27272a"/><path d="M800 520 Q900 520 900 640 Q900 760 800 760" fill="none" stroke="${shade(c, -30)}" stroke-width="40"/><rect x="450" y="560" width="300" height="220" rx="16" fill="#fff" opacity=".9"/><rect x="490" y="630" width="220" height="26" rx="13" fill="${shade(c, -30)}"/>`,
  petfood: (c: string) =>
    `<path d="M380 300 L820 300 L860 940 L340 940 Z" fill="${c}"/><rect x="380" y="270" width="440" height="60" rx="12" fill="${shade(c, -30)}"/><circle cx="600" cy="640" r="150" fill="#fff" opacity=".9"/><g fill="${shade(c, -20)}"><ellipse cx="600" cy="690" rx="56" ry="46"/><circle cx="530" cy="610" r="24"/><circle cx="575" cy="580" r="24"/><circle cx="625" cy="580" r="24"/><circle cx="670" cy="610" r="24"/></g>`,
  bouquet: (c: string) =>
    `<path d="M430 620 L770 620 L640 960 L560 960 Z" fill="#f5f5f4"/><path d="M430 620 L600 960 L560 960 Z" fill="#e7e5e4"/><g>${[[480, 470], [600, 400], [720, 470], [540, 560], [660, 560]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 1 ? 110 : 95}" fill="${i % 2 ? c : shade(c, 30)}"/><circle cx="${x}" cy="${y}" r="34" fill="${shade(c, -35)}"/>`).join("")}</g><ellipse cx="470" cy="610" rx="60" ry="26" fill="#65a30d" transform="rotate(-25 470 610)"/><ellipse cx="730" cy="610" rx="60" ry="26" fill="#65a30d" transform="rotate(25 730 610)"/>`,
  gift: (c: string) =>
    `<rect x="330" y="500" width="540" height="420" rx="24" fill="${c}"/><rect x="300" y="420" width="600" height="130" rx="20" fill="${shade(c, -20)}"/><rect x="560" y="420" width="80" height="500" fill="#fde68a"/><path d="M600 420 Q470 280 430 380 Q420 430 600 420 Q730 280 770 380 Q780 430 600 420" fill="#fbbf24"/><rect x="330" y="500" width="540" height="420" rx="24" fill="url(#gloss)" opacity=".3"/>`,
  card: (c: string) =>
    `<g transform="rotate(-10 600 600)"><rect x="250" y="380" width="700" height="440" rx="40" fill="${c}"/><rect x="250" y="380" width="700" height="440" rx="40" fill="url(#gloss)" opacity=".45"/><rect x="310" y="460" width="120" height="90" rx="16" fill="#fde68a"/><rect x="310" y="700" width="380" height="30" rx="15" fill="#fff" opacity=".7"/><circle cx="830" cy="720" r="50" fill="#fff" opacity=".5"/></g>`,
  plate: (c: string) =>
    `<ellipse cx="600" cy="680" rx="380" ry="200" fill="#fafafa"/><ellipse cx="600" cy="670" rx="300" ry="150" fill="#f4f4f5"/><ellipse cx="600" cy="610" rx="220" ry="90" fill="${shade(c, -20)}"/><ellipse cx="600" cy="580" rx="200" ry="80" fill="${c}"/><ellipse cx="560" cy="560" rx="60" ry="20" fill="#fff" opacity=".35"/><circle cx="700" cy="560" r="26" fill="#16a34a"/><circle cx="500" cy="590" r="22" fill="#dc2626"/>`,
  cup: (c: string) =>
    `<path d="M380 400 L820 400 L770 900 L430 900 Z" fill="${c}"/><path d="M380 400 L820 400 L770 900 L430 900 Z" fill="url(#gloss)" opacity=".35"/><rect x="360" y="340" width="480" height="80" rx="30" fill="#f4f4f5"/><rect x="420" y="560" width="360" height="160" fill="#fff" opacity=".85"/><path d="M560 300 Q540 240 580 200 M640 300 Q620 240 660 200" stroke="#d4d4d8" stroke-width="14" fill="none" stroke-linecap="round"/>`,
  vase: (c: string) =>
    `<path d="M520 260 L680 260 L670 340 Q840 480 800 720 Q770 930 600 940 Q430 930 400 720 Q360 480 530 340 Z" fill="${c}"/><path d="M420 600 Q600 650 780 600" stroke="#fff" stroke-width="18" opacity=".5" fill="none"/><path d="M520 260 L680 260 L670 340 Q840 480 800 720 Q770 930 600 940 Q430 930 400 720 Q360 480 530 340 Z" fill="url(#gloss)" opacity=".35"/>`,
  glasses: (c: string) =>
    `<g fill="none" stroke="${c}" stroke-width="30"><circle cx="440" cy="620" r="150"/><circle cx="760" cy="620" r="150"/><path d="M590 600 Q600 570 610 600"/><path d="M290 590 L200 520"/><path d="M910 590 L1000 520"/></g><circle cx="440" cy="620" r="135" fill="#1e293b" opacity=".75"/><circle cx="760" cy="620" r="135" fill="#1e293b" opacity=".75"/><path d="M370 560 Q420 520 470 540" stroke="#fff" stroke-width="14" opacity=".5" fill="none"/>`,
  drill: (c: string) =>
    `<rect x="300" y="380" width="480" height="200" rx="60" fill="${c}"/><rect x="780" y="440" width="120" height="80" rx="12" fill="#3f3f46"/><rect x="900" y="465" width="120" height="30" rx="8" fill="#a1a1aa"/><path d="M460 560 L580 560 L620 860 L440 860 Z" fill="${shade(c, -25)}"/><rect x="400" y="840" width="260" height="110" rx="24" fill="#27272a"/><rect x="300" y="380" width="480" height="200" rx="60" fill="url(#gloss)" opacity=".4"/>`,
  wrench: (c: string) =>
    `<g transform="rotate(-40 600 600)"><rect x="560" y="300" width="80" height="560" rx="30" fill="${c}"/><path d="M500 180 a110 110 0 1 0 200 0 l-50 60 l-100 0 Z" fill="${c}"/><circle cx="600" cy="900" r="80" fill="${c}"/><circle cx="600" cy="900" r="36" fill="#f4f4f5"/></g>`,
  gamepad: (c: string) =>
    `<path d="M330 480 Q330 400 420 400 L780 400 Q870 400 870 480 L940 760 Q960 860 860 860 Q800 860 760 780 L440 780 Q400 860 340 860 Q240 860 260 760 Z" fill="${c}"/><g fill="#fff" opacity=".85"><rect x="380" y="545" width="120" height="36" rx="10"/><rect x="422" y="503" width="36" height="120" rx="10"/><circle cx="740" cy="530" r="24"/><circle cx="800" cy="590" r="24"/><circle cx="680" cy="590" r="24"/><circle cx="740" cy="650" r="24"/></g>`,
  baby: (c: string) =>
    `<rect x="500" y="420" width="200" height="460" rx="70" fill="#f8fafc"/><rect x="500" y="420" width="200" height="460" rx="70" fill="url(#gloss)" opacity=".4"/><rect x="480" y="350" width="240" height="90" rx="26" fill="${c}"/><path d="M560 350 Q560 220 600 210 Q640 220 640 350 Z" fill="#fde68a"/><g stroke="${c}" stroke-width="10" opacity=".6"><line x1="530" y1="560" x2="580" y2="560"/><line x1="530" y1="640" x2="580" y2="640"/><line x1="530" y1="720" x2="580" y2="720"/></g>`,
} satisfies Record<string, (c: string) => string>;

export type ObjectKind = keyof typeof objects;
export type ArtKind = ObjectKind | DeviceKind;
export const ART_KINDS = [...Object.keys(objects), ...DEVICE_KINDS] as ArtKind[];

function inner(kind: ArtKind, color: string, view = 0) {
  if ((DEVICE_KINDS as string[]).includes(kind)) return devices[kind as DeviceKind](color, view);
  return objects[kind as ObjectKind](color);
}

const BACKDROPS: [string, string][] = [
  ["#f8f8fa", "#e6e8ee"],
  ["#fbfaf8", "#ebe7e1"],
  ["#f6f8f7", "#e1e8e4"],
];

/** Square packshot (product / category tile). */
export function packshot(kind: ArtKind, color: string, view = 0) {
  return frame(inner(kind, color, view), { bg: BACKDROPS[view % BACKDROPS.length] });
}

/**
 * Wide banner / hero background: gradient, soft light, the object on the
 * "end" side (copy sits on the other side). Sized per device: desktop 2400×900,
 * tablet 1600×800, mobile 1080×720 — landscape everywhere so the hero stays
 * short on phones.
 */
export function heroArt(opts: { from: string; to: string; accent: string; kind: ArtKind; color: string; width: number; height: number; mirror?: boolean }) {
  const { width: w, height: h } = opts;
  const size = Math.min(h * 0.95, w * 0.5);
  const cx = opts.mirror ? w * 0.26 : w * 0.74;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${opts.from}"/><stop offset="1" stop-color="${opts.to}"/></linearGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${opts.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${opts.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".5" stop-color="#4338ca"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient>
<linearGradient id="screen2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7c2d12"/><stop offset=".55" stop-color="#ea580c"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#hg)"/>
<circle cx="${cx}" cy="${h * 0.5}" r="${h * 0.6}" fill="url(#glow)"/>
<g opacity=".07" stroke="#fff">${Array.from({ length: 12 }, (_, i) => `<line x1="${i * (w / 11)}" y1="0" x2="${i * (w / 11) - h * 0.4}" y2="${h}"/>`).join("")}</g>
<g transform="translate(${cx - size / 2} ${h / 2 - size / 2}) scale(${size / 1200})">${inner(opts.kind, opts.color)}</g>
</svg>`;
}

/** Wordmark logo for a demo brand (original typography). */
export function wordmark(name: string, color: string) {
  const safe = name.replace(/[<&>"]/g, "");
  const size = safe.length > 12 ? 58 : safe.length > 8 ? 70 : 82;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><rect width="600" height="240" fill="#ffffff"/><text x="300" y="${120 + size / 3}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" letter-spacing="-1" fill="${color}">${safe}</text></svg>`;
}
