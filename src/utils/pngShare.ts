import { renderElementToHighResCanvas } from './pdfGenerator.ts';

/**
 * Formats a clean, professional document summary message in English for trade ledger sharing.
 */
export function formatDocumentShareSummary(
  type: string,
  data: any,
  companyName: string = 'ZSB AQUATICS'
): string {
  const dateStr = data?.packingDate || data?.date || new Date().toISOString().slice(0, 10);
  const invoiceNo = data?.invoiceNumber || data?.records?.[0]?.invoiceNumber || 'DOC';
  const shippingMark = data?.shippingMark || data?.mark || '';
  const supplierOrShipper = data?.description || data?.shipper || data?.supplierName || '';

  if (type === 'exporter_payment_slip') {
    const totalRmb = typeof data?.totalRmb === 'number' ? `¥${data.totalRmb.toFixed(2)}` : '';
    const totalBdt = typeof data?.totalBdt === 'number' ? `TK ${data.totalBdt.toLocaleString()}` : '';
    return (
      `*${companyName} — Exporter Payment Slip (付款单)*\n` +
      `• Shipping Mark: ${shippingMark || 'ALL'}\n` +
      `• Packing Date: ${dateStr}\n` +
      (totalRmb ? `• Total Settlement: ${totalRmb} (${totalBdt})\n` : '') +
      `• Verified Document: Attached as .PNG high-resolution image.\n` +
      `_Please inspect and confirm received quantities & settlement._`
    );
  }

  if (type === 'packing') {
    const boxes = data?.totalBox ? `${data.totalBox} Boxes` : '';
    const weight = data?.totalWeight ? `${data.totalWeight.toFixed(2)} KG` : '';
    return (
      `*${companyName} — Air Freight Export Packing Manifest*\n` +
      `• Manifest No: #${invoiceNo}\n` +
      `• Shipping Mark: ${shippingMark}\n` +
      `• Flight / Date: ${data?.flight || 'Scheduled'} (${dateStr})\n` +
      (boxes || weight ? `• Consignment Volume: ${[boxes, weight].filter(Boolean).join(' · ')}\n` : '') +
      `• Verified Document: Attached as .PNG high-resolution image.\n` +
      `_Official Trade Ledger Document from ${companyName}._`
    );
  }

  if (type === 'purchase') {
    const totalQty = data?.totalQty ? `${data.totalQty.toFixed(2)} KG` : '';
    const billAmount = data?.billAmount ? `TK ${data.billAmount.toLocaleString()}` : '';
    return (
      `*${companyName} — Procurement Challan / Purchase Voucher*\n` +
      `• Voucher No: #${invoiceNo}\n` +
      `• Supplier: ${supplierOrShipper || 'Valued Trade Partner'}\n` +
      `• Date: ${dateStr}\n` +
      (totalQty ? `• Total Quantity: ${totalQty}\n` : '') +
      (billAmount ? `• Bill Amount: ${billAmount}\n` : '') +
      `• Verified Document: Attached as .PNG high-resolution image.\n` +
      `_Official Trade Ledger Document from ${companyName}._`
    );
  }

  if (type === 'air_way_bill') {
    return (
      `*${companyName} — Flight Return Bill (FRB) Statement*\n` +
      `• Shipper / Airline: ${data?.shipper || 'ALL'}\n` +
      `• Period: ${data?.yearMonth || dateStr}\n` +
      `• Verified Document: Attached as .PNG high-resolution image.\n` +
      `_Official Trade Ledger Document from ${companyName}._`
    );
  }

  return (
    `*${companyName} — Official Business Document*\n` +
    `• Reference: #${invoiceNo}\n` +
    `• Date: ${dateStr}\n` +
    `• Verified Document: Attached as .PNG high-resolution image.\n` +
    `_Official Trade Ledger Document from ${companyName}._`
  );
}

/**
 * Formats a bilingual (English & 中文) document summary message specifically optimized for WeChat (微信).
 */
