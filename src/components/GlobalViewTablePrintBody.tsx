import React from 'react';
import { CompanyProfile } from '../types/index.ts';
import { GlobalViewTableReport } from '../utils/globalViewPdfExport.ts';
import { formatDate, formatRMB } from '../utils/calculations.ts';

interface GlobalViewTablePrintBodyProps {
  report: GlobalViewTableReport;
}

export const GlobalViewTablePrintBody: React.FC<GlobalViewTablePrintBodyProps> = ({
  report,
}) => {
  return (
    <div className="space-y-5">
      {/* Metadata Summary Grid */}
      {report.metadataGrid && report.metadataGrid.length > 0 && (
        <div
          style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs p-3 rounded border"
        >
          {report.metadataGrid.map((meta, idx) => (
            <div key={idx}>
              <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
                {meta.label}:
              </span>
              <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                {meta.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table Sections */}
      {report.sections.map((section) => (
        <div key={section.id} className="space-y-2">
          <div
            style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }}
            className="px-3 py-1.5 rounded border flex items-center justify-between"
          >
            <span className="font-black text-xs uppercase tracking-wide text-slate-900">
              {section.title}
            </span>
            {section.subtitle && (
              <span className="font-mono text-[10px] font-semibold text-slate-600">
                {section.subtitle}
              </span>
            )}
          </div>

          <table className="w-full text-[11px] border border-slate-300 border-collapse">
            <thead>
              <tr
                style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}
                className="uppercase font-bold text-[10px] border-b border-slate-300"
              >
                {section.columns.map((col, cIdx) => (
                  <th
                    key={col.key}
                    className={`p-1.5 ${
                      cIdx < section.columns.length - 1 ? 'border-r border-slate-300' : ''
                    } ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {section.rows.length > 0 ? (
                section.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="font-medium">
                    {section.columns.map((col, cIdx) => {
                      const val = row[col.key] ?? '';
                      return (
                        <td
                          key={col.key}
                          className={`p-1.5 ${
                            cIdx < section.columns.length - 1 ? 'border-r border-slate-200' : ''
                          } ${
                            col.align === 'right'
                              ? 'text-right font-mono tabular-nums'
                              : col.align === 'center'
                              ? 'text-center font-mono'
                              : 'text-left font-semibold'
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={section.columns.length}
                    className="p-4 text-center text-slate-500 font-medium"
                  >
                    No records available in this table view.
                  </td>
                </tr>
              )}
            </tbody>
            {section.footerRows && section.footerRows.length > 0 && (
              <tfoot>
                {section.footerRows.map((fRow, fIdx) => (
                  <tr
                    key={fIdx}
                    style={{ backgroundColor: '#f1f5f9' }}
                    className="font-bold border-t-2 border-slate-400 text-[11px]"
                  >
                    {fRow.cells.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        colSpan={cell.colSpan || 1}
                        className={`p-1.5 ${
                          cIdx < fRow.cells.length - 1 ? 'border-r border-slate-300' : ''
                        } ${
                          cell.align === 'right'
                            ? 'text-right font-mono tabular-nums font-black'
                            : cell.align === 'center'
                            ? 'text-center font-mono font-bold'
                            : 'text-left uppercase font-bold'
                        } ${
                          cell.tone === 'emerald'
                            ? 'text-emerald-800'
                            : cell.tone === 'rose'
                            ? 'text-rose-800'
                            : cell.tone === 'blue'
                            ? 'text-blue-900'
                            : cell.tone === 'purple'
                            ? 'text-purple-900'
                            : cell.tone === 'amber'
                            ? 'text-amber-800'
                            : 'text-slate-900'
                        }`}
                      >
                        {cell.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      ))}
    </div>
  );
};

interface GlobalOffscreenPrintHostProps {
  report: GlobalViewTableReport;
  companyProfile: CompanyProfile;
}

/**
 * Offscreen print-styled document container (#global-printable-document) that utilizes
 * the exact ZSB Aquatics print styles (.zsb-3d-text-print, official emblem, black address/mobile,
 * bordered tables, and Managing Partner / Partner signature block) for instant one-click PDF downloads
 * from any view in the application.
 */
export const GlobalOffscreenPrintHost: React.FC<GlobalOffscreenPrintHostProps> = ({
  report,
  companyProfile,
}) => {
  const isExporterSlip =
    report.activeTab === 'exporter_payment_slip' && Boolean(report.exporterSlipPayload);
  const slipData = report.exporterSlipPayload;

  return (
    <div
      id="global-pdf-export-host"
      aria-hidden="true"
      className="print:hidden"
      style={{
        position: 'fixed',
        left: '-10000px',
        top: 0,
        width: '800px',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <div
        id="global-printable-document"
        className="w-[800px] bg-white p-8 space-y-6 text-slate-900"
        style={{ backgroundColor: '#ffffff', color: '#000000' }}
      >
        {!isExporterSlip && (
          <div
            style={{ borderBottom: '2px solid #0f172a' }}
            className="pb-4 text-center space-y-1.5"
          >
            <div className="flex justify-center mb-1">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shadow-xs">
                <img
                  src={
                    companyProfile.logoUrl ||
                    '/assets/aistudio/Image_20260915140834_5_203_3ce3afae.jpg'
                  }
                  alt={companyProfile.companyName}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
            </div>

            <div
              className="zsb-3d-text-print text-3xl font-black tracking-widest uppercase"
              style={{
                color: '#f59e0b',
                fontFamily: "'Cinzel', Georgia, Cambria, 'Times New Roman', Times, serif",
                fontWeight: 900,
                letterSpacing: '0.09em',
                textShadow:
                  '1px 1px 0px #b45309, 2px 2px 0px #92400e, 3px 3px 0px #78350f, 4px 4px 0px #451a03, 5px 5px 7px rgba(15, 23, 42, 0.35)',
              }}
            >
              {companyProfile.companyName}
            </div>

            <div style={{ color: '#000000' }} className="text-xs font-bold tracking-wide">
              Address: {companyProfile.address}
            </div>

            <div style={{ color: '#000000' }} className="text-xs font-bold font-mono">
              Mobile: {companyProfile.mobiles.join(' , ')} | EMAIL:{' '}
              {companyProfile.email || 'www.zsbaquatics.com'}
            </div>

            <div
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              className="inline-block mt-2 px-5 py-1.5 rounded text-xs font-bold tracking-widest uppercase shadow-sm"
            >
              {report.documentBadge}
            </div>
          </div>
        )}

        {isExporterSlip && slipData ? (
          <div
            style={{
              fontFamily:
                '"Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif',
            }}
            className="border-2 border-black overflow-hidden"
          >
            <div
              style={{ backgroundColor: '#98486f', color: '#ffffff' }}
              className="py-3 px-4 flex items-center justify-center gap-3 border-b-2 border-black"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-300 bg-white p-0.5 shrink-0">
                <img
                  src={
                    companyProfile.logoUrl ||
                    '/assets/aistudio/Image_20260915140834_5_203_3ce3afae.jpg'
                  }
                  alt={companyProfile.companyName}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div
                className="zsb-3d-text-lg text-3xl font-black tracking-wider uppercase"
                style={{
                  color: '#ffe57f',
                  fontFamily: "'Cinzel', Georgia, Cambria, 'Times New Roman', Times, serif",
                  fontWeight: 900,
                  letterSpacing: '0.09em',
                  textShadow:
                    '0px 1px 0px #f59e0b, 1px 2px 0px #d97706, 2px 3px 0px #b45309, 3px 4px 0px #92400e, 4px 5px 0px #78350f, 5px 6px 0px #451a03, 6px 8px 10px rgba(0, 0, 0, 0.75)',
                }}
              >
                {companyProfile.companyName}
              </div>
            </div>
            <div
              style={{ backgroundColor: '#faefd0', color: '#000000' }}
              className="text-center border-b-2 border-black divide-y divide-black/20"
            >
              <div className="py-1 px-3 text-xs font-bold uppercase">
                29/B, NISHATNAGAR, TARARTEK, TURAG, DHAKA-1230
              </div>
              <div className="py-1 px-3 text-xs font-bold uppercase">
                CONTACT NUMBER - +880 18411-65902, +880 1711 331545 | EMAIL:{' '}
                <span className="normal-case">
                  {companyProfile.email || 'www.zsbaquatics.com'}
                </span>
              </div>
            </div>
            <div
              style={{ backgroundColor: '#faefd0', color: '#000000' }}
              className="py-2 px-3 text-center border-b-2 border-black font-black text-lg"
            >
              PAYMENT SLIP 付款单
            </div>
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr
                  style={{ backgroundColor: '#98486f', color: '#ffffff' }}
                  className="font-bold uppercase border-b-2 border-black"
                >
                  <th className="py-2 px-1.5 border-r-2 border-black">
                    <div>DATE</div>
                    <div className="text-[10px] font-normal">发货日期</div>
                  </th>
                  <th className="py-2 px-1.5 border-r-2 border-black">
                    <div>FLIGHT</div>
                    <div className="text-[10px] font-normal">航班名称</div>
                  </th>
                  <th className="py-2 px-1.5 border-r-2 border-black">MARK 标记</th>
                  <th className="py-2 px-1.5 border-r-2 border-black">
                    <div>BOX</div>
                    <div className="text-[10px] font-normal">箱数</div>
                  </th>
                  <th className="py-2 px-1.5 border-r-2 border-black">
                    <div>WEIGHT</div>
                    <div className="text-[10px] font-normal">/KG 重量</div>
                  </th>
                  <th className="py-2 px-1.5 border-r-2 border-black">
                    <div>AMOUNT</div>
                    <div className="text-[10px] font-normal">待结金额</div>
                  </th>
                  <th className="py-2 px-1.5">STATUS 地位</th>
                </tr>
              </thead>
              <tbody style={{ backgroundColor: '#faefd0', color: '#000000' }}>
                {Array.from({ length: Math.max(3, (slipData.rows || []).length) }).map(
                  (_, i) => {
                    const row = (slipData.rows || [])[i];
                    return (
                      <tr
                        key={i}
                        className="border-b border-black h-11 font-bold align-middle"
                      >
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? formatDate(row.date) : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black align-middle">
                          {row ? row.flight : ''}
                        </td>
                        <td className="py-1 px-2 border-r-2 border-black font-black text-2xl leading-none tracking-wider uppercase align-middle">
                          {row ? row.mark : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? row.box : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? row.weightKg : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? formatRMB(row.amount) : ''}
                        </td>
                        <td className="py-1.5 px-1.5 align-middle">
                          {row ? row.status : ''}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
              <tfoot>
                <tr
                  style={{ backgroundColor: '#98486f', color: '#ffffff' }}
                  className="border-t-2 border-b-2 border-black font-black text-xs"
                >
                  <td
                    colSpan={3}
                    className="py-2 px-3 border-r-2 border-black text-center uppercase"
                  >
                    GRAND TOTAL 累计
                  </td>
                  <td className="py-2 px-1.5 border-r-2 border-black font-mono">
                    {slipData.totals?.totalBox ?? 0}
                  </td>
                  <td className="py-2 px-1.5 border-r-2 border-black font-mono">
                    {slipData.totals?.totalWeightKg ? slipData.totals.totalWeightKg : ''}
                  </td>
                  <td className="py-2 px-1.5 border-r-2 border-black font-mono">
                    {formatRMB(slipData.totals?.totalAmount ?? 0)}
                  </td>
                  <td className="py-2 px-1.5"></td>
                </tr>
              </tfoot>
            </table>
            <div className="bg-white px-6 py-6 flex justify-end">
              <div className="text-right space-y-0.5">
                <div className="text-xs font-bold text-black uppercase">
                  YOURS FAITHFULLY - 此致
                </div>
                <div
                  style={{
                    fontFamily:
                      '"Caveat", "Brush Script MT", "Segoe Script", Georgia, cursive',
                  }}
                  className="text-3xl font-bold text-slate-900 py-0.5"
                >
                  Md. Sohel Rana
                </div>
                <div className="text-xs font-black text-black uppercase">
                  {companyProfile.partner || 'MD. SOHEL RANA'}
                </div>
                <div className="text-xs font-bold text-black uppercase">PARTNER</div>
              </div>
            </div>
          </div>
        ) : (
          <GlobalViewTablePrintBody report={report} />
        )}

        {!isExporterSlip && (
          <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="flex flex-col items-center">
              <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    color: '#0f172a',
                  }}
                  className="text-base font-bold tracking-wider"
                >
                  {companyProfile.managingPartner}
                </div>
              </div>
              <div
                style={{ color: '#0f172a' }}
                className="mt-1.5 font-bold uppercase tracking-wider text-xs"
              >
                Managing Partner
              </div>
              <div
                style={{ color: '#64748b' }}
                className="text-[10px] uppercase font-semibold"
              >
                {companyProfile.companyName}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    color: '#0f172a',
                  }}
                  className="text-base font-bold tracking-wider"
                >
                  {companyProfile.partner}
                </div>
              </div>
              <div
                style={{ color: '#0f172a' }}
                className="mt-1.5 font-bold uppercase tracking-wider text-xs"
              >
                Partner
              </div>
              <div
                style={{ color: '#64748b' }}
                className="text-[10px] uppercase font-semibold"
              >
                {companyProfile.companyName}
              </div>
            </div>
          </div>
        )}

        <div
          style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
          className="text-center text-[10px] pt-4"
        >
          This is an official computer-generated document from {companyProfile.companyName}{' '}
          System • Validated and archived.
        </div>
      </div>
    </div>
  );
};
