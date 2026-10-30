import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  renderElementToPngBlob,
  copyPngBlobToClipboard,
  downloadPngFile,
  executePngShareToWhatsApp,
  executePngShareToWeChat,
  formatDocumentShareSummary,
  formatWeChatShareText,
  cleanPhoneNumberForWhatsApp,
  canSharePngFile,
  createPngFilename,
} from '../utils/pngShare.ts';
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  Phone,
  FileImage,
  ExternalLink,
  Loader2,
  Sparkles,
  QrCode,
  Info,
} from 'lucide-react';
import { generateShipmentQrDataUrl } from '../utils/shipmentQrCode.ts';

// Official Brand Icons
export const WhatsAppIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-5 h-5',
  size = 20,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.884 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.05 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
  </svg>
);

export const WeChatIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-5 h-5',
  size = 20,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.62.62 0 0 1 .213.665l-.534 1.996a.375.375 0 0 0 .524.432l2.368-1.248a.627.627 0 0 1 .494-.044c.833.24 1.716.37 2.624.37.247 0 .49-.01.731-.027-.14-.526-.217-1.077-.217-1.644 0-4.053 3.892-7.342 8.692-7.342.365 0 .723.02 1.076.056C17.77 5.736 13.668 2.188 8.691 2.188zm-2.48 4.296a1.094 1.094 0 1 1 0 2.188 1.094 1.094 0 0 1 0-2.188zm4.962 0a1.094 1.094 0 1 1 0 2.188 1.094 1.094 0 0 1 0-2.188zm6.035 3.75c-3.999 0-7.242 2.74-7.242 6.12 0 1.844.975 3.504 2.502 4.626a.517.517 0 0 1 .177.554l-.445 1.663a.312.312 0 0 0 .436.36l1.974-1.04a.522.522 0 0 1 .411-.037c.695.2 1.431.309 2.187.309 4 0 7.242-2.74 7.242-6.12 0-3.38-3.242-6.12-7.242-6.12zm-2.069 3.58a.912.912 0 1 1 0 1.823.912.912 0 0 1 0-1.823zm4.138 0a.912.912 0 1 1 0 1.823.912.912 0 0 1 0-1.823z" />
  </svg>
);

export interface PngShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentType: string;
  documentData: any;
  targetElementId: string;
  defaultFilename: string;
  defaultPhone?: string;
}

