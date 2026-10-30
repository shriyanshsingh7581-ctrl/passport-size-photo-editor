/**
 * MALNADU MEDIA — High-Resolution AI Background Segmentation, Hair Edge Matting,
 * Blue Color Spill Decontamination & Non-Destructive Spot Healing Engine.
 *
 * Key guarantees:
 * 1. Always preserves 100% of the original uploaded image resolution (naturalWidth × naturalHeight).
 * 2. Generates an alpha transparency mask and applies it to the full-resolution original pixels.
 * 3. Includes dedicated Hair Edge Matting & Foreground Color Decontamination to eliminate
 *    blue/colored background spill around fine hair strands without altering clothing or face colors.
 * 4. Includes patch-based texture-preserving Spot Healing for blemish and pimple removal.
 */

let rmbgModel: any = null;
let rmbgProcessor: any = null;
let isModelLoading = false;

export interface HairMattingOptions {
  /** Edge threshold / choke (-50 to +50, default 0) */
  edgeShift: number;
  /** Edge feathering radius in px (0 to 10, default 1.5) */
  featherRadius: number;
  /** Blue & backdrop color spill removal strength (0 to 100, default 78) */
  blueSpillRemoval: number;
  /** Fine hair strand recovery strength (0 to 100, default 65) */
  hairDetailStrength: number;
}

export const DEFAULT_HAIR_MATTING_OPTIONS: HairMattingOptions = {
  edgeShift: 0,
  featherRadius: 1.5,
  blueSpillRemoval: 78,
  hairDetailStrength: 65,
};

export interface CutoutResult {
  /** Full-resolution cutout canvas (same dimensions as original image) */
  cutoutCanvas: HTMLCanvasElement;
  /** Full-resolution single-channel alpha mask (Uint8Array of length width * height) */
  alphaMask: Uint8Array;
  /** Sampled dominant background RGB color [R, G, B] used for spill decontamination */
  sampledBgColor: [number, number, number];
  width: number;
  height: number;
}

/**
 * Samples the outer border of an image to estimate the dominant studio background color.
 */
export function estimateBackdropColor(
  rgbData: Uint8ClampedArray,
  width: number,
  height: number
): [number, number, number] {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const stepX = Math.max(1, Math.floor(width / 40));
  const stepY = Math.max(1, Math.floor(height / 40));
  const marginX = Math.min(8, Math.floor(width * 0.02));
  const marginY = Math.min(8, Math.floor(height * 0.02));

  // Top border
  for (let x = 0; x < width; x += stepX) {
    const idx = (marginY * width + x) * 4;
    rSum += rgbData[idx];
    gSum += rgbData[idx + 1];
    bSum += rgbData[idx + 2];
    count++;
  }
  // Upper left and right borders (above shoulder line)
  const maxSideY = Math.floor(height * 0.55);
  for (let y = 0; y < maxSideY; y += stepY) {
    const idxL = (y * width + marginX) * 4;
    const idxR = (y * width + Math.max(0, width - 1 - marginX)) * 4;
    rSum += rgbData[idxL] + rgbData[idxR];
    gSum += rgbData[idxL + 1] + rgbData[idxR + 1];
    bSum += rgbData[idxL + 2] + rgbData[idxR + 2];
    count += 2;
  }

  if (count === 0) return [210, 230, 255];
  return [
    Math.round(rSum / count),
    Math.round(gSum / count),
    Math.round(bSum / count),
  ];
}

/**
 * High-Resolution AI Background Removal (RMBG-1.4 + Smart Studio Fallback).
 * Preserves the exact original dimensions (naturalWidth × naturalHeight) of `imgElement`.
 */
