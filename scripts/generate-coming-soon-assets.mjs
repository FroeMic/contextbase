import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const sharp = (await import("../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js"))
  .default

const outDir = new URL("../apps/web/public/assets/coming-soon/", import.meta.url)

const palette = {
  bg: "#f7f5ef",
  black: "#111111",
  border: "#dedbd2",
  green: "#16c58a",
  ink: "#22231f",
  muted: "#777a73",
  paper: "#fffefa",
  pink: "#ec5fa4",
  purple: "#7c5cff",
  yellow: "#f8c342",
}

function svgShell(content, defs = "") {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#111111" flood-opacity="0.16"/>
        </filter>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#111111" flood-opacity="0.12"/>
        </filter>
        <linearGradient id="sunset" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#f5d2ff"/>
          <stop offset="0.5" stop-color="#ffd76b"/>
          <stop offset="1" stop-color="#ff8e58"/>
        </linearGradient>
        <linearGradient id="mint" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#d8fff3"/>
          <stop offset="1" stop-color="#e9e0ff"/>
        </linearGradient>
        <linearGradient id="night" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#111214"/>
          <stop offset="1" stop-color="#25262c"/>
        </linearGradient>
        ${defs}
      </defs>
      <rect width="1600" height="900" fill="${palette.bg}"/>
      ${content}
    </svg>
  `
}

function text(x, y, value, size, weight = 600, color = palette.ink, extra = "") {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0" ${extra}>${value}</text>`
}

function rounded(x, y, w, h, fill, stroke = palette.border, radius = 24, extra = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" ${extra}/>`
}

function productUpdateVisuals() {
  return svgShell(`
    <rect x="70" y="72" width="1460" height="756" rx="34" fill="url(#mint)"/>
    ${rounded(190, 150, 1220, 610, palette.paper, "#ece8dc", 26, 'filter="url(#shadow)"')}
    ${rounded(190, 150, 1220, 58, "#f2efe7", "#e1ddd2", 26)}
    <circle cx="229" cy="179" r="8" fill="#ff8c72"/><circle cx="257" cy="179" r="8" fill="#ffc45b"/><circle cx="285" cy="179" r="8" fill="#71dba3"/>
    ${rounded(645, 165, 310, 28, "#ffffff", "#ded9cd", 14)}
    ${text(721, 185, "launch.electricvisuals.app", 18, 700, palette.muted)}
    <rect x="230" y="238" width="270" height="480" rx="16" fill="#171816"/>
    ${text(265, 291, "Launch brief", 32, 760, "#ffffff")}
    ${text(265, 335, "Product update", 20, 600, "#b9bbb4")}
    ${rounded(265, 380, 192, 36, "#292b27", "#363832", 18)}
    ${text(289, 404, "Feature shipped", 18, 720, "#f8f7f2")}
    ${rounded(265, 436, 160, 36, "#292b27", "#363832", 18)}
    ${text(289, 460, "Founder note", 18, 720, "#f8f7f2")}
    ${rounded(265, 492, 178, 36, "#292b27", "#363832", 18)}
    ${text(289, 516, "Changelog", 18, 720, "#f8f7f2")}
    <path d="M265 606 C315 565 380 572 430 526" fill="none" stroke="${palette.green}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="265" cy="606" r="11" fill="${palette.green}"/><circle cx="430" cy="526" r="11" fill="${palette.green}"/>
    ${text(545, 292, "New workspace analytics", 42, 760)}
    ${text(545, 336, "Generate explainers for a product launch from saved visual direction.", 22, 520, palette.muted)}
    ${rounded(545, 382, 360, 160, "#fbfaf6", "#e5e0d4", 20)}
    ${text(580, 430, "Approved direction", 19, 700, palette.muted)}
    ${text(580, 480, "Clean interface", 30, 760)}
    ${text(580, 518, "Warm gradient / product close-up", 19, 520, palette.muted)}
    ${rounded(930, 382, 360, 160, "#fbfaf6", "#e5e0d4", 20)}
    ${text(965, 430, "Generated options", 19, 700, palette.muted)}
    <rect x="965" y="458" width="72" height="52" rx="10" fill="${palette.purple}"/>
    <rect x="1052" y="458" width="72" height="52" rx="10" fill="${palette.yellow}"/>
    <rect x="1139" y="458" width="72" height="52" rx="10" fill="${palette.green}"/>
    ${rounded(545, 580, 745, 96, "#111111", "#111111", 22)}
    ${text(584, 637, "Approve visual set", 26, 760, "#ffffff")}
    <path d="M1237 625 l18 18 l36 -44" fill="none" stroke="${palette.green}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    ${rounded(1110, 248, 228, 74, "#ffffff", "#e2ded3", 18, 'filter="url(#soft)"')}
    ${text(1141, 294, "3 ready to post", 25, 760)}
  `)
}

