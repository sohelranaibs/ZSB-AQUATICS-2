import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  ExporterRecordSharePayload,
  renderExporterRowToPngData,
  generateExporterRowCardSvg,
} from '../utils/exporterWeChatShare.ts';
import {
  copyPngBlobToClipboard,
  downloadPngFile,
} from '../utils/pngShare.ts';
import {
  X,
  Copy,
  Check,
  Download,
  Loader2,
  FileText,
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
}) => {
  const { showToast } = useApp();

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [pngResult, setPngResult] = useState<{
    dataUrl: string;
    svgDataUrl: string;
    blob: Blob;
    file: File;
    filename: string;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !payload) {
      setPngResult(null);
      setCopiedImage(false);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);

    renderExporterRowToPngData(payload)
      .then((res) => {
        if (!isMounted) return;
        setPngResult(res);
        setIsGenerating(false);
      })
      .catch(() => {
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, payload]);

  if (!isOpen || !payload) return null;

  const handleCloseModal = () => {
    if (typeof window !== 'undefined' && window.history?.replaceState && window.location.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('wechat_tmp_token') || params.has('wechat_tx')) {
          params.delete('wechat_tmp_token');
          params.delete('wechat_tx');
          const nextSearch = params.toString();
          window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
          );
        }
      } catch {
        // ignore
      }
    }
    onClose();
  };

  const fallbackSvgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    generateExporterRowCardSvg(payload)
  )}`;

  const previewSrc = pngResult?.dataUrl || fallbackSvgUrl;

  const handleCopyImage = async () => {
    if (!pngResult?.blob) {
      showToast('Preparing high-resolution Invoice image...');
      return;
    }
    const res = await copyPngBlobToClipboard(pngResult.blob);
    if (res.success) {
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 3000);
      showToast('Invoice .PNG copied to clipboard!');
    } else {
      downloadPngFile(pngResult.blob, pngResult.filename);
      showToast(`Downloaded ${pngResult.filename}.`);
    }
  };

  const handleDownloadPng = () => {
    if (!pngResult) {
      showToast('Preparing Invoice PNG image...');
      return;
    }
    downloadPngFile(pngResult.blob, pngResult.filename);
    showToast(`Downloaded Invoice: ${pngResult.filename}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice View - ${payload.invoiceNumber}`}
      data-testid="exporter-record-image-modal"
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border-2 border-slate-300 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Clean Invoice Header */}
        <div className="bg-[#0f3d4c] text-white px-5 py-3 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center space-x-2.5">
            <FileText className="w-5 h-5 text-amber-300 shrink-0" />
            <div>
              <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wide">
                INVOICE — {payload.invoiceNumber} ({payload.shippingMark})
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Close Exporter Record Image View"
            data-testid="close-exporter-record-image-modal"
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice-Only Preview Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-100 flex items-center justify-center">
          {isGenerating && !previewSrc ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
              <span className="text-xs font-bold">Rendering Invoice...</span>
            </div>
          ) : (
            <img
              src={previewSrc}
              alt={`Invoice ${payload.invoiceNumber} - ${payload.shippingMark}`}
              data-testid="exporter-record-image-preview"
              className="w-full h-auto max-h-[74vh] object-contain rounded-lg shadow-md bg-white border border-slate-200"
            />
          )}
        </div>

        {/* Clean Action Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="exporter-record-copy-image-btn"
              onClick={handleCopyImage}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-300 font-bold text-xs transition cursor-pointer"
            >
              {copiedImage ? (
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
              data-testid="exporter-record-download-png-btn"
              onClick={handleDownloadPng}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl border border-amber-300 font-bold text-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Download Invoice (.PNG)</span>
            </button>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