export async function runHighResRmbgCutout(
  imgElement: HTMLImageElement,
  onProgress: (pct: number, msg: string) => void,
  mattingOptions: HairMattingOptions = DEFAULT_HAIR_MATTING_OPTIONS
): Promise<CutoutResult> {
  const origW = imgElement.naturalWidth || imgElement.width;
  const origH = imgElement.naturalHeight || imgElement.height;

  // Draw original image at 100% native resolution without any compression
  const origCanvas = document.createElement('canvas');
  origCanvas.width = origW;
  origCanvas.height = origH;
  const origCtx = origCanvas.getContext('2d')!;
  origCtx.imageSmoothingEnabled = false;
  origCtx.drawImage(imgElement, 0, 0, origW, origH);
  const origImgData = origCtx.getImageData(0, 0, origW, origH);
  const sampledBgColor = estimateBackdropColor(origImgData.data, origW, origH);

  try {
    onProgress(12, 'Processing AI Cutout...');

    // 1. Attempt @imgly/background-removal client-side browser segmentation first if cached/available,
    //    always cleaning up temporary Object URLs in a `finally` block to prevent memory leaks.
    try {
      const imglyWindow = (window as any).__IMGLY_REMOVE_BG__;
      if (typeof imglyWindow === 'function') {
        const srcBlob: Blob | null = await new Promise((resolve) =>
          origCanvas.toBlob(resolve, 'image/png')
        );
        if (srcBlob) {
          let tempInputUrl = '';
          let tempOutputUrl = '';
          try {
            tempInputUrl = URL.createObjectURL(srcBlob);
            onProgress(40, 'Processing AI Cutout (@imgly Neural Engine)...');
            const outBlob: Blob = await imglyWindow(tempInputUrl);
            tempOutputUrl = URL.createObjectURL(outBlob);
            const cutImg = await new Promise<HTMLImageElement>((resolve, reject) => {
              const im = new Image();
              im.crossOrigin = 'anonymous';
              im.onload = () => resolve(im);
              im.onerror = reject;
              im.src = tempOutputUrl;
            });
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = origW;
            maskCanvas.height = origH;
            const mCtx = maskCanvas.getContext('2d')!;
            mCtx.drawImage(cutImg, 0, 0, origW, origH);
            const mData = mCtx.getImageData(0, 0, origW, origH).data;
            const alphaMask = new Uint8Array(origW * origH);
            for (let i = 0; i < alphaMask.length; i++) {
              alphaMask[i] = mData[i * 4 + 3];
            }
            onProgress(92, 'Processing AI Cutout (Refining Hair Edges)...');
            const refinedCanvas = applyHairMattingAndSpillRemoval(
              origImgData,
              alphaMask,
              sampledBgColor,
              mattingOptions
            );
            onProgress(100, 'AI Cutout Complete!');
            return {
              cutoutCanvas: refinedCanvas,
              alphaMask,
              sampledBgColor,
              width: origW,
              height: origH,
            };
          } finally {
            if (tempInputUrl) URL.revokeObjectURL(tempInputUrl);
            if (tempOutputUrl) URL.revokeObjectURL(tempOutputUrl);
          }
        }
      }
    } catch {
      // Proceed seamlessly to RMBG-1.4 neural segmentation
    }

    onProgress(18, 'Processing AI Cutout...');

    const transformersUrl = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
    const { AutoModel, AutoProcessor, env, RawImage } = await import(
      /* @vite-ignore */ transformersUrl
    );

    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
      env.backends.onnx.wasm.proxy = false;
    }

    if (!rmbgModel || !rmbgProcessor) {
      if (isModelLoading) {
        return runSmartEdgeBackdropCutoutHighRes(
          origImgData,
          sampledBgColor,
          onProgress,
          mattingOptions
        );
      }
      isModelLoading = true;
      onProgress(28, 'Processing AI Cutout (Loading Neural Model)...');

      rmbgModel = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
        config: { model_type: 'custom' },
        progress_callback: (p: any) => {
          if (p.progress) {
            onProgress(
              Math.min(75, Math.round(p.progress * 0.75)),
              `Processing AI Cutout (${Math.round(p.progress)}%)...`
            );
          }
        },
      });

      rmbgProcessor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          feature_extractor_type: 'ImageFeatureExtractor',
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        },
      });
      isModelLoading = false;
    }

    onProgress(82, 'Processing AI Cutout (Extracting Alpha Matte)...');

    // Use lossless PNG or canvas for model inference input, then resize ONLY the mask back to origW × origH
    const inferCanvas = document.createElement('canvas');
    const maxInferDim = 1024;
    let inferW = origW;
    let inferH = origH;
    if (inferW > maxInferDim || inferH > maxInferDim) {
      if (inferW > inferH) {
        inferH = Math.round((inferH * maxInferDim) / inferW);
        inferW = maxInferDim;
      } else {
        inferW = Math.round((inferW * maxInferDim) / inferH);
        inferH = maxInferDim;
      }
    }
    inferCanvas.width = inferW;
    inferCanvas.height = inferH;
    const inferCtx = inferCanvas.getContext('2d')!;
    inferCtx.imageSmoothingEnabled = true;
    inferCtx.imageSmoothingQuality = 'high';
    inferCtx.drawImage(imgElement, 0, 0, inferW, inferH);

    const pngUrl = inferCanvas.toDataURL('image/png');
    const rawImg = await RawImage.fromURL(pngUrl);

    const { pixel_values } = await rmbgProcessor(rawImg);
    const { output } = await rmbgModel({ input: pixel_values });

    // Resize neural mask to FULL ORIGINAL RESOLUTION (origW × origH)
    const fullResMaskImage = await RawImage.fromTensor(
      output[0].mul(255).to('uint8')
    ).resize(origW, origH);

    const alphaMask = new Uint8Array(origW * origH);
    const rawMaskData = fullResMaskImage.data;
    for (let i = 0; i < alphaMask.length; i++) {
      alphaMask[i] = rawMaskData[i];
    }

    onProgress(92, 'Refining Hair Strands & Removing Blue Color Spill...');

    const refinedCanvas = applyHairMattingAndSpillRemoval(
      origImgData,
      alphaMask,
      sampledBgColor,
      mattingOptions
    );

    onProgress(100, 'High-Resolution Cutout Ready!');
    return {
      cutoutCanvas: refinedCanvas,
      alphaMask,
      sampledBgColor,
      width: origW,
      height: origH,
    };
  } catch (err) {
    isModelLoading = false;
    console.warn('RMBG-1.4 fallback triggered, running high-res studio matting:', err);
    return runSmartEdgeBackdropCutoutHighRes(
      origImgData,
      sampledBgColor,
      onProgress,
      mattingOptions
    );
  }
}

