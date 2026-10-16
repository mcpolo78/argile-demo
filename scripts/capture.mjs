/**
 * Captures d'écran et animation du README, à partir du serveur de dev.
 *
 *   npm run dev            (dans un autre terminal)
 *   npm run capture        → docs/*.png + docs/demo.webp
 *
 * Chromium headless rend le WebGL avec SwiftShader : pas besoin de GPU.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function ouvrir(path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(2500); // compilation des shaders, ombres, chargement du GLB
}
const bouton = (nom) => page.getByRole("button", { name: nom, exact: true });
const curseur = (label) => page.getByLabel(label, { exact: false });
const rendu = () => page.waitForTimeout(350);

// 1. Accueil, paramètres par défaut.
await ouvrir("/");
await page.screenshot({ path: `${OUT}/configurateur.png` });

// 2. Maison à étage, toit 4 pans, fenêtres et PAC sélectionnées.
await curseur("Niveaux").fill("2");
await curseur("Longueur").fill("13");
await bouton("4 pans").click();
await page.getByLabel("Remplacement des fenêtres").check();
await page.getByLabel("Pompe à chaleur air-eau").check();
await rendu();
await page.screenshot({ path: `${OUT}/etage-4-pans.png` });

// 3. Version intégrable, dans un format proche d'une iframe.
await page.setViewportSize({ width: 1100, height: 760 });
await ouvrir("/embed");
await page.screenshot({ path: `${OUT}/embed.png` });

// 4. Animation : on fait varier les paramètres, puis on tourne autour de la maison.
await page.setViewportSize({ width: 1440, height: 900 });
await ouvrir("/");
const zone = await page.locator("main > div.grid").boundingBox();
const frames = [];
const delais = [];
async function frame(delai = 140) {
  frames.push(await page.screenshot({ clip: zone }));
  delais.push(delai);
}

await frame(900);
for (const l of ["12", "13"]) {
  await curseur("Longueur").fill(l);
  await rendu();
  await frame();
}
for (const n of ["2"]) {
  await curseur("Niveaux").fill(n);
  await rendu();
  await frame(400);
}
for (const toit of ["4 pans", "Plate", "2 pans"]) {
  await bouton(toit).click();
  await rendu();
  await frame(600);
}
await bouton("Combles aménagés").click();
await rendu();
await frame(600);
for (const poste of ["Remplacement des fenêtres", "Isolation du plancher bas", "Pompe à chaleur air-eau"]) {
  await page.getByLabel(poste).check();
  await rendu();
  await frame(500);
}

// Rotation : glisser dans le canvas, une image par pas.
const canvas = await page.locator("canvas").boundingBox();
const cx = canvas.x + canvas.width / 2;
const cy = canvas.y + canvas.height * 0.6;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 36; i++) {
  await page.mouse.move(cx - i * 16, cy, { steps: 2 });
  await page.waitForTimeout(60);
  await frame(90);
}
await page.mouse.up();
delais[delais.length - 1] = 1200;

await browser.close();

// Assemblage : WebP animé (léger, affiché par GitHub), redimensionné à 1100 px de large.
const largeur = 1100;
const images = await Promise.all(frames.map((f) => sharp(f).resize({ width: largeur }).png().toBuffer()));
await sharp(images, { join: { animated: true } })
  .webp({ quality: 70, effort: 5, loop: 0, delay: delais })
  .toFile(`${OUT}/demo.webp`);

console.log(`${frames.length} images → ${OUT}/demo.webp, captures dans ${OUT}/`);
