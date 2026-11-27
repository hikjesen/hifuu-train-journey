// Equirectangular coordinates are measured from the top of the source images.
// The film opens at the same sky alignment as the original still.
const SKY_WIND_HEIGHT = 7600;
function cloudOffset(time) {
  const seconds = time - 13.6;
  return [(14 - 34) * seconds / SKY_WIND_HEIGHT, 29 * seconds / SKY_WIND_HEIGHT];
}
const solarAz = -42.8 * DEG, solarAlt = 7.7 * DEG;
const lunarAz = 19.2 * DEG, lunarAlt = 19.65 * DEG;
const lunar = {
  u: .5 + lunarAz / TAU, v: .5 - lunarAlt / Math.PI,
  direction: [Math.sin(lunarAz) * Math.cos(lunarAlt), Math.sin(lunarAlt), -Math.cos(lunarAz) * Math.cos(lunarAlt)],
  scaleX: 360 * Math.cos(lunarAlt) / .37, scaleY: 180 / .37,
  east: Math.cos(solarAlt) * Math.sin(solarAz - lunarAz),
  up: Math.sin(solarAlt) * Math.cos(lunarAlt) -
      Math.cos(solarAlt) * Math.sin(lunarAlt) * Math.cos(solarAz - lunarAz),
  depth: -(Math.sin(solarAlt) * Math.sin(lunarAlt) +
      Math.cos(solarAlt) * Math.cos(lunarAlt) * Math.cos(solarAz - lunarAz))
};

function mixSkyTexels(a, b, fraction) {
  if (a === b) return a;
  const weight = Math.round(fraction * 256), rest = 256 - weight;
  const byte = shift => ((((a >>> shift) & 255) * rest + ((b >>> shift) & 255) * weight + 128) >>> 8);
  return (byte(24) << 24 | byte(16) << 16 | byte(8) << 8 | byte(0)) >>> 0;
}

class SoftwareSkyLayers {
  constructor(image) {
    const plate = readPlate(image, 2048);
    this.width = plate.w;
    this.height = plate.h;
    this.pixels = plate.data;
    // Filtering in premultiplied space keeps the edges of fine ice clouds coloured.
    for (let i = 0; i < this.pixels.length; i++) {
      const p = this.pixels[i], a = p >>> 24, weight = a / 255;
      this.pixels[i] = (a << 24 | Math.round((p >>> 16 & 255) * weight) << 16 |
        Math.round((p >>> 8 & 255) * weight) << 8 | Math.round((p & 255) * weight)) >>> 0;
    }
  }
  optics(u, v) {
    if (v >= .5) return 0;
    const x = Math.floor(u * this.width) & (this.width - 1);
    const y = clamp(Math.floor(v * this.height), 0, this.height / 2 - 1);
    return this.pixels[y * this.width + x];
  }
  cirrus(u, v) {
    const w = this.width, h = this.height, band = h / 2;
    const x = u * w - .5, y = clamp(v * h - .5, 0, band - 1);
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const left = ix & (w - 1), right = (ix + 1) & (w - 1);
    const top = (band + iy) * w, bottom = Math.min(h - 1, band + iy + 1) * w;
    const p = this.pixels;
    return mixSkyTexels(mixSkyTexels(p[top + left], p[top + right], fx),
      mixSkyTexels(p[bottom + left], p[bottom + right], fx), fy);
  }
  composite(base, optics, worldU, worldV, cloudU, cloudV) {
    const ice = this.cirrus(cloudU, cloudV);
    const mx = (worldU - lunar.u) * lunar.scaleX, my = (lunar.v - worldV) * lunar.scaleY;
    const radius2 = mx * mx + my * my;
    if (!ice && radius2 >= 1.3225) return base;
    const transmission = (optics >>> 24) / 255, cover = (ice >>> 24) / 255;
    const airR = optics & 255, airG = optics >>> 8 & 255, airB = optics >>> 16 & 255;
    let r = (base & 255) + transmission * (ice & 255) - cover * airR;
    let g = (base >>> 8 & 255) + transmission * (ice >>> 8 & 255) - cover * airG;
    let b = (base >>> 16 & 255) + transmission * (ice >>> 16 & 255) - cover * airB;
    if (radius2 < 1.3225) {
      const incidence = mx * lunar.east + my * lunar.up + Math.sqrt(Math.max(0, 1 - radius2)) * lunar.depth;
      const light = smooth(-.045, .17, incidence) * (.88 + .12 * Math.sqrt(Math.max(0, incidence)));
      const disc = (1 - smooth(.87, 1.15, Math.sqrt(radius2))) * (1 - cover);
      const dark = .055 * (1 - light), air = light + dark;
      r += disc * (transmission * (255 * light + 182 * dark) - air * airR);
      g += disc * (transmission * (244 * light + 194 * dark) - air * airG);
      b += disc * (transmission * (216 * light + 225 * dark) - air * airB);
    }
    return rgbWord(r + .5, g + .5, b + .5);
  }
}
