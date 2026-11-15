import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Check, Eye, EyeOff, Mail, RotateCcw } from 'lucide-react';
import { loadInitialTeamMembers } from '../utils/administration.ts';
import {
  collectValidPartnerRecipients,
  resolvePartnerEmailDirectory,
  validatePartnerEmailAddress,
} from '../utils/partnerNotifications.ts';
import { formatCurrency } from '../utils/calculations.ts';
import { CompanyProfile, PartnerNotificationLogRecord } from '../types/index.ts';

interface PartnerEmailNotificationCardProps {
  companyProfile: CompanyProfile;
  partnerDirectory: string[];
  partnerNotifications: PartnerNotificationLogRecord[];
  onSetPartnerEmail: (
    partnerName: string,
    email: string
  ) => { valid: boolean; error?: string };
  onSetAlertsEnabled: (enabled: boolean) => void;
  onClearNotifications: () => void;
}

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

export const PartnerEmailNotificationCard: React.FC<PartnerEmailNotificationCardProps> = ({
  companyProfile,
  partnerDirectory,
  partnerNotifications,
  onSetPartnerEmail,
  onSetAlertsEnabled,
  onClearNotifications,
}) => {
  const alertsEnabled = companyProfile.partnerAlertsEnabled !== false;
  const currency = companyProfile.currency || 'TK';

  const teamMembers = useMemo(() => loadInitialTeamMembers(), []);

  const resolvedDirectory = useMemo(
    () =>
      resolvePartnerEmailDirectory(
        partnerDirectory,
        companyProfile.partnerEmails,
        teamMembers
      ),
    [partnerDirectory, companyProfile.partnerEmails, teamMembers]
  );

  const validRecipients = useMemo(
    () => collectValidPartnerRecipients(resolvedDirectory),
    [resolvedDirectory]
  );

  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  // Sync draft inputs whenever resolved directory or profile partnerEmails changes
  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const entry of resolvedDirectory) {
      nextDrafts[entry.partnerKey] = entry.email || '';
    }
    setEmailDrafts(nextDrafts);
  }, [resolvedDirectory]);

  const handleSavePartnerEmail = (partnerName: string, partnerKey: string) => {
    const draftValue = emailDrafts[partnerKey] ?? '';
    const validation = validatePartnerEmailAddress(draftValue);
    if (!validation.valid) {
      setEmailErrors((prev) => ({
        ...prev,
        [partnerKey]: validation.error || 'Invalid email address.',
      }));
      return;
    }

    const result = onSetPartnerEmail(partnerName, validation.cleanEmail);
    if (!result.valid) {
      setEmailErrors((prev) => ({
        ...prev,
        [partnerKey]: result.error || 'Could not save email address.',
      }));
      return;
    }

    setEmailErrors((prev) => {
      const next = { ...prev };
      delete next[partnerKey];
      return next;
    });

    const slug = toSlug(partnerName);
    setSavedSlug(slug);
    window.setTimeout(() => {
      setSavedSlug((current) => (current === slug ? null : current));
    }, 2000);
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <section
      data-testid="partner-email-notification-card"
      aria-label="Automated Partner Email Alerts via Resend API"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Mail className="w-4 h-4 text-[#1D6CE0] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 leading-snug">
              Automated Partner Email Alerts (Resend API)
            </h2>
            <p className="text-[11px] text-slate-500 leading-snug break-words">
              Automatically emails all configured partners whenever a Partner Withdrawal or Profit Distribution is issued
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            data-testid="partner-alert-recipient-count"
            className="text-xs font-mono tabular-nums font-semibold text-slate-700"
          >
            {validRecipients.length}/{resolvedDirectory.length} Email(s) Active
          </span>

          <button
            type="button"
            data-testid="toggle-partner-alerts-btn"
            aria-pressed={alertsEnabled}
            onClick={() => onSetAlertsEnabled(!alertsEnabled)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {alertsEnabled ? (
              <>
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span>Auto-Alerts: ON</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 shrink-0" />
                <span>Auto-Alerts: OFF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Partner Email Recipient Configuration Table */}
      <div className="border-b border-[#CBD8E6]">
        <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
          <span className="text-xs font-bold text-slate-800 shrink-0">
            Partner Alert Recipients
          </span>
          <span className="text-[11px] text-slate-500 leading-snug break-words">
            Emails resolve automatically from Partner Profile or Team Accounts — update or override any recipient below
          </span>
        </div>

        {resolvedDirectory.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No partners registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="partner-email-directory-table"
              className="w-full text-xs text-left border-collapse"
            >
              <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
                <tr>
                  <th className="py-2 px-3 whitespace-nowrap">Partner Name</th>
                  <th className="py-2 px-3 whitespace-nowrap">Email Source</th>
                  <th className="py-2 px-3 min-w-[260px]">Notification Email Address</th>
                  <th className="py-2 px-3 text-center w-28 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {resolvedDirectory.map((entry) => {
                  const slug = toSlug(entry.partnerName);
                  const draftVal = emailDrafts[entry.partnerKey] ?? '';
                  const rowError = emailErrors[entry.partnerKey];
                  const isSaved = savedSlug === slug;
                  const hasChanged = draftVal.trim().toLowerCase() !== (entry.email || '').trim().toLowerCase();

                  return (
                    <tr key={entry.partnerKey} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {entry.partnerName}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold ${
                            entry.source === 'profile'
                              ? 'text-[#1D6CE0]'
                              : entry.source === 'team_member'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {entry.source === 'profile'
                            ? 'Partner Profile'
                            : entry.source === 'team_member'
                              ? 'Team Account'
                              : 'Not Set'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="email"
                          data-testid={`partner-email-input-${slug}`}
                          aria-label={`Alert email for ${entry.partnerName}`}
                          value={draftVal}
                          onChange={(e) => {
                            setEmailDrafts((prev) => ({
                              ...prev,
                              [entry.partnerKey]: e.target.value,
                            }));
                            if (emailErrors[entry.partnerKey]) {
                              setEmailErrors((prev) => {
                                const next = { ...prev };
                                delete next[entry.partnerKey];
                                return next;
                              });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSavePartnerEmail(entry.partnerName, entry.partnerKey);
                            }
                          }}
                          placeholder="Enter partner email (e.g. partner@zsbaquatics.com)"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
                        />
                        {rowError && (
                          <div role="alert" className="mt-1 text-[11px] font-medium text-rose-700">
                            {rowError}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          data-testid={`save-partner-email-btn-${slug}`}
                          onClick={() => handleSavePartnerEmail(entry.partnerName, entry.partnerKey)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3 h-3 shrink-0" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <span>{hasChanged ? 'Save Email' : 'Update'}</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispatched Alert History Log */}
      <div>
        <div className="px-4 py-2.5 bg-[#F7FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              Dispatched Partner Email Alert Log
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              {partnerNotifications.length} alert(s)
            </span>
          </div>

          {partnerNotifications.length > 0 && (
            <button
              type="button"
              data-testid="clear-partner-alert-log-btn"
              onClick={onClearNotifications}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>Clear Alert Log</span>
            </button>
          )}
        </div>

        {partnerNotifications.length === 0 ? (
          <div
            data-testid="partner-alert-history-empty"
            className="p-5 text-center text-xs text-slate-500"
          >
            No email alerts triggered yet. Issue a <strong>Partner Withdrawal</strong> or <strong>Profit Distribution Payout</strong> above to automatically dispatch email notifications to all active partners.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="partner-alert-history-table"
              className="w-full text-xs text-left border-collapse"
            >
              <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
                <tr>
                  <th className="py-2 px-3 whitespace-nowrap">Sent At</th>
                  <th className="py-2 px-3 whitespace-nowrap">Trigger Event</th>
                  <th className="py-2 px-3">Email Subject &amp; Recipients</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">Amount</th>
                  <th className="py-2 px-3 whitespace-nowrap">Delivery Status</th>
                  <th className="py-2 px-3 text-center w-24 whitespace-nowrap">Email Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {partnerNotifications.map((log) => {
                  const isExpanded = expandedPreviewId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        data-testid={`partner-alert-row-${log.eventType}`}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {formatTimestamp(log.triggeredAt)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-800">
                          {log.eventType === 'partner_withdrawal'
                            ? 'Partner Withdrawal'
                            : 'Profit Distribution'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{log.subject}</div>
                          <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                            To:{' '}
                            {log.recipients.length > 0
                              ? log.recipients.map((r) => `${r.partnerName} <${r.email}>`).join(', ')
                              : 'No active recipient emails'}
                          </div>
                          {log.errorDetail && (
                            <div className="text-[11px] text-rose-700 mt-0.5">
                              {log.errorDetail}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                          {formatCurrency(log.amount, log.currency || currency)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            data-testid={`partner-alert-status-${log.id}`}
                            className={`font-semibold ${
                              log.status === 'sent_resend'
                                ? 'text-emerald-700'
                                : log.status === 'local_dispatch'
                                  ? 'text-[#1D6CE0]'
                                  : log.status === 'sending'
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                            }`}
                          >
                            {log.status === 'sent_resend'
                              ? 'Resend API Sent'
                              : log.status === 'local_dispatch'
                                ? 'Queued / Local Dispatch'
                                : log.status === 'sending'
                                  ? 'Dispatching...'
                                  : 'Delivery Failed'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            data-testid={`preview-alert-email-${log.id}`}
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpandedPreviewId((cur) => (cur === log.id ? null : log.id))
                            }
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <EyeOff className="w-3 h-3 shrink-0" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3 shrink-0" />
                                <span>Preview</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-3 bg-slate-50 border-t border-slate-200">
                            <div
                              data-testid="alert-email-preview-pane"
                              className="p-3 rounded-lg bg-white border border-[#CBD8E6] space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 border-b border-slate-200 pb-2">
                                <span>
                                  <strong>Subject:</strong> {log.subject}
                                </span>
                                {log.messageId && (
                                  <span className="font-mono">
                                    Message ID: {log.messageId}
                                  </span>
                                )}
                              </div>
                              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {log.previewText || log.summaryLine}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