/**
 * Backward-compatible wrapper returning HTMLCanvasElement at full original resolution.
 */
export async function runBriaRmbgCutout(
  imgElement: HTMLImageElement,
  onProgress: (pct: number, msg: string) => void,
  mattingOptions: HairMattingOptions = DEFAULT_HAIR_MATTING_OPTIONS
): Promise<HTMLCanvasElement | null> {
  const res = await runHighResRmbgCutout(imgElement, onProgress, mattingOptions);
  return res.cutoutCanvas;
}

/**
 * High-Resolution Corner-Sampled Studio Backdrop Segmentation + Hair Matting Fallback.
 */
async function runSmartEdgeBackdropCutoutHighRes(
  origImgData: ImageData,
  sampledBgColor: [number, number, number],
  onProgress: (pct: number, msg: string) => void,
  mattingOptions: HairMattingOptions
): Promise<CutoutResult> {
  onProgress(55, 'Analyzing High-Resolution Studio Backdrop...');
  await new Promise((r) => setTimeout(r, 120));

  const w = origImgData.width;
  const h = origImgData.height;
  const d = origImgData.data;

  const samples: Array<[number, number, number]> = [];
  const stepX = Math.max(1, Math.floor(w / 30));
  const stepY = Math.max(1, Math.floor(h / 30));

  for (let x = 0; x < w; x += stepX) {
    const idx = (Math.min(5, h - 1) * w + x) * 4;
    samples.push([d[idx], d[idx + 1], d[idx + 2]]);
  }
  for (let y = 0; y < Math.floor(h * 0.65); y += stepY) {
    const idxL = (y * w + Math.min(5, w - 1)) * 4;
    const idxR = (y * w + Math.max(0, w - 6)) * 4;
    samples.push([d[idxL], d[idxL + 1], d[idxL + 2]]);
    samples.push([d[idxR], d[idxR + 1], d[idxR + 2]]);
  }

  onProgress(80, 'Extracting Hair Strands & Alpha Matte...');
  await new Promise((r) => setTimeout(r, 120));

  const alphaMask = new Uint8Array(w * h);
  alphaMask.fill(255);

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  for (let x = 0; x < w; x++) {
    queue[tail++] = x;
    visited[x] = 1;
  }
  for (let y = 1; y < Math.floor(h * 0.88); y++) {
    const leftIdx = y * w;
    const rightIdx = y * w + (w - 1);
    queue[tail++] = leftIdx;
    queue[tail++] = rightIdx;
    visited[leftIdx] = 1;
    visited[rightIdx] = 1;
  }

  const colorDistance = (r: number, g: number, b: number) => {
    let minDist = 999;
    for (let i = 0; i < samples.length; i += 2) {
      const [sr, sg, sb] = samples[i];
      const dr = r - sr;
      const dg = g - sg;
      const db = b - sb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  };

  const threshold = 52;
  const feather = 28;

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);
    const pIdx = curr * 4;

    const dist = colorDistance(d[pIdx], d[pIdx + 1], d[pIdx + 2]);
    if (dist <= threshold + feather) {
      if (dist <= threshold) {
        alphaMask[curr] = 0;
      } else {
        const alphaRatio = (dist - threshold) / feather;
        alphaMask[curr] = Math.round(alphaRatio * 255);
      }

      if (dist <= threshold + 8) {
        if (cx > 0 && !visited[curr - 1]) {
          visited[curr - 1] = 1;
          queue[tail++] = curr - 1;
        }
        if (cx < w - 1 && !visited[curr + 1]) {
          visited[curr + 1] = 1;
          queue[tail++] = curr + 1;
        }
        if (cy > 0 && !visited[curr - w]) {
          visited[curr - w] = 1;
          queue[tail++] = curr - w;
        }
        if (cy < h - 1 && !visited[curr + w]) {
          visited[curr + w] = 1;
          queue[tail++] = curr + w;
        }
      }
    }
  }

  onProgress(94, 'Removing Blue Edge Spill & Refining Hair...');
  const refinedCanvas = applyHairMattingAndSpillRemoval(
    origImgData,
    alphaMask,
    sampledBgColor,
    mattingOptions
  );

  onProgress(100, 'Complete!');
  return {
    cutoutCanvas: refinedCanvas,
    alphaMask,
    sampledBgColor,
    width: w,
    height: h,
  };
}

