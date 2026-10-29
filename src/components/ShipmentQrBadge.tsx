import React, { useMemo, useState } from 'react';
import {
  buildShipmentDetailUrl,
  generateQrMatrix,
  ShipmentQrPayload,
} from '../utils/shipmentQrCode.ts';
import { QrCode, ExternalLink, Copy, Check } from 'lucide-react';

interface ShipmentQrBadgeProps {
  shipment: ShipmentQrPayload;
  onOpenInSystem?: (invoiceNumber: string, shippingMark?: string) => void;
  showInteractiveControls?: boolean;
  inlineStylesOnly?: boolean;
  testIdPrefix?: string;
}

export const ShipmentQrBadge: React.FC<ShipmentQrBadgeProps> = ({
  shipment,
  onOpenInSystem,
  showInteractiveControls = false,
  inlineStylesOnly = false,
  testIdPrefix = 'shipment-qr',
}) => {
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';

  const shipmentUrl = useMemo(
    () => buildShipmentDetailUrl(origin, shipment),
    [
      origin,
      shipment.id,
      shipment.invoiceNumber,
      shipment.shippingMark,
      shipment.packingDate,
    ]
  );

  const matrix = useMemo(() => generateQrMatrix(shipmentUrl), [shipmentUrl]);
  const moduleCount = matrix.length;
  const quietZone = 2;
  const viewBoxSize = moduleCount + quietZone * 2;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shipmentUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (inlineStylesOnly) {
    return (
      <div
        data-testid={`${testIdPrefix}-container`}
        style={{
          marginTop: '16px',
          padding: '12px 14px',
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '6px',
              border: '1px solid #0f172a',
              borderRadius: '6px',
              width: '92px',
              height: '92px',
              flexShrink: 0,
            }}
          >
            <svg
              data-testid={`${testIdPrefix}-svg`}
              viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
              width="100%"
              height="100%"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR Code for Shipment ${shipment.invoiceNumber}`}
            >
              <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
              {matrix.map((row, r) =>
                row.map((dark, c) =>
                  dark ? (
                    <rect
                      key={`${r}-${c}`}
                      x={c + quietZone}
                      y={r + quietZone}
                      width={1}
                      height={1}
                      fill="#0f172a"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>

          <div style={{ fontSize: '11px', color: '#0f172a', lineHeight: 1.45 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#0f172a',
              }}
            >
              DIGITAL SHIPMENT VERIFICATION &amp; SYSTEM QR LINK
            </div>
            <div style={{ color: '#334155', marginTop: '2px' }}>
              Scan QR code to open Shipment{' '}
              <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                {shipment.invoiceNumber}
              </strong>{' '}
              (Mark: <strong>{shipment.shippingMark || 'N/A'}</strong>) directly in ZSB Aquatics Packing DB.
            </div>
            <div
              data-testid={`${testIdPrefix}-url`}
              style={{
                marginTop: '4px',
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#0f766e',
                wordBreak: 'break-all',
              }}
            >
              {shipmentUrl}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`${testIdPrefix}-container`}
      className="mt-4 p-3.5 bg-slate-50 rounded-lg border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3.5">
        <div className="bg-white p-1.5 border-2 border-slate-900 rounded-md w-24 h-24 shrink-0 shadow-2xs flex items-center justify-center">
          <svg
            data-testid={`${testIdPrefix}-svg`}
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            className="w-full h-full"
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR Code for Shipment ${shipment.invoiceNumber}`}
          >
            <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
            {matrix.map((row, r) =>
              row.map((dark, c) =>
                dark ? (
                  <rect
                    key={`${r}-${c}`}
                    x={c + quietZone}
                    y={r + quietZone}
                    width={1}
                    height={1}
                    fill="#0f172a"
                  />
                ) : null
              )
            )}
          </svg>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase tracking-wider text-[11px]">
            <QrCode className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>Shipment QR Code — Direct System Lookup</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Scan or open link to inspect Export Manifest{' '}
            <strong className="font-mono text-slate-900">{shipment.invoiceNumber}</strong>{' '}
            (Mark: <strong className="text-blue-900">{shipment.shippingMark || 'N/A'}</strong>
            {shipment.destination ? ` · Dest: ${shipment.destination}` : ''}) in Packing DB.
          </p>
          <div
            data-testid={`${testIdPrefix}-url`}
            className="font-mono text-[10px] text-teal-800 bg-teal-50/90 border border-teal-200 px-2 py-0.5 rounded break-all inline-block"
          >
            {shipmentUrl}
          </div>
        </div>
      </div>

      {showInteractiveControls && (
        <div className="flex flex-wrap sm:flex-col items-stretch gap-1.5 shrink-0 print:hidden">
          {onOpenInSystem && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-open-btn`}
              onClick={() => onOpenInSystem(shipment.invoiceNumber, shipment.shippingMark)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-700 hover:bg-teal-600 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer whitespace-nowrap"
              title="Navigate directly to this shipment record in Packing DB"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Open Shipment in System</span>
            </button>
          )}
          <button
            type="button"
            data-testid={`${testIdPrefix}-copy-btn`}
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
            title="Copy direct shipment system URL"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-emerald-700">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Copy Shipment Link</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