export function formatWeChatShareText(
  type: string,
  data: any,
  companyName: string = 'ZSB AQUATICS'
): string {
  const dateStr = data?.packingDate || data?.date || new Date().toISOString().slice(0, 10);
  const shippingMark = data?.shippingMark || data?.mark || 'ALL';
  const invoiceNo = data?.invoiceNumber || data?.records?.[0]?.invoiceNumber || 'DOC';

  if (type === 'exporter_payment_slip') {
    const totalRmb = typeof data?.totalRmb === 'number' ? `¥${data.totalRmb.toFixed(2)}` : '';
    return (
      `【${companyName} 出口结算付款单 (Exporter Payment Slip)】\n` +
      `• 唛头 (Shipping Mark): ${shippingMark}\n` +
      `• 日期 (Date): ${dateStr}\n` +
      (totalRmb ? `• 结算金额 (Total Amount): ${totalRmb} RMB\n` : '') +
      `• 凭证格式: 高清 .PNG 图片已生成\n` +
      `请查收附件图片，核对明细与结算款项。如有疑问请及时联系。`
    );
  }

  if (type === 'packing') {
    const boxes = data?.totalBox ? `${data.totalBox} Box` : '';
    const weight = typeof data?.totalWeight === 'number' ? `${data.totalWeight.toFixed(2)} KG` : '';
    return (
      `【${companyName} 空运装箱单 (Export Packing Manifest)】\n` +
      `• 单号 (Manifest No): #${invoiceNo}\n` +
      `• 唛头 (Shipping Mark): ${shippingMark}\n` +
      `• 航班 / 日期 (Flight/Date): ${data?.flight || 'Scheduled'} (${dateStr})\n` +
      (boxes || weight ? `• 件数 / 重量 (Volume): ${[boxes, weight].filter(Boolean).join(' / ')}\n` : '') +
      `• 凭证格式: 高清 .PNG 图片已生成，请查收核验。`
    );
  }

  if (type === 'air_way_bill') {
    const totalBoxes = data?.totals?.totalBoxes || data?.totalBoxes || 0;
    const totalRmb = data?.totals?.totalRmb || data?.totalRmb || 0;
    return (
      `【${companyName} 航班运费结算单 (Flight Return Bill Statement)】\n` +
      `• 发货人 / 航司 (Shipper): ${data?.shipper || 'ALL'}\n` +
      `• 账期 (Period): ${data?.monthLabel || data?.yearMonth || dateStr}\n` +
      (totalBoxes ? `• 总件数 (Total Boxes): ${totalBoxes} Box\n` : '') +
      (totalRmb ? `• 总运费 (Total RMB): ¥${Number(totalRmb).toFixed(2)} RMB\n` : '') +
      `• 凭证格式: 高清 .PNG 图片已生成，请查收核验。`
    );
  }

  if (type === 'purchase') {
    const supplier = data?.description || data?.supplierName || 'Supplier';
    const totalQty = typeof data?.totalQty === 'number' ? `${data.totalQty.toFixed(2)} KG` : '';
    const billAmount = typeof data?.billAmount === 'number' ? `TK ${data.billAmount.toLocaleString()}` : '';
    return (
      `【${companyName} 采购入库结算单 (Procurement Challan)】\n` +
      `• 单号 (Voucher No): #${invoiceNo}\n` +
      `• 供应商 (Supplier): ${supplier}\n` +
      `• 日期 (Date): ${dateStr}\n` +
      (totalQty ? `• 总重量 (Total Qty): ${totalQty}\n` : '') +
      (billAmount ? `• 账单金额 (Bill Amount): ${billAmount}\n` : '') +
      `• 凭证格式: 高清 .PNG 图片已生成，请查收核验。`
    );
  }

  return (
    `【${companyName} 贸易出口凭单 (Trade Document)】\n` +
    `• 唛头 / 单号: ${shippingMark !== 'ALL' ? shippingMark : invoiceNo}\n` +
    `• 日期: ${dateStr}\n` +
    `• 附件: 高清 .PNG 图片已生成，请查收核验。`
  );
}

/**
 * Generates a clean .png file name.
 */
export function createPngFilename(base: string): string {
  const clean = base.replace(/\.(pdf|png)$/i, '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  return `${clean}.png`;
}

/**
 * Converts an HTMLCanvasElement into a PNG Blob.
 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas to PNG Blob conversion failed'));
      }
    }, 'image/png');
  });
}

/**
 * Captures an element as a high-resolution PNG Blob and File object.
 */
export async function renderElementToPngBlob(
  elementOrId: string | HTMLElement,
  filename: string,
  targetWidth: number = 800
): Promise<{
  blob: Blob;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  filename: string;
} | null> {
  try {
    const canvas = await renderElementToHighResCanvas(elementOrId, targetWidth);
    if (!canvas) return null;

    const blob = await canvasToPngBlob(canvas);
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const cleanFilename = createPngFilename(filename);
    const file = new File([blob], cleanFilename, { type: 'image/png' });

    return {
      blob,
      file,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      filename: cleanFilename,
    };
  } catch (error) {
    console.error('Error rendering element to PNG Blob:', error);
    return null;
  }
}

/**
 * Copies a PNG Blob directly to the system clipboard so the user can paste (Ctrl+V)
 * into WeChat Desktop, WeChat Web, or Email immediately.
 */
export async function copyPngBlobToClipboard(blob: Blob): Promise<{ success: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return { success: false, error: 'Clipboard API not supported in this environment.' };
  }

  try {
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);
      return { success: true };
    }
    return { success: false, error: 'ClipboardItem not supported.' };
  } catch (err: any) {
    console.warn('Clipboard write image failed:', err);
    return { success: false, error: err?.message || 'Failed to copy image to clipboard.' };
  }
}

