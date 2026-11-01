import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  ExporterRecordSharePayload,
  CopyLinkToastConfirmation,
  formatExporterRowWeChatText,
  renderExporterRowToPngData,
  shareExporterRowViaWeChat,
  generateExporterRowCardSvg,
  buildWeChatClientDeepLink,
  generateExporterRowQrCodeDataUrl,
  generateTemporaryPublicTransactionLink,
  copyTemporaryTransactionLinkToClipboard,
  buildCopyTemporaryLinkToastConfirmation,
} from '../utils/exporterWeChatShare.ts';
import {
  copyPngBlobToClipboard,
  downloadPngFile,
} from '../utils/pngShare.ts';
import { WeChatIcon } from './PngShareModal.tsx';
import {
  X,
  Eye,
  Copy,
  Check,
  Download,
  Loader2,
  Image as ImageIcon,
  QrCode,
  ExternalLink,
  Link2,
} from 'lucide-react';

export interface ExporterRecordImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: ExporterRecordSharePayload | null;
  autoTriggerWeChatShare?: boolean;
}

export const ExporterRecordImageModal: React.FC<ExporterRecordImageModalProps> = ({
  isOpen,
  onClose,
  payload,
  autoTriggerWeChatShare = false,
}) => {
  const { showToast, addAuditLog } = useApp();

  const [shareText, setShareText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedDeepLink, setCopiedDeepLink] = useState<boolean>(false);
  const [modalCopyLinkToast, setModalCopyLinkToast] =
    useState<CopyLinkToastConfirmation | null>(null);
  const [deepLinkTriggered, setDeepLinkTriggered] = useState<boolean>(false);
  const [pngResult, setPngResult] = useState<{
    dataUrl: string;
    svgDataUrl: string;
    blob: Blob;
    file: File;
    filename: string;
    width: number;
    height: number;
  } | null>(null);

  const tempPublicLinkInfo = useMemo(() => {
    if (!payload) return null;
    return generateTemporaryPublicTransactionLink(payload);
  }, [payload]);

  const transactionDeepLinkUrl = tempPublicLinkInfo?.url || '';

  const wechatClientUri = useMemo(() => {
    return buildWeChatClientDeepLink(payload || undefined);
  }, [payload]);

  const qrCodeDataUrl = useMemo(() => {
    if (!payload) return '';
    return generateExporterRowQrCodeDataUrl(payload);
  }, [payload]);

  useEffect(() => {
    if (!isOpen || !payload) {
      setPngResult(null);
      setCopiedImage(false);
      setCopiedText(false);
      setCopiedDeepLink(false);
      setModalCopyLinkToast(null);
      setDeepLinkTriggered(false);
      return;
    }

    const defaultText = formatExporterRowWeChatText(payload);
    setShareText(defaultText);

    if (autoTriggerWeChatShare) {
      setDeepLinkTriggered(true);
      if (typeof window !== 'undefined' && window.history?.replaceState && transactionDeepLinkUrl) {
        try {
          const urlObj = new URL(transactionDeepLinkUrl);
          window.history.replaceState(null, '', `${urlObj.pathname}${urlObj.search}`);
        } catch {
          // ignore
        }
      }
    }

    let isMounted = true;
    setIsGenerating(true);

    renderExporterRowToPngData(payload)
      .then(async (res) => {
        if (!isMounted) return;
        setPngResult(res);
        setIsGenerating(false);

        if (autoTriggerWeChatShare && res) {
          const clip = await copyPngBlobToClipboard(res.blob);
          if (clip.success) {
            setCopiedImage(true);
            showToast(
              `WeChat QR & Deep Link ready for Row #${payload.rowNumber} (${payload.shippingMark})! Image copied to clipboard.`
            );
          } else {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
              try {
                await navigator.clipboard.writeText(defaultText);
                setCopiedText(true);
              } catch {
                // ignore
              }
            }
            showToast(
              `WeChat QR Code & Deep Link (${wechatClientUri}) generated for Row #${payload.rowNumber} (${payload.shippingMark}).`
            );
          }
        }
      })
      .catch(() => {
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, payload, autoTriggerWeChatShare, transactionDeepLinkUrl, wechatClientUri]);

  if (!isOpen || !payload) return null;

  const fallbackSvgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    generateExporterRowCardSvg(payload)
  )}`;

  const previewSrc = pngResult?.dataUrl || fallbackSvgUrl;

  const handleCopyImage = async () => {
    if (!pngResult?.blob) {
      showToast('Preparing high-resolution PNG image...');
      return;
    }
    const res = await copyPngBlobToClipboard(pngResult.blob);
    if (res.success) {
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 3000);
      showToast('Exporter Record .PNG image copied to clipboard! Paste (Ctrl+V) in WeChat.');
    } else {
      downloadPngFile(pngResult.blob, pngResult.filename);
      showToast(`Clipboard image restricted; downloaded ${pngResult.filename} for WeChat.`);
    }
  };

  const handleCopyWeChatText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
      showToast('WeChat bilingual summary & transaction link copied to clipboard!');
    } catch {
      showToast('Could not copy text to clipboard.');
    }
  };

  const handleCopyDeepLink = async () => {
    if (!payload) return;
    const res = await copyTemporaryTransactionLinkToClipboard(payload);
    const toastInfo = buildCopyTemporaryLinkToastConfirmation(payload, res);
    setCopiedDeepLink(true);
    setModalCopyLinkToast(toastInfo);
    showToast(toastInfo.message);
    setTimeout(() => setCopiedDeepLink(false), 3500);
    setTimeout(() => setModalCopyLinkToast(null), 4500);
  };

  const handleTriggerWeChatDeepLink = async () => {
    setDeepLinkTriggered(true);

    // Update current browser URL with the transaction deep link so it can be bookmarked/shared directly
    if (typeof window !== 'undefined' && window.history?.replaceState && transactionDeepLinkUrl) {
      try {
        const urlObj = new URL(transactionDeepLinkUrl);
        window.history.replaceState(null, '', `${urlObj.pathname}${urlObj.search}`);
      } catch {
        // ignore
      }
    }

    // Copy transaction image or text to clipboard for instant paste inside WeChat
    if (pngResult?.blob) {
      const clip = await copyPngBlobToClipboard(pngResult.blob);
      if (clip.success) {
        setCopiedImage(true);
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopiedText(true);
      } catch {
        // ignore
      }
    }

    // On mobile / native WeChat environments, invoke the weixin:// protocol handler
    if (
      typeof navigator !== 'undefined' &&
      /MicroMessenger|iPhone|iPad|Android/i.test(navigator.userAgent || '')
    ) {
      try {
        window.location.assign(wechatClientUri);
      } catch {
        // ignore
      }
    }

    addAuditLog({
      action: 'EXPORT',
      module: 'Payment',
      entityId: payload.invoiceNumber,
      summary: `Triggered WeChat Deep Link (${wechatClientUri}) for Exporter Record SL #${payload.rowNumber} (${payload.shippingMark})`,
      details: `Deep Link: ${transactionDeepLinkUrl} · Balance: ¥${payload.balance.toFixed(2)}`,
    });

    showToast(
      `Triggered WeChat Deep Link (${wechatClientUri}) & copied Row #${payload.rowNumber} (${payload.shippingMark}) details!`
    );
  };

  const handleDownloadQrPng = () => {
    if (!qrCodeDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 360, 360);
        ctx.drawImage(img, 20, 20, 320, 320);
        canvas.toBlob((blob) => {
          if (blob) {
            const qrFilename = `WeChat_QR_${payload.shippingMark.replace(/[^a-zA-Z0-9_-]/g, '_')}_SL${payload.rowNumber}.png`;
            downloadPngFile(blob, qrFilename);
            showToast(`Downloaded WeChat QR Code (${qrFilename})`);
          }
        }, 'image/png');
      }
    };
    img.src = qrCodeDataUrl;
  };

  const handleDownloadPng = () => {
    if (!pngResult) {
      showToast('Preparing PNG image...');
      return;
    }
    downloadPngFile(pngResult.blob, pngResult.filename);
    showToast(`Downloaded ${pngResult.filename}`);
  };

  const handleShareByWeChat = async () => {
    if (!pngResult) {
      showToast('Preparing .PNG image for WeChat...');
      return;
    }
    setIsSharing(true);
    setDeepLinkTriggered(true);
    try {
      const result = await shareExporterRowViaWeChat({
        file: pngResult.file,
        blob: pngResult.blob,
        filename: pngResult.filename,
        text: shareText,
      });
      if (result.copiedImage) {
        setCopiedImage(true);
      }
      showToast(result.message);
      addAuditLog({
        action: 'EXPORT',
        module: 'Payment',
        entityId: payload.invoiceNumber,
        summary: `Shared Exporter Record SL #${payload.rowNumber} (${payload.shippingMark}) via WeChat`,
        details: `Debit: ¥${payload.debitAmount.toFixed(2)} · Credit: ¥${payload.creditAmount.toFixed(2)} · Balance: ¥${payload.balance.toFixed(2)} · Status: ${payload.status}`,
      });
    } catch (err: any) {
      showToast(err?.message || 'Error sharing Exporter Record via WeChat.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Exporter Record Image View and Share via WeChat - SL #${payload.rowNumber}`}
      data-testid="exporter-record-image-modal"
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border-2 border-slate-300 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Top Modal Header */}
        <div className="bg-[#0f3d4c] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#07C160]/20 text-[#4ade80] border border-[#07C160]/40">
              <WeChatIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wide">
                  Share via WeChat · QR Code &amp; Transaction Slip Image
                </h3>
                <span className="text-[10px] font-mono bg-[#07C160] text-white px-2 py-0.5 rounded-full font-black uppercase">
                  WeChat Deep Link &amp; QR · 微信扫码与深链
                </span>
              </div>
              <p className="text-xs text-teal-100 mt-0.5 font-mono">
                Row SL #{payload.rowNumber} · Mark: <strong>{payload.shippingMark}</strong> · Date: {payload.formattedDate} · Balance: <strong>¥{payload.balance.toFixed(2)}</strong> ({payload.status})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Exporter Record Image View"
            data-testid="close-exporter-record-image-modal"
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(94vh-145px)] text-xs bg-slate-50">
          {/* Top Grid: WeChat QR Code & Deep Link Panel + Transaction Details */}
          <div
            data-testid="exporter-record-wechat-qr-deeplink-panel"
            className="bg-emerald-50/70 border-2 border-[#07C160] rounded-xl p-3.5 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
          >
            {/* Left: Scannable WeChat QR Code for Current Transaction Image/Details */}
            <div className="md:col-span-4 flex flex-col items-center justify-center bg-white rounded-xl p-3 border border-emerald-200 shadow-2xs">
              <div className="flex items-center space-x-1.5 text-[11px] font-black text-[#065f46] uppercase mb-2">
                <QrCode className="w-3.5 h-3.5 text-[#07C160]" />
                <span>WeChat Scan QR (微信扫一扫)</span>
              </div>
              <div className="relative p-1.5 bg-white border-2 border-[#07C160] rounded-lg shadow-2xs">
                <img
                  src={qrCodeDataUrl}
                  alt={`WeChat Transaction QR Code for SL #${payload.rowNumber} ${payload.shippingMark}`}
                  data-testid="exporter-record-wechat-qr-code"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
                />
              </div>
              <p className="text-[10px] text-slate-600 font-semibold text-center mt-2 leading-tight">
                Scan with WeChat to open SL #{payload.rowNumber} ({payload.shippingMark}) image &amp; details
              </p>
              <button
                type="button"
                data-testid="exporter-record-download-qr-btn"
                onClick={handleDownloadQrPng}
                className="mt-2 inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-md border border-emerald-300 font-bold text-[10px] transition cursor-pointer"
              >
                <Download className="w-3 h-3 text-emerald-800" />
                <span>Download QR (.PNG)</span>
              </button>
            </div>

            {/* Right: Deep Link Trigger (weixin://) & Direct Shareable Transaction URL */}
            <div className="md:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs sm:text-sm flex items-center gap-1.5">
                    <WeChatIcon className="w-4 h-4 text-[#07C160]" />
                    <span>WeChat Deep Link &amp; Transaction Share Controls</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Launch WeChat via protocol deep link (<code className="font-mono font-bold text-emerald-800">{wechatClientUri}</code>) or share the direct transaction URL.
                  </p>
                </div>

                {deepLinkTriggered && (
                  <span
                    data-testid="exporter-record-deeplink-active-badge"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#07C160] text-white rounded-full text-[10px] font-black uppercase shadow-2xs"
                  >
                    <Check className="w-3 h-3" />
                    <span>Deep Link Ready ({wechatClientUri})</span>
                  </span>
                )}
              </div>

              {/* Action Row 1: Trigger WeChat App Deep Link (weixin://dl/chat) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="exporter-record-wechat-deeplink-btn"
                  data-wechat-uri={wechatClientUri}
                  onClick={handleTriggerWeChatDeepLink}
                  className="inline-flex items-center space-x-2 px-3.5 py-2 bg-[#07C160] hover:bg-[#06ad56] text-white font-black rounded-lg shadow-sm transition cursor-pointer text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open WeChat App Deep Link ({wechatClientUri})</span>
                </button>

                <button
                  type="button"
                  data-testid="exporter-record-copy-image-btn"
                  onClick={handleCopyImage}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-300 font-bold transition cursor-pointer text-xs"
                >
                  {copiedImage ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Slip Image Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copy Slip Image (Ctrl+V)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="exporter-record-download-png-btn"
                  onClick={handleDownloadPng}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-300 font-bold transition cursor-pointer text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-amber-700" />
                  <span>Download Slip .PNG</span>
                </button>
              </div>

              {/* Action Row 2: Temporary Public Link URL Input & Copy Link Button */}
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <label
                    htmlFor="exporter-record-deeplink-url"
                    className="flex items-center space-x-1.5 text-[10px] font-black text-slate-700 uppercase"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#0f3d4c]" />
                    <span>Secure Temporary Public Transaction Link (WeChat 24h Valid):</span>
                  </label>
                  {tempPublicLinkInfo && (
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                      Expires: {tempPublicLinkInfo.expiresAtFormatted}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id="exporter-record-deeplink-url"
                    type="text"
                    readOnly
                    data-testid="exporter-record-deeplink-input"
                    value={transactionDeepLinkUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] text-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    data-testid="exporter-record-copy-deeplink-btn"
                    onClick={handleCopyDeepLink}
                    title="Copy Link (Secure 24h Temporary Public Link for WeChat)"
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#0f3d4c] hover:bg-teal-900 text-white rounded font-bold text-[11px] transition cursor-pointer shrink-0"
                  >
                    {copiedDeepLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-amber-300" />
                        <span>Copied Link!</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                {modalCopyLinkToast && (
                  <div
                    role="status"
                    aria-live="polite"
                    data-testid="modal-copy-link-toast-confirmation"
                    className="mt-1.5 bg-emerald-900 text-white px-3 py-2 rounded-lg border border-emerald-400 flex items-center justify-between gap-2 text-[11px] font-bold shadow-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span className="truncate">{modalCopyLinkToast.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Compact Transaction Summary Pills */}
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div className="bg-white border border-teal-200 rounded-lg px-2.5 py-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Debit (应收 RMB)</div>
                  <div className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                    ¥{payload.debitAmount.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Credit (已收 RMB)</div>
                  <div className="font-mono font-black text-emerald-700 text-xs sm:text-sm">
                    ¥{payload.creditAmount.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white border border-rose-200 rounded-lg px-2.5 py-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Balance (待结 RMB)</div>
                  <div className="font-mono font-black text-rose-700 text-xs sm:text-sm">
                    ¥{payload.balance.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* High-Resolution Image View Preview Box */}
          <div className="bg-white border-2 border-teal-700/30 rounded-xl p-3 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-[#126b62]" />
                <span className="font-black text-slate-800 uppercase tracking-wider">
                  High-Resolution Exporter Record Slip Preview (.PNG Image View with Embedded QR)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                SL #{payload.rowNumber} · {payload.invoiceNumber}
              </span>
            </div>

            <div className="bg-slate-900/5 rounded-lg p-2 flex items-center justify-center overflow-hidden border border-slate-200">
              {isGenerating && !previewSrc ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
                  <Loader2 className="w-7 h-7 animate-spin text-teal-700" />
                  <span>Rendering Exporter Record Image...</span>
                </div>
              ) : (
                <img
                  src={previewSrc}
                  alt={`Exporter Record SL #${payload.rowNumber} - ${payload.shippingMark}`}
                  data-testid="exporter-record-image-preview"
                  className="w-full h-auto max-h-[320px] object-contain rounded shadow-xs bg-white"
                />
              )}
            </div>
          </div>

          {/* WeChat Bilingual Share Section */}
          <div className="bg-white border border-[#07C160]/40 rounded-xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-[#07C160]" />
                <span className="font-black text-slate-800 uppercase tracking-wide">
                  WeChat Share Summary · 微信对账说明文字 (Includes Deep Link)
                </span>
              </div>
              <button
                type="button"
                data-testid="exporter-record-copy-text-btn"
                onClick={handleCopyWeChatText}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-200 font-bold text-[11px] cursor-pointer"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied Text!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy WeChat Text</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={4}
              aria-label="WeChat Share Message Summary"
              data-testid="exporter-record-wechat-text"
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-sans text-slate-900 focus:border-[#07C160] focus:bg-white focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] font-mono text-slate-500">
            {pngResult ? `${pngResult.filename} (${pngResult.width}×${pngResult.height}px)` : '1000×580px HD PNG'}
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              data-testid="exporter-record-wechat-share-submit-btn"
              onClick={handleShareByWeChat}
              disabled={isSharing}
              className="px-5 py-2 bg-[#07C160] hover:bg-[#06ad56] text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sharing to WeChat...</span>
                </>
              ) : (
                <>
                  <WeChatIcon className="w-4 h-4" />
                  <span>Share via WeChat (微信分享)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
