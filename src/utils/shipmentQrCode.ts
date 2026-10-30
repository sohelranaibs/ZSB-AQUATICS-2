import { PackingRecord } from '../types/index.ts';

export interface ShipmentQrPayload {
  id?: string;
  invoiceNumber: string;
  shippingMark: string;
  packingDate: string;
  flight?: string;
  destination?: string;
  totalBox?: number;
  totalWeight?: number;
  totalAmount?: number;
}

export interface ParsedShipmentDeepLink {
  isShipmentLink: boolean;
  invoiceNumber: string;
  shippingMark: string;
  packingId: string;
}

/**
 * Builds a system URL that links directly to a specific Export Packing List shipment's
 * details inside the application (Sheet 09 Packing DB & Shipment Inspector).
 */
export function buildShipmentDetailUrl(
  baseUrl: string,
  shipment: Partial<ShipmentQrPayload>
): string {
  const cleanBase = (baseUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('tab', 'packing_db');

  const inv = (shipment.invoiceNumber || '').trim();
  if (inv) {
    params.set('shipment', inv);
  }
  const mark = (shipment.shippingMark || '').trim();
  if (mark) {
    params.set('mark', mark);
  }
  const id = (shipment.id || '').trim();
  if (id) {
    params.set('id', id);
  }
  const date = (shipment.packingDate || '').trim();
  if (date) {
    params.set('date', date);
  }

  return `${cleanBase}/?${params.toString()}`;
}

/**
 * Parses URL search parameters to detect if the app was opened via a Packing List QR code link.
 */
export function parseShipmentDeepLink(searchStr: string): ParsedShipmentDeepLink {
  const raw = (searchStr || '').startsWith('?') ? searchStr.slice(1) : searchStr || '';
  const params = new URLSearchParams(raw);
  const invoiceNumber = (params.get('shipment') || '').trim();
  const shippingMark = (params.get('mark') || '').trim();
  const packingId = (params.get('id') || '').trim();
  const tab = (params.get('tab') || '').trim();

  const isShipmentLink =
    Boolean(invoiceNumber || packingId) || (tab === 'packing_db' && Boolean(shippingMark));

  return {
    isShipmentLink,
    invoiceNumber,
    shippingMark,
    packingId,
  };
}

/**
 * Finds the matching PackingRecord from a parsed QR deep link or invoice number.
 */
export function findShipmentByDeepLink(
  packings: PackingRecord[],
  link: Partial<ParsedShipmentDeepLink>
): PackingRecord | null {
  if (!Array.isArray(packings) || packings.length === 0) return null;

  const targetId = (link.packingId || '').trim();
  if (targetId) {
    const byId = packings.find((p) => p.id === targetId);
    if (byId) return byId;
  }

  const targetInv = (link.invoiceNumber || '').trim().toLowerCase();
  if (targetInv) {
    const byInv = packings.find(
      (p) => (p.invoiceNumber || '').trim().toLowerCase() === targetInv
    );
    if (byInv) return byInv;
  }

  const targetMark = (link.shippingMark || '').trim().toLowerCase();
  if (targetMark) {
    const byMark = packings.find(
      (p) => (p.shippingMark || '').trim().toLowerCase() === targetMark
    );
    if (byMark) return byMark;
  }

  return null;
}

// ============================================================================
// ISO/IEC 18004 Deterministic QR Code Matrix Generator (Byte Mode, ECC Level L)
// Supports Versions 1–6 (up to 134 UTF-8 bytes) with fallback compaction
// ============================================================================

interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignmentCenters: number[];
}