/**
 * Checks if the browser's Web Share API can share files.
 */
export function canSharePngFile(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) {
    return false;
  }
  try {
    const testFile = new File([''], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Triggers native Web Share API with the PNG file.
 * This opens the system share sheet where WeChat appears and receives the file.
 */
export async function sharePngViaWebShare(
  file: File,
  title: string,
  text?: string
): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
  if (!canSharePngFile()) {
    return { success: false, error: 'Web Share with files is not supported on this browser.' };
  }

  try {
    await navigator.share({
      title,
      text: text || title,
      files: [file],
    });
    return { success: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, cancelled: true };
    }
    return { success: false, error: err?.message || 'Web Share failed.' };
  }
}

/**
 * Downloads a PNG file directly to the user's computer or mobile storage.
 */
export function downloadPngFile(blobOrDataUrl: Blob | string, filename: string): void {
  const clean = createPngFilename(filename);
  let url: string;
  let shouldRevoke = false;

  if (typeof blobOrDataUrl === 'string') {
    url = blobOrDataUrl;
  } else {
    url = URL.createObjectURL(blobOrDataUrl);
    shouldRevoke = true;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = clean;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export interface PngShareResult {
  actionTaken: 'web_share' | 'wechat_clipboard_and_download';
  copiedToClipboard: boolean;
  copiedTextToClipboard?: boolean;
  downloaded: boolean;
  openedLink: boolean;
  wechatDeepLinkUri: string;
  message: string;
}

/**
 * Executes high-level share flow for WeChat (微信):
 * 1. If Web Share with files is available: opens native share target with the PNG image.
 * 2. In desktop browsers / fallback:
 *    - Automatically copies PNG image to clipboard for instant Ctrl+V into WeChat desktop / web.
 *    - Falls back to copying the bilingual WeChat text if image clipboard is restricted.
 *    - Automatically downloads the .PNG file.
 *    - Returns clear bilingual confirmation.
 */
export async function executePngShareToWeChat(options: {
  file: File;
  blob: Blob;
  filename: string;
  text: string;
}): Promise<PngShareResult> {
  const { file, blob, filename, text } = options;
  const wechatDeepLinkUri = 'weixin://dl/chat';

  // Try Web Share API first
  if (canSharePngFile()) {
    const res = await sharePngViaWebShare(file, filename, text);
    if (res.success) {
      return {
        actionTaken: 'web_share',
        copiedToClipboard: false,
        downloaded: false,
        openedLink: false,
        wechatDeepLinkUri,
        message: 'Shared .PNG image directly via system share sheet (WeChat 微信)!',
      };
    }
    if (res.cancelled) {
      return {
        actionTaken: 'web_share',
        copiedToClipboard: false,
        downloaded: false,
        openedLink: false,
        wechatDeepLinkUri,
        message: 'Share cancelled.',
      };
    }
  }

  // Desktop or fallback: copy image to clipboard + copy text fallback + download PNG
  const copyRes = await copyPngBlobToClipboard(blob);
  let copiedText = false;
  if (!copyRes.success && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copiedText = true;
    } catch {
      copiedText = false;
    }
  }

  downloadPngFile(blob, filename);

  return {
    actionTaken: 'wechat_clipboard_and_download',
    copiedToClipboard: copyRes.success,
    copiedTextToClipboard: copiedText,
    downloaded: true,
    openedLink: false,
    wechatDeepLinkUri,
    message: copyRes.success
      ? 'PNG downloaded & copied to clipboard! 在微信聊天窗口中直接按 Ctrl+V 粘贴发送图片。'
      : copiedText
      ? 'PNG image downloaded & WeChat summary text copied to clipboard! Attach the image in WeChat (微信).'
      : 'PNG image downloaded. Attach the file in WeChat (微信).',
  };
}