export const PngShareModal: React.FC<PngShareModalProps> = ({
  isOpen,
  onClose,
  title,
  documentType,
  documentData,
  targetElementId,
  defaultFilename,
  defaultPhone = '',
}) => {
  const { companyProfile, showToast, addAuditLog } = useApp();

  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'wechat'>('whatsapp');
  const [phoneNumber, setPhoneNumber] = useState<string>(defaultPhone);
  const [shareText, setShareText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [pngData, setPngData] = useState<{
    blob: Blob;
    file: File;
    dataUrl: string;
    width: number;
    height: number;
    filename: string;
  } | null>(null);
  const [copiedClipboard, setCopiedClipboard] = useState<boolean>(false);
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate initial messages and QR code on mount/open
  useEffect(() => {
    if (!isOpen) {
      setPngData(null);
      setCopiedClipboard(false);
      return;
    }

    if (activeChannel === 'whatsapp') {
      setShareText(formatDocumentShareSummary(documentType, documentData, companyProfile.companyName));
    } else {
      setShareText(formatWeChatShareText(documentType, documentData, companyProfile.companyName));
    }

    // Generate QR code for mobile scanning
    const invoice = documentData?.invoiceNumber || (documentData?.records?.[0]?.invoiceNumber) || 'DOC';
    generateShipmentQrDataUrl(invoice, documentData?.shippingMark)
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [isOpen, activeChannel, documentType, documentData, companyProfile.companyName]);

  // Generate PNG blob from target DOM element
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    const timer = setTimeout(async () => {
      try {
        const result = await renderElementToPngBlob(
          targetElementId,
          defaultFilename,
          800
        );
        if (isMounted && result) {
          setPngData(result);
        }
      } catch (err) {
        console.error('PNG capture error:', err);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, targetElementId, defaultFilename]);

  if (!isOpen) return null;

  const handleCopyImageOnly = async () => {
    if (!pngData?.blob) {
      showToast('Generating PNG image, please wait...');
      return;
    }
    const res = await copyPngBlobToClipboard(pngData.blob);
    if (res.success) {
      setCopiedClipboard(true);
      setTimeout(() => setCopiedClipboard(false), 3000);
      showToast('PNG image copied to clipboard! Paste (Ctrl+V) directly into chat.');
    } else {
      showToast(res.error || 'Failed to copy image to clipboard.');
    }
  };

  const handleDownloadOnly = () => {
    if (!pngData) {
      showToast('Generating PNG image, please wait...');
      return;
    }
    downloadPngFile(pngData.blob, pngData.filename);
    showToast(`Downloaded: ${pngData.filename}`);
  };

  const handleExecuteWhatsApp = async () => {
    if (!pngData) {
      showToast('Preparing .PNG image...');
      return;
    }

    setIsSharing(true);
    try {
      const res = await executePngShareToWhatsApp({
        file: pngData.file,
        blob: pngData.blob,
        filename: pngData.filename,
        text: shareText,
        phone: phoneNumber,
      });

      showToast(res.message);

      addAuditLog({
        action: 'EXPORT',
        module: 'Logistics',
        entityId: pngData.filename,
        summary: `Shared .PNG document "${pngData.filename}" via WhatsApp`,
        details: `Channel: WhatsApp · Recipient: ${phoneNumber || 'Direct App'} · Size: ${Math.round(pngData.blob.size / 1024)} KB`,
      });
    } catch (err: any) {
      showToast(err?.message || 'Error sharing via WhatsApp.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleExecuteWeChat = async () => {
    if (!pngData) {
      showToast('Preparing .PNG image...');
      return;
    }

    setIsSharing(true);
    try {
      const res = await executePngShareToWeChat({
        file: pngData.file,
        blob: pngData.blob,
        filename: pngData.filename,
        text: shareText,
      });

      showToast(res.message);

      addAuditLog({
        action: 'EXPORT',
        module: 'Logistics',
        entityId: pngData.filename,
        summary: `Shared .PNG document "${pngData.filename}" via WeChat (微信)`,
        details: `Channel: WeChat · Copied: ${res.copiedToClipboard} · Size: ${Math.round(pngData.blob.size / 1024)} KB`,
      });
    } catch (err: any) {
      showToast(err?.message || 'Error sharing via WeChat.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      data-testid="png-share-modal"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">
                  Share .PNG Document
                </h3>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                  WeChat &amp; WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate max-w-md">
                {title} · High-Resolution Image Export
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Close share dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel Selection Ribbon (WhatsApp vs WeChat) */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center justify-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="share-channel-tab-whatsapp"
            onClick={() => setActiveChannel('whatsapp')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-black transition cursor-pointer ${
              activeChannel === 'whatsapp'
                ? 'bg-[#25D366] text-white shadow-md'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <WhatsAppIcon className={activeChannel === 'whatsapp' ? 'text-white' : 'text-[#25D366]'} />
            <span>WhatsApp Share</span>
          </button>

          <button
            type="button"
            data-testid="share-channel-tab-wechat"
            onClick={() => setActiveChannel('wechat')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-black transition cursor-pointer ${
              activeChannel === 'wechat'
                ? 'bg-[#07C160] text-white shadow-md'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <WeChatIcon className={activeChannel === 'wechat' ? 'text-white' : 'text-[#07C160]'} />
            <span>WeChat (微信分享)</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(94vh-210px)] text-xs">
          {/* PNG Thumbnail & Document Info Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center space-x-4">
            <div className="w-16 h-16 bg-white border border-slate-300 rounded-lg p-1 shrink-0 flex items-center justify-center overflow-hidden shadow-xs relative">
              {isGenerating ? (
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
              ) : pngData?.dataUrl ? (
                <img
                  src={pngData.dataUrl}
                  alt="PNG Preview Thumbnail"
                  className="w-full h-full object-contain"
                />
              ) : (
                <FileImage className="w-6 h-6 text-slate-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 truncate text-sm">
                {pngData ? pngData.filename : createPngFilename(defaultFilename)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                <span className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                  .PNG IMAGE
                </span>
                {pngData && (
                  <>
                    <span>•</span>
                    <span>{pngData.width} × {pngData.height} px (Hi-Res 2x)</span>
                    <span>•</span>
                    <span>{Math.round(pngData.blob.size / 1024)} KB</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                data-testid="share-copy-image-btn"
                onClick={handleCopyImageOnly}
                disabled={isGenerating || !pngData}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-300 font-bold transition cursor-pointer disabled:opacity-50"
                title="Copy PNG image directly to clipboard"
              >
                {copiedClipboard ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Image</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="share-download-image-btn"
                onClick={handleDownloadOnly}
                disabled={isGenerating || !pngData}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-300 font-bold transition cursor-pointer disabled:opacity-50"
                title="Download .PNG image file"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* CHANNEL CONTENT: WHATSAPP */}
          {activeChannel === 'whatsapp' && (
            <div className="space-y-4" data-testid="whatsapp-share-panel">
              <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-3 flex items-start space-x-2.5">
                <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-800 leading-relaxed">
                  <strong>WhatsApp High-Resolution Image Delivery:</strong> On mobile devices, WhatsApp will open directly with the .PNG file attached. On computer/desktop, clicking below will copy the image to your clipboard and open WhatsApp Web so you can simply press <strong>Ctrl+V</strong> to paste the image!
                </div>
              </div>

              {/* Recipient Phone (Optional Direct Target) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Recipient WhatsApp Number (Optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    data-testid="whatsapp-phone-input"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +8801841165902, +8613800000000, or leave blank to choose in WhatsApp"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 pl-9 font-mono text-slate-900 focus:border-[#25D366] focus:bg-white outline-hidden"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px]">
                  <span className="text-slate-400">Quick Numbers:</span>
                  {companyProfile.mobiles.map((mob, idx) => (
                    <button
                      key={mob}
                      type="button"
                      onClick={() => setPhoneNumber(mob)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono border border-slate-300 cursor-pointer"
                    >
                      {idx === 0 ? 'Managing Partner' : 'Partner'}: {mob}
                    </button>
                  ))}
                  {cleanPhoneNumberForWhatsApp(phoneNumber) && (
                    <button
                      type="button"
                      onClick={() => setPhoneNumber('')}
                      className="text-rose-600 hover:underline ml-1 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* WhatsApp Message Text */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Accompanying Document Summary Message
                </label>
                <textarea
                  rows={4}
                  data-testid="whatsapp-message-textarea"
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-sans text-slate-900 focus:border-[#25D366] focus:bg-white outline-hidden leading-relaxed"
                />
              </div>

              {/* 3 Step Desktop Guide */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
                <div className="font-bold text-slate-800">Fast 3-Step Sharing on PC / Laptop:</div>
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#25D366] text-white font-bold flex items-center justify-center text-[9px] shrink-0">1</span>
                  <span>Click <strong>Share .PNG to WhatsApp</strong> below.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#25D366] text-white font-bold flex items-center justify-center text-[9px] shrink-0">2</span>
                  <span>The .PNG image is copied to your clipboard &amp; WhatsApp Web opens.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#25D366] text-white font-bold flex items-center justify-center text-[9px] shrink-0">3</span>
                  <span>In WhatsApp chat, press <strong>Ctrl+V</strong> to paste and send the high-res image!</span>
                </div>
              </div>
            </div>
          )}

          {/* CHANNEL CONTENT: WECHAT */}
          {activeChannel === 'wechat' && (
            <div className="space-y-4" data-testid="wechat-share-panel">
              <div className="bg-[#07C160]/10 border border-[#07C160]/30 rounded-xl p-3 flex items-start space-x-2.5">
                <WeChatIcon className="w-4 h-4 text-[#07C160] shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-800 leading-relaxed">
                  <strong>微信 (WeChat) 高清单据分享:</strong> 针对中国广州、昆明、上海及厦门采购客商，点击下方按钮将自动把高清 <strong>.PNG</strong> 凭单图片复制到系统剪贴板，并在微信电脑版或网页版聊天框中直接按 <strong>Ctrl+V</strong> 粘贴发送！
                </div>
              </div>

              {/* Bilingual Message Summary */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    微信单据说明文字 (WeChat Message Summary)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareText);
                      showToast('Text copied to clipboard!');
                    }}
                    className="text-[10px] text-emerald-700 hover:underline flex items-center space-x-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  data-testid="wechat-message-textarea"
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-sans text-slate-900 focus:border-[#07C160] focus:bg-white outline-hidden leading-relaxed"
                />
              </div>

              {/* Chinese Trade Partner Guidance */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
                <div className="font-bold text-slate-800">微信分享操作说明 (WeChat Instructions):</div>
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#07C160] text-white font-bold flex items-center justify-center text-[9px] shrink-0">1</span>
                  <span>点击下方 <strong>“复制 .PNG 并分享微信”</strong> 按钮。</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#07C160] text-white font-bold flex items-center justify-center text-[9px] shrink-0">2</span>
                  <span>凭证图片已复制到系统剪贴板（同时自动保存 .PNG 文件）。</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#07C160] text-white font-bold flex items-center justify-center text-[9px] shrink-0">3</span>
                  <span>打开微信聊天窗口，按 <strong>Ctrl+V</strong> 即可直接发送高清单据图片给客户！</span>
                </div>
              </div>

              {/* WeChat QR Code Scan Section */}
              {qrDataUrl && (
                <div className="border border-slate-200 rounded-xl p-3 bg-white flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={qrDataUrl}
                      alt="WeChat Scan QR Code"
                      className="w-14 h-14 border border-slate-300 rounded p-0.5 bg-white shrink-0"
                    />
                    <div>
                      <div className="font-bold text-slate-800 text-xs">
                        微信扫一扫 (WeChat Scan &amp; Verify)
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        客户可使用微信“扫一扫”实时核验装箱唛头与单据详情
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadPngFile(qrDataUrl, `ZSB_QR_${documentData?.shippingMark || 'SHIPMENT'}.png`);
                      showToast('Downloaded QR Code image.');
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold border border-slate-300 cursor-pointer"
                  >
                    Save QR
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            High-res .PNG file generated directly from trade canvas
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            {activeChannel === 'whatsapp' ? (
              <button
                type="button"
                data-testid="whatsapp-share-submit-btn"
                onClick={handleExecuteWhatsApp}
                disabled={isGenerating || isSharing}
                className="px-5 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <WhatsAppIcon className="w-4 h-4" />
                    <span>Share .PNG to WhatsApp</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                data-testid="wechat-share-submit-btn"
                onClick={handleExecuteWeChat}
                disabled={isGenerating || isSharing}
                className="px-5 py-2 bg-[#07C160] hover:bg-[#06a853] text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sharing WeChat...</span>
                  </>
                ) : (
                  <>
                    <WeChatIcon className="w-4 h-4" />
                    <span>复制 .PNG 并分享微信 (WeChat)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
