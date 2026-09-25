// Regenerates the PNG app icons from the logo SVG. Run after replacing the logo:
//   npm run icons
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PUBLIC_DIR = fileURLToPath(
  new URL("../src/web/public/", import.meta.url),
);
const SOURCE_SVG = `${PUBLIC_DIR}favicon.svg`;

// Must match the logo tile fill: the rounded tile corners are flattened onto it,
// so full-bleed icons show no seam where the tile ends.
const TILE_COLOR = "#B8431F";

// Maskable icons are cropped to a circle of 80% diameter; the glyph has to stay inside it.
const MASKABLE_SAFE_ZONE_RATIO = 0.8;

const RENDER_DENSITY = 1_200;

type IconSpec = {
  file: string;
  size: number;
  isFullBleed: boolean;
  logoRatio: number;
};

const ICONS: IconSpec[] = [
  { file: "icon-192.png", size: 192, isFullBleed: false, logoRatio: 1 },
  { file: "icon-512.png", size: 512, isFullBleed: false, logoRatio: 1 },
  {
    file: "icon-maskable-512.png",
    size: 512,
    isFullBleed: true,
    logoRatio: MASKABLE_SAFE_ZONE_RATIO,
  },
  // iOS fills transparent pixels with black, so the touch icon is opaque and full bleed.
  { file: "apple-touch-icon.png", size: 180, isFullBleed: true, logoRatio: 1 },
];

const renderLogo = (size: number) =>
  sharp(SOURCE_SVG, { density: RENDER_DENSITY })
    .resize(size, size)
    .png()
    .toBuffer();

const generateIcon = async ({
  file,
  size,
  isFullBleed,
  logoRatio,
}: IconSpec) => {
  const logoSize = Math.round(size * logoRatio);
  const logo = await renderLogo(logoSize);
  const output = `${PUBLIC_DIR}${file}`;

  if (!isFullBleed) {
    await sharp(logo).png().toFile(output);
    return output;
  }

  await sharp({
    create: { width: size, height: size, channels: 3, background: TILE_COLOR },
  })
    .composite([{ input: logo, gravity: "center" }])
    .flatten({ background: TILE_COLOR })
    .removeAlpha()
    .png()
    .toFile(output);
  return output;
};

for (const icon of ICONS) {
  console.log(`[icons] wrote ${await generateIcon(icon)}`);
}