function docsWebsiteVisuals() {
  return svgShell(`
    <rect x="70" y="72" width="1460" height="756" rx="34" fill="url(#sunset)"/>
    ${rounded(330, 130, 940, 610, "#ffffff", "#efe8dc", 22, 'filter="url(#shadow)"')}
    <rect x="330" y="130" width="940" height="64" rx="22" fill="#fff5e4"/>
    ${rounded(646, 148, 308, 30, "#fffefa", "#eadfce", 15)}
    ${text(707, 169, "docs.newbrand.com", 17, 720, palette.muted)}
    <rect x="330" y="194" width="214" height="546" fill="#261032"/>
    <circle cx="380" cy="242" r="18" fill="#ffffff"/>
    ${text(414, 250, "Zenflow", 25, 760, "#ffffff")}
    ${text(382, 310, "Guides", 20, 740, "#ffffff")}
    ${text(382, 358, "Payments", 20, 620, "#d9a9e8")}
    ${text(382, 406, "Reporting", 20, 620, "#ffffff")}
    ${text(382, 454, "Brand kit", 20, 620, "#ffffff")}
    ${text(590, 278, "Illustrated setup guide", 34, 760, "#8b2c78")}
    ${rounded(590, 318, 610, 88, "#fffafe", "#f0c8e5", 18, 'stroke-dasharray="8 8"')}
    ${rounded(590, 432, 295, 170, "#fff8fc", "#f0c8e5", 18)}
    ${text(625, 482, "Step 01", 20, 760, palette.muted)}
    ${text(625, 528, "Connect account", 30, 760)}
    ${rounded(625, 552, 210, 32, "#f7d7ec", "#f7d7ec", 16)}
    ${rounded(905, 432, 295, 170, "#fff8fc", "#f0c8e5", 18)}
    ${text(940, 482, "Step 02", 20, 760, palette.muted)}
    ${text(940, 528, "Generate assets", 30, 760)}
    ${rounded(940, 552, 210, 32, "#f7d7ec", "#f7d7ec", 16)}
    ${rounded(180, 380, 440, 118, "#ffffff", "#e5e7ef", 16, 'filter="url(#soft)"')}
    ${text(212, 431, "Docs callout", 25, 760)}
    ${text(212, 466, "Show a visual answer next to the setup step.", 18, 600, "#647086")}
    <rect x="180" y="498" width="440" height="44" fill="#f5f7fb"/>
    ${text(212, 527, "electricVisuals.create('docs-callout');", 19, 700, "#2d3442")}
    ${rounded(1035, 555, 440, 116, "#ffffff", "#e5e7ef", 16, 'filter="url(#soft)"')}
    ${text(1067, 605, "Website hero asset", 25, 760)}
    ${text(1067, 640, "Use the same direction for landing pages.", 18, 600, "#647086")}
    <rect x="1035" y="671" width="440" height="44" fill="#f5f7fb"/>
    ${text(1067, 700, "electricVisuals.create('hero-visual');", 19, 700, "#2d3442")}
  `)
}

function remixAssetSystem() {
  return svgShell(`
    <rect x="70" y="72" width="1460" height="756" rx="34" fill="#f3f1e9"/>
    ${text(150, 160, "Approved look", 38, 760)}
    ${text(150, 204, "One saved direction becomes many formats.", 22, 520, palette.muted)}
    ${rounded(150, 250, 360, 430, "#111111", "#111111", 28, 'filter="url(#shadow)"')}
    <rect x="190" y="300" width="280" height="180" rx="20" fill="url(#sunset)"/>
    <circle cx="270" cy="390" r="48" fill="#fffefa" opacity="0.86"/>
    <path d="M330 328 C386 334 432 374 450 440" stroke="#111111" stroke-width="12" fill="none" stroke-linecap="round"/>
    ${text(190, 546, "Founder product note", 29, 760, "#ffffff")}
    ${text(190, 586, "Warm editorial / simple UI / high contrast", 18, 560, "#bfc0bc")}
    ${rounded(190, 620, 150, 36, "#2a2b28", "#3a3b37", 18)}
    ${text(214, 644, "Approved", 18, 760, palette.green)}
    <path d="M560 460 C650 360 730 360 820 460" stroke="${palette.muted}" stroke-width="5" fill="none" stroke-dasharray="12 16"/>
    <path d="M810 446 l25 14 l-25 14" fill="none" stroke="${palette.muted}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${rounded(850, 160, 260, 190, "#ffffff", "#dfdcd2", 20, 'filter="url(#soft)"')}
    <rect x="880" y="196" width="200" height="88" rx="14" fill="url(#mint)"/>
    ${text(880, 318, "Social post", 25, 760)}
    ${rounded(1160, 210, 300, 180, "#ffffff", "#dfdcd2", 20, 'filter="url(#soft)"')}
    <rect x="1190" y="248" width="104" height="104" rx="14" fill="${palette.yellow}"/>
    <rect x="1310" y="248" width="104" height="104" rx="14" fill="${palette.purple}"/>
    ${text(1190, 366, "Deck slide", 25, 760)}
    ${rounded(805, 440, 320, 210, "#ffffff", "#dfdcd2", 20, 'filter="url(#soft)"')}
    ${text(845, 500, "Docs banner", 25, 760)}
    <rect x="845" y="530" width="240" height="70" rx="14" fill="#151515"/>
    <path d="M875 568 h150" stroke="${palette.green}" stroke-width="9" stroke-linecap="round"/>
    ${rounded(1180, 515, 260, 185, "#ffffff", "#dfdcd2", 20, 'filter="url(#soft)"')}
    ${text(1220, 574, "Video frame", 25, 760)}
    <circle cx="1295" cy="627" r="38" fill="#111111"/>
    <path d="M1284 606 l38 21 l-38 22 z" fill="#ffffff"/>
  `)
}

await mkdir(outDir, { recursive: true })

const assets = [
  ["product-update-visuals.png", productUpdateVisuals()],
  ["docs-website-visuals.png", docsWebsiteVisuals()],
  ["remix-asset-system.png", remixAssetSystem()],
]

for (const [filename, svg] of assets) {
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(filename, outDir)))
}
