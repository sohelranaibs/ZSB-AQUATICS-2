import { renderElementToHighResCanvas } from './pdfGenerator.ts';

/**
 * Normalizes phone numbers for WhatsApp API links (digits only, no +, -, or spaces).
 * Defaulting to Bangladesh (+880) prefix if local format provided.
 */
export function cleanPhoneNumberForWhatsApp(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // If local Bangladesh number starting with 01
  if (digits.startsWith('01') && digits.length === 11) {
    return `880${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Builds standard WhatsApp web/mobile direct chat URL with pre-filled message text.
 */
export function buildWhatsAppShareUrl(text: string, phone?: string): string {
  const cleanPhone = cleanPhoneNumberForWhatsApp(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Formats a clean, professional document summary message in English for WhatsApp trade chats.
 */
export function formatDocumentShareSummary(
  type: string,
  data: any,
  companyName: string = 'ZSB AQUATICS'
): string {
  const dateStr = data?.packingDate || data?.date || new Date().toISOString().slice(0, 10);
  const invoiceNo = data?.invoiceNumber || (data?.records?.[0]?.invoiceNumber) || 'DOC';
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

  return (
    `【${companyName} 贸易出口凭单 (Trade Document)】\n` +
    `• 唛头 / 单号: ${shippingMark || data?.invoiceNumber || 'DOC'}\n` +
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
 * into WhatsApp Web, WeChat Desktop, Telegram, or Email immediately.
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
 * This opens the system share sheet where WhatsApp and WeChat appear and receive the file.
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
  actionTaken: 'web_share' | 'whatsapp_link_and_clipboard' | 'wechat_clipboard_and_download';
  copiedToClipboard: boolean;
  downloaded: boolean;
  openedLink: boolean;
  message: string;
}

/**
 * Executes high-level share flow for WhatsApp:
 * 1. If Web Share with files is available: opens native share target with the PNG image!
 * 2. If on desktop / Web Share unavailable:
 *    - Copies image to clipboard for instant Ctrl+V pasting into WhatsApp chat.
 *    - Downloads the .PNG file so user has it immediately.
 *    - Opens WhatsApp chat with document summary.
 */
export async function executePngShareToWhatsApp(options: {
  file: File;
  blob: Blob;
  filename: string;
  text: string;
  phone?: string;
}): Promise<PngShareResult> {
  const { file, blob, filename, text, phone } = options;

  // Try Web Share API first (Mobile Chrome/Safari/Edge, Android, iOS)
  if (canSharePngFile()) {
    const res = await sharePngViaWebShare(file, filename, text);
    if (res.success) {
      return {
        actionTaken: 'web_share',
        copiedToClipboard: false,
        downloaded: false,
        openedLink: false,
        message: 'Shared .PNG image directly via system share sheet (WhatsApp)!',
      };
    }
    if (res.cancelled) {
      // User cancelled share sheet, do not fallback aggressively
      return {
        actionTaken: 'web_share',
        copiedToClipboard: false,
        downloaded: false,
        openedLink: false,
        message: 'Share cancelled.',
      };
    }
  }

  // Desktop or fallback: copy image to clipboard + download PNG + open WhatsApp
  const copyRes = await copyPngBlobToClipboard(blob);
  downloadPngFile(blob, filename);

  const whatsappUrl = buildWhatsAppShareUrl(text, phone);
  if (typeof window !== 'undefined') {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  return {
    actionTaken: 'whatsapp_link_and_clipboard',
    copiedToClipboard: copyRes.success,
    downloaded: true,
    openedLink: true,
    message: copyRes.success
      ? 'PNG downloaded and copied to clipboard! Paste (Ctrl+V) directly into your WhatsApp chat.'
      : 'PNG downloaded and WhatsApp opened. Attach the downloaded image to your chat.',
  };
}

/**
 * Executes high-level share flow for WeChat (微信):
 * 1. If Web Share with files is available: opens native share target with the PNG image.
 * 2. In desktop browsers / fallback:
 *    - Automatically copies PNG image to clipboard for instant Ctrl+V into WeChat desktop / web.
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

  // Try Web Share API first
  if (canSharePngFile()) {
    const res = await sharePngViaWebShare(file, filename, text);
    if (res.success) {
      return {
        actionTaken: 'web_share',
        copiedToClipboard: false,
        downloaded: false,
        openedLink: false,
        message: 'Shared .PNG image directly via system share sheet (WeChat)!',
      };
    }
    if (res.cancelled) {
      return {
        actionTaken: 'web_share',
        copiedToClipboard: false,
        downloaded: false,
        openedLink: false,
        message: 'Share cancelled.',
      };
    }
  }

  // Desktop or fallback: copy image to clipboard + download PNG
  const copyRes = await copyPngBlobToClipboard(blob);
  downloadPngFile(blob, filename);

  return {
    actionTaken: 'wechat_clipboard_and_download',
    copiedToClipboard: copyRes.success,
    downloaded: true,
    openedLink: false,
    message: copyRes.success
      ? 'PNG downloaded & copied to clipboard! 在微信聊天窗口中直接按 Ctrl+V 粘贴发送图片。'
      : 'PNG image downloaded. Attach the file in WeChat.',
  };
}