const QR_VERSION_SPECS_L: QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignmentCenters: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignmentCenters: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecCodewords: 36, alignmentCenters: [6, 34] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildReedSolomonGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = buildReedSolomonGenerator(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

function interleaveVersion6L(data: Uint8Array): Uint8Array {
  // Version 6-L uses 2 blocks of (68 data codewords, 18 EC codewords)
  const block1Data = data.slice(0, 68);
  const block2Data = data.slice(68, 136);
  const block1Ec = computeReedSolomonRemainder(block1Data, 18);
  const block2Ec = computeReedSolomonRemainder(block2Data, 18);

  const out = new Uint8Array(136 + 36);
  let idx = 0;
  for (let i = 0; i < 68; i++) {
    out[idx++] = block1Data[i];
    out[idx++] = block2Data[i];
  }
  for (let i = 0; i < 18; i++) {
    out[idx++] = block1Ec[i];
    out[idx++] = block2Ec[i];
  }
  return out;
}

/**
 * Generates a 2D boolean matrix representing a valid ISO/IEC 18004 QR Code for the given text.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const rawInput = (text || 'ZSB-AQUATICS').trim();
  const encoder = new TextEncoder();
  let utf8Bytes = encoder.encode(rawInput);

  // Max capacity of Version 6-L in byte mode is 134 bytes
  if (utf8Bytes.length > 134) {
    utf8Bytes = utf8Bytes.slice(0, 134);
  }

  const spec =
    QR_VERSION_SPECS_L.find((s) => s.dataCodewords - 2 >= utf8Bytes.length) ||
    QR_VERSION_SPECS_L[QR_VERSION_SPECS_L.length - 1];

  // Encode bit stream: 4-bit mode (0100 = byte), 8-bit length, payload, terminator, pad bytes
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4);
  pushBits(utf8Bytes.length, 8);
  for (let i = 0; i < utf8Bytes.length; i++) {
    pushBits(utf8Bytes[i], 8);
  }

  const maxDataBits = spec.dataCodewords * 8;
  const terminatorLen = Math.min(4, maxDataBits - bits.length);
  pushBits(0, terminatorLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataBytes[i] = b;
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bits.length / 8; i < spec.dataCodewords; i++) {
    dataBytes[i] = padBytes[padIdx % 2];
    padIdx++;
  }

  let finalCodewords: Uint8Array;
  if (spec.version === 6) {
    finalCodewords = interleaveVersion6L(dataBytes);
  } else {
    const ecBytes = computeReedSolomonRemainder(dataBytes, spec.ecCodewords);
    finalCodewords = new Uint8Array(spec.dataCodewords + spec.ecCodewords);
    finalCodewords.set(dataBytes, 0);
    finalCodewords.set(ecBytes, spec.dataCodewords);
  }

  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark;
      isFunction[r][c] = true;
    }
  };

  // Finder patterns + separators
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onBorder || inInner));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setFunctionModule(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Dark module & reserved format info areas
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false);
    if (!isFunction[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!isFunction[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }

  // Place data bits in upward/downward 2-column zig-zag
  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let v = 0; v < size; v++) {
      const r = upward ? size - 1 - v : v;
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const byteVal = finalCodewords[bitIdx >> 3];
            dark = ((byteVal >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply Mask Pattern 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) {
            dark = !dark;
          }
          modules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // Format information for ECC Level L (01) + Mask 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  const getFormatBit = (idx: number) => ((formatBits >> idx) & 1) === 1;

  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, getFormatBit(i));
  setFunctionModule(8, 7, getFormatBit(6));
  setFunctionModule(8, 8, getFormatBit(7));
  setFunctionModule(7, 8, getFormatBit(8));
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, getFormatBit(i));

  for (let i = 0; i < 8; i++) setFunctionModule(8, size - 1 - i, getFormatBit(i));
  for (let i = 8; i < 15; i++) setFunctionModule(size - 15 + i, 8, getFormatBit(i));
  setFunctionModule(size - 8, 8, true);

  return modules;
}

/**
 * Generates a data URL for a shipment QR code (PNG dataUrl in browser, SVG dataUrl fallback).
 */
export async function generateShipmentQrDataUrl(
  invoiceNumber: string,
  shippingMark?: string
): Promise<string> {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';

  const url = buildShipmentDetailUrl(origin, {
    invoiceNumber,
    shippingMark,
  });

  const matrix = generateQrMatrix(url);
  const size = matrix.length;
  const quietZone = 2;
  const totalSize = size + quietZone * 2;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const scale = 6;
      const canvasSize = totalSize * scale;
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.fillStyle = '#0f172a';
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (matrix[r][c]) {
              ctx.fillRect(
                (c + quietZone) * scale,
                (r + quietZone) * scale,
                scale,
                scale
              );
            }
          }
        }
        return canvas.toDataURL('image/png');
      }
    } catch {
      // Fall through to SVG data URL
    }
  }

  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + quietZone}" y="${r + quietZone}" width="1" height="1" fill="#0f172a"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="200" height="200"><rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