/**
 * Advanced Hair Edge Matting, Alpha Refinement & Blue/Backdrop Color Spill Decontamination.
 *
 * How it works:
 * 1. Identifies boundary / transition pixels (where 0 < alpha < 252 or adjacent to transparent background).
 * 2. In the upper head/hair region (y < 0.68 * height), uses chrominance & luminance difference from the
 *    sampled backdrop color to recover fine dark or light hair strands without creating white/blue halos.
 * 3. Performs mathematical Foreground Color Decontamination on semi-transparent and near-edge pixels:
 *    - Estimates how much of the pixel's blue/backdrop cast comes from `sampledBgColor` or blue studio screen.
 *    - Unmixes the background color ($C_{fg} = (C_{obs} - (1 - \alpha) C_{bg}) / \alpha$) and clamps excess blue
 *      channel contamination around hair edges, while leaving interior clothing/skin completely untouched.
 */
export function applyHairMattingAndSpillRemoval(
  origImgData: ImageData,
  baseAlphaMask: Uint8Array,
  sampledBgColor: [number, number, number],
  options: HairMattingOptions
): HTMLCanvasElement {
  const w = origImgData.width;
  const h = origImgData.height;
  const srcPixels = origImgData.data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImgData = outCtx.createImageData(w, h);
  const dst = outImgData.data;

  const [bgR, bgG, bgB] = sampledBgColor;
  const spillStrength = Math.max(0, Math.min(100, options.blueSpillRemoval)) / 100;
  const hairDetail = Math.max(0, Math.min(100, options.hairDetailStrength)) / 100;
  const edgeShift = Math.max(-50, Math.min(50, options.edgeShift));

  // Step 1: Optional lightweight box feathering on a copy of the alpha mask for smooth anti-aliased transitions
  const refinedAlpha = new Uint8Array(w * h);
  const featherR = Math.min(4, Math.max(0, Math.round(options.featherRadius)));

  if (featherR > 0) {
    for (let y = 0; y < h; y++) {
      const yMin = Math.max(0, y - featherR);
      const yMax = Math.min(h - 1, y + featherR);
      for (let x = 0; x < w; x++) {
        const centerA = baseAlphaMask[y * w + x];
        // Only smooth near transition boundaries to keep interior 100% sharp
        if (centerA > 4 && centerA < 250) {
          let sum = 0;
          let cnt = 0;
          const xMin = Math.max(0, x - featherR);
          const xMax = Math.min(w - 1, x + featherR);
          for (let ny = yMin; ny <= yMax; ny++) {
            const rowOff = ny * w;
            for (let nx = xMin; nx <= xMax; nx++) {
              sum += baseAlphaMask[rowOff + nx];
              cnt++;
            }
          }
          refinedAlpha[y * w + x] = Math.round(sum / cnt);
        } else {
          refinedAlpha[y * w + x] = centerA;
        }
      }
    }
  } else {
    refinedAlpha.set(baseAlphaMask);
  }

  // Step 2: Detect 3px edge band around the foreground boundary so we can decontaminate blue spill
  // even on pixels whose alpha is close to 255 right at the hair boundary.
  const isNearBoundary = new Uint8Array(w * h);
  const bandRadius = 3;
  for (let y = bandRadius; y < h - bandRadius; y++) {
    const rowOff = y * w;
    for (let x = bandRadius; x < w - bandRadius; x++) {
      const a = refinedAlpha[rowOff + x];
      if (a === 0) continue;
      if (a < 248) {
        isNearBoundary[rowOff + x] = 1;
      } else {
        // Check 4-connected neighbors at distance `bandRadius`
        if (
          refinedAlpha[rowOff + x - bandRadius] < 180 ||
          refinedAlpha[rowOff + x + bandRadius] < 180 ||
          refinedAlpha[(y - bandRadius) * w + x] < 180 ||
          refinedAlpha[(y + bandRadius) * w + x] < 180
        ) {
          isNearBoundary[rowOff + x] = 1;
        }
      }
    }
  }

  const hairZoneMaxY = Math.floor(h * 0.72); // Hair and head region

  // Step 3: Process every pixel at full native resolution
  for (let i = 0; i < w * h; i++) {
    const pIdx = i * 4;
    let r = srcPixels[pIdx];
    let g = srcPixels[pIdx + 1];
    let b = srcPixels[pIdx + 2];
    let a = refinedAlpha[i];

    if (a === 0) {
      dst[pIdx] = 0;
      dst[pIdx + 1] = 0;
      dst[pIdx + 2] = 0;
      dst[pIdx + 3] = 0;
      continue;
    }

    const y = Math.floor(i / w);
    const inHairZone = y < hairZoneMaxY;
    const onEdge = isNearBoundary[i] === 1;

    // Apply user edge shift (choke/expand) only on semi-transparent boundary pixels
    if (a > 0 && a < 250 && edgeShift !== 0) {
      // Negative edgeShift chokes inward; positive expands outward
      const shifted = a + edgeShift * 2.2;
      a = Math.max(0, Math.min(255, Math.round(shifted)));
    }

    // Fine Hair Strand Matting & Blue/Backdrop Spill Decontamination on boundary pixels
    if (onEdge && a > 0) {
      // Calculate color similarity to the sampled background
      const drBg = r - bgR;
      const dgBg = g - bgG;
      const dbBg = b - bgB;
      const bgDist = Math.sqrt(drBg * drBg + dgBg * dgBg + dbBg * dbBg);

      // Detect classic blue/cyan studio screen spill (where blue channel dominates red & green)
      const blueExcess = b - Math.max(r, g * 0.92);
      const isBlueContaminated = blueExcess > 10 || (b > r + 18 && b > 95);

      // 3A. Fine Hair Alpha Refinement in Hair Zone
      if (inHairZone && hairDetail > 0) {
        // Luminance of pixel vs background
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
        const lumDiff = Math.abs(lum - bgLum);

        if (isBlueContaminated && bgDist < 85 && a < 220) {
          // Suppress blue halo fringe between hair strands
          const atten = Math.max(0.15, Math.min(1, lumDiff / 95));
          a = Math.round(a * (1 - spillStrength * (1 - atten) * 0.75));
        } else if (lumDiff > 45 && a > 35 && a < 235) {
          // Boost genuine dark or light hair strand visibility
          a = Math.min(255, Math.round(a + hairDetail * 28));
        }
      }

      // 3B. Foreground Color Decontamination (Unmixing background color from edge pixels)
      if (spillStrength > 0 && a > 0) {
        const alphaNorm = Math.max(0.22, a / 255);
        if (alphaNorm < 0.96) {
          // Recover true foreground color by subtracting (1 - alpha) * bgColor
          const weight = (1 - alphaNorm) * spillStrength * 0.85;
          r = Math.round((r - weight * bgR) / (1 - weight * 0.85));
          g = Math.round((g - weight * bgG) / (1 - weight * 0.85));
          b = Math.round((b - weight * bgB) / (1 - weight * 0.85));
        }

        // Targeted Blue Spill Neutralization on hair/shoulder edges
        if (blueExcess > 6) {
          const neutralTarget = Math.round(r * 0.55 + g * 0.45);
          const neutralizeAmount = spillStrength * (inHairZone ? 0.92 : 0.65);
          b = Math.round(b - (b - neutralTarget) * neutralizeAmount);
          // Slightly warm up cyan cast in green channel if green > red
          if (g > r + 10) {
            g = Math.round(g - (g - r) * neutralizeAmount * 0.45);
          }
        }
      }
    }

    dst[pIdx] = r < 0 ? 0 : r > 255 ? 255 : r;
    dst[pIdx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    dst[pIdx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    dst[pIdx + 3] = a;
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

/**
 * Interactive Manual Edge Brush Operation on the Alpha Mask & Foreground Pixels.
 * Supports:
 * - 'restore': Paint alpha back toward 255 (recover hair/subject)
 * - 'erase': Paint alpha toward 0 (clean stray background)
 * - 'decontaminate': Remove blue/background spill along painted hair edges while keeping natural hair texture
 */
export function applyManualMaskBrushStroke(
  alphaMask: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radiusPx: number,
  hardnessPct: number,
  mode: 'restore' | 'erase' | 'decontaminate',
  origImgData?: ImageData
): void {
  const r = Math.max(2, Math.round(radiusPx));
  const rSq = r * r;
  const hardRatio = Math.max(0.05, Math.min(0.98, hardnessPct / 100));
  const innerRadius = r * hardRatio;

  const xMin = Math.max(0, Math.floor(centerX - r));
  const xMax = Math.min(width - 1, Math.ceil(centerX + r));
  const yMin = Math.max(0, Math.floor(centerY - r));
  const yMax = Math.min(height - 1, Math.ceil(centerY + r));

  for (let y = yMin; y <= yMax; y++) {
    const dy = y - centerY;
    const rowOff = y * width;
    for (let x = xMin; x <= xMax; x++) {
      const dx = x - centerX;
      const distSq = dx * dx + dy * dy;
      if (distSq > rSq) continue;

      const dist = Math.sqrt(distSq);
      let falloff = 1;
      if (dist > innerRadius) {
        falloff = Math.max(0, 1 - (dist - innerRadius) / Math.max(1, r - innerRadius));
      }

      const idx = rowOff + x;
      if (mode === 'restore') {
        alphaMask[idx] = Math.min(255, Math.round(alphaMask[idx] + falloff * 140));
      } else if (mode === 'erase') {
        alphaMask[idx] = Math.max(0, Math.round(alphaMask[idx] - falloff * 140));
      } else if (mode === 'decontaminate' && origImgData) {
        // Decontaminate blue spill and refine semi-transparent hair alpha
        const pIdx = idx * 4;
        const pr = origImgData.data[pIdx];
        const pg = origImgData.data[pIdx + 1];
        const pb = origImgData.data[pIdx + 2];
        const blueExcess = pb - Math.max(pr, pg);
        if (blueExcess > 12) {
          // Reduce alpha on pure blue background pixels while decontaminating hair strands
          alphaMask[idx] = Math.max(0, Math.round(alphaMask[idx] * (1 - falloff * 0.45)));
          origImgData.data[pIdx + 2] = Math.round(
            pb - blueExcess * falloff * 0.85
          );
        }
      }
    }
  }
}

/**
 * Texture-Preserving Spot Healing / Blemish Removal Brush.
 *
 * Unlike a simple blur (which destroys pores and looks plastic), this algorithm:
 * 1. Samples clean surrounding skin pixels from an annular ring around `(centerX, centerY)`.
 * 2. Computes the median/trimmed-mean target skin base color `(targetR, targetG, targetB)` from the ring.
 * 3. Extracts high-frequency skin pore texture from the clean donor ring and blends the healed base
 *    with natural micro-texture using a smoothradial falloff controlled by `hardnessPct` and `opacityPct`.
 */
export function applySpotHealingBrushOnCanvas(
  targetCanvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  radiusPx: number,
  hardnessPct: number,
  opacityPct: number
): void {
  const w = targetCanvas.width;
  const h = targetCanvas.height;
  const ctx = targetCanvas.getContext('2d')!;

  const r = Math.max(2, Math.round(radiusPx));
  const outerRingR = Math.min(Math.max(r + 4, Math.round(r * 1.65)), Math.min(w, h) / 2);

  const x0 = Math.max(0, Math.floor(centerX - outerRingR));
  const y0 = Math.max(0, Math.floor(centerY - outerRingR));
  const x1 = Math.min(w - 1, Math.ceil(centerX + outerRingR));
  const y1 = Math.min(h - 1, Math.ceil(centerY + outerRingR));

  const patchW = x1 - x0 + 1;
  const patchH = y1 - y0 + 1;
  if (patchW <= 2 || patchH <= 2) return;

  const imgData = ctx.getImageData(x0, y0, patchW, patchH);
  const d = imgData.data;
  const srcCopy = new Uint8ClampedArray(d);

  // Step 1: Collect clean skin samples from the annular ring [r * 1.05 .. outerRingR]
  const ringSamplesR: number[] = [];
  const ringSamplesG: number[] = [];
  const ringSamplesB: number[] = [];
  const ringCoords: Array<{ x: number; y: number }> = [];

  const innerRingSq = r * r;
  const outerRingSq = outerRingR * outerRingR;

  for (let py = 0; py < patchH; py++) {
    const gy = y0 + py;
    const dy = gy - centerY;
    for (let px = 0; px < patchW; px++) {
      const gx = x0 + px;
      const dx = gx - centerX;
      const distSq = dx * dx + dy * dy;
      if (distSq >= innerRingSq && distSq <= outerRingSq) {
        const idx = (py * patchW + px) * 4;
        if (srcCopy[idx + 3] > 180) {
          ringSamplesR.push(srcCopy[idx]);
          ringSamplesG.push(srcCopy[idx + 1]);
          ringSamplesB.push(srcCopy[idx + 2]);
          ringCoords.push({ x: px, y: py });
        }
      }
    }
  }

  if (ringSamplesR.length < 4) return;

  // Sort to get robust median skin tone (ignores adjacent dark hair or another spot)
  const sortedR = [...ringSamplesR].sort((a, b) => a - b);
  const sortedG = [...ringSamplesG].sort((a, b) => a - b);
  const sortedB = [...ringSamplesB].sort((a, b) => a - b);
  const mid = Math.floor(sortedR.length * 0.55); // slightly brighter than dark blemish
  const medR = sortedR[mid];
  const medG = sortedG[mid];
  const medB = sortedB[mid];

  const hardRatio = Math.max(0.1, Math.min(0.95, hardnessPct / 100));
  const opacity = Math.max(0.1, Math.min(1, opacityPct / 100));
  const innerHardR = r * hardRatio;

  // Step 2: Heal pixels inside radius `r` by combining directional ring interpolation + donor skin grain
  for (let py = 0; py < patchH; py++) {
    const gy = y0 + py;
    const dy = gy - centerY;
    for (let px = 0; px < patchW; px++) {
      const gx = x0 + px;
      const dx = gx - centerX;
      const distSq = dx * dx + dy * dy;
      if (distSq > innerRingSq) continue;

      const dist = Math.sqrt(distSq);
      let falloff = 1;
      if (dist > innerHardR) {
        const t = (dist - innerHardR) / Math.max(1, r - innerHardR);
        // Smooth cosine falloff
        falloff = 0.5 * (1 + Math.cos(Math.PI * t));
      }
      const blendWeight = falloff * opacity;

      // Pick a clean donor pixel from the ring to preserve natural skin pore micro-texture
      const donorIdx = (px * 7 + py * 13) % ringCoords.length;
      const donor = ringCoords[donorIdx];
      const dOff = (donor.y * patchW + donor.x) * 4;

      // High-frequency pore detail from donor relative to median
      const grainR = (srcCopy[dOff] - medR) * 0.38;
      const grainG = (srcCopy[dOff + 1] - medG) * 0.38;
      const grainB = (srcCopy[dOff + 2] - medB) * 0.38;

      const healedR = Math.max(0, Math.min(255, medR + grainR));
      const healedG = Math.max(0, Math.min(255, medG + grainG));
      const healedB = Math.max(0, Math.min(255, medB + grainB));

      const pIdx = (py * patchW + px) * 4;
      d[pIdx] = Math.round(srcCopy[pIdx] * (1 - blendWeight) + healedR * blendWeight);
      d[pIdx + 1] = Math.round(srcCopy[pIdx + 1] * (1 - blendWeight) + healedG * blendWeight);
      d[pIdx + 2] = Math.round(srcCopy[pIdx + 2] * (1 - blendWeight) + healedB * blendWeight);
    }
  }

  ctx.putImageData(imgData, x0, y0);
}
