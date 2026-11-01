import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  renderElementToPngBlob,
  copyPngBlobToClipboard,
  downloadPngFile,
  executePngShareToWeChat,
  formatWeChatShareText,
} from '../utils/pngShare.ts';
import {
  X,
  Copy,
  Check,
  Download,
  FileImage,
  Loader2,
  FileText,
} from 'lucide-react';

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
}) => {
  const { companyProfile, showToast, addAuditLog } = useApp();

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

  useEffect(() => {
    if (!isOpen) {
      setPngData(null);
      setCopiedClipboard(false);
      return;
    }

    setShareText(formatWeChatShareText(documentType, documentData, companyProfile.companyName));
  }, [isOpen, documentType, documentData, companyProfile.companyName]);

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
      showToast('Generating Invoice PNG image, please wait...');
      return;
    }
    const res = await copyPngBlobToClipboard(pngData.blob);
    if (res.success) {
      setCopiedClipboard(true);
      setTimeout(() => setCopiedClipboard(false), 3000);
      showToast('Invoice .PNG copied to clipboard! Paste (Ctrl+V) directly into WeChat.');
    } else {
      downloadPngFile(pngData.blob, pngData.filename);
      showToast(`Downloaded ${pngData.filename} for WeChat.`);
    }
  };

  const handleDownloadOnly = () => {
    if (!pngData) {
      showToast('Generating Invoice PNG image, please wait...');
      return;
    }
    downloadPngFile(pngData.blob, pngData.filename);
    showToast(`Downloaded Invoice: ${pngData.filename}`);
  };

  const handleExecuteWeChat = async () => {
    if (!pngData) {
      showToast('Preparing Invoice .PNG image...');
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

      if (res.copiedToClipboard) {
        setCopiedClipboard(true);
      }

      showToast(res.message);

      addAuditLog({
        action: 'EXPORT',
        module: 'Logistics',
        entityId: pngData.filename,
        summary: `Shared Invoice "${pngData.filename}" via WeChat`,
        details: `Channel: WeChat · Copied: ${res.copiedToClipboard} · Size: ${Math.round(pngData.blob.size / 1024)} KB`,
      });
    } catch (err: any) {
      showToast(err?.message || 'Error sharing Invoice via WeChat.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice View - ${title}`}
      data-testid="png-share-modal"
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border-2 border-slate-300 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Clean Invoice Header */}
        <div className="bg-[#0f3d4c] text-white px-5 py-3 flex items-center justify-between border-b-2 border-[#07C160] shrink-0">
          <div className="flex items-center space-x-2.5">
            <FileText className="w-5 h-5 text-amber-300 shrink-0" />
            <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wide truncate max-w-xl">
              INVOICE — {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close WeChat share dialog"
            data-testid="close-png-share-modal-btn"
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
            title="Close Invoice View"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice-Only Full Preview Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-100 flex items-center justify-center">
          {isGenerating ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-600">
              <Loader2 className="w-8 h-8 text-[#07C160] animate-spin" />
              <span className="text-xs font-bold">Rendering Invoice...</span>
            </div>
          ) : pngData?.dataUrl ? (
            <img
              src={pngData.dataUrl}
              alt={`Invoice - ${title}`}
              data-testid="png-share-preview-img"
              className="w-full h-auto max-h-[74vh] object-contain rounded-lg shadow-md bg-white border border-slate-200"
            />
          ) : (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <FileImage className="w-10 h-10" />
              <span className="text-xs font-semibold">Invoice preview unavailable</span>
            </div>
          )}
        </div>

        {/* Clean Action Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="share-copy-image-btn"
              onClick={handleCopyImageOnly}
              disabled={isGenerating || !pngData}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {copiedClipboard ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Invoice Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>Copy Invoice</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="share-download-image-btn"
              onClick={handleDownloadOnly}
              disabled={isGenerating || !pngData}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl border border-amber-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Download Invoice (.PNG)</span>
            </button>
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
              data-testid="wechat-share-submit-btn"
              onClick={handleExecuteWeChat}
              disabled={isGenerating || isSharing}
              className="px-5 py-2 bg-[#07C160] hover:bg-[#06a853] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center space-x-2 disabled:opacity-50"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sharing Invoice...</span>
                </>
              ) : (
                <>
                  <WeChatIcon className="w-4 h-4" />
                  <span>Share via WeChat</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
