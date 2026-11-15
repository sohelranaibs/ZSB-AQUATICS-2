import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { DropdownOptions } from '../types/index.ts';
import { DEFAULT_SUPER_ADMIN_PASSWORD } from '../utils/superAdminAuth.ts';
import {
  buildPartnerDirectory,
  DEFAULT_TARGET_PARTNER_COUNT,
} from '../utils/totalBalance.ts';
import {
  Settings,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Building,
  Phone,
  MapPin,
  PenTool,
  Save,
  ShieldCheck,
  Lock,
  KeyRound,
  Mail,
  Globe,
  Archive,
  Download,
  UserPlus,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    companyProfile,
    updateCompanyProfile,
    addCompanyPartner,
    removeCompanyPartner,
    dropdownOptions,
    addDropdownItem,
    editDropdownItem,
    deleteDropdownItem,
    resetDropdowns,
    clearAllDatabaseRecords,
    superAdminPassword,
    updateSuperAdminPassword,
    snapshots,
    openSnapshotModal,
    createSnapshot,
    restoreSnapshot,
    downloadSnapshotJSON,
  } = useApp();

  // Company profile form state
  const [address, setAddress] = useState(companyProfile.address);
  const [mobile1, setMobile1] = useState(companyProfile.mobiles[0] || '+8801671036114');
  const [mobile2, setMobile2] = useState(companyProfile.mobiles[1] || '+8801841165902');
  const [email, setEmail] = useState(
    companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com'
      ? companyProfile.email
      : 'zsbaquatics@gmail.com'
  );
  const [website, setWebsite] = useState(companyProfile.website || 'www.zsbaquatics.com');
  const [managingPartner, setManagingPartner] = useState(companyProfile.managingPartner);
  const [partner, setPartner] = useState(companyProfile.partner);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [partnerError, setPartnerError] = useState('');

  const registeredPartners = buildPartnerDirectory(companyProfile, []);
  const primaryPartnerKeys = new Set(
    [companyProfile.managingPartner, companyProfile.partner]
      .map((p) => (p || '').trim().toLowerCase())
      .filter(Boolean)
  );

  // Active Category for Dropdown Management
  const [activeCategory, setActiveCategory] = useState<keyof DropdownOptions>('shippingMarks');
  const [newItemText, setNewItemText] = useState('');
  const [editingItem, setEditingItem] = useState<{ original: string; text: string } | null>(null);

  // Super Admin password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdStatus, setPwdStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null
  );

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateSuperAdminPassword(currentPwd, newPwd, confirmPwd);
    if (!res.valid) {
      setPwdStatus({
        type: 'error',
        message: res.error || 'Failed to update Super Admin password.',
      });
      return;
    }
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdStatus({
      type: 'success',
      message: 'Super Admin password updated! Use your new password when clearing records.',
    });
  };

  const categoryTitles: Record<keyof DropdownOptions, string> = {
    shippingMarks: 'Shipping Marks (32+ Presets)',
    flights: 'Flight Numbers / Airline Codes',
    destinations: 'Destinations (Guangzhou, Shanghai, etc.)',
    shippers: 'Shipper Agencies',
    exportItems: 'Export Items (2F, 3F, XXL, etc.)',
    boxes: 'Box Counts (1-9+)',
    weights: 'Weights (16-2 KG)',
    units: 'Measurement Units (KG, PCS)',
    purchaseItems: 'Purchase Items (FF1, F1, KS/3, etc.)',
    suppliers: 'Supplier Names',
    paymentDescriptions: 'Payment Ledger Descriptions',
    paymentStatuses: 'Payment Statuses (PAID, UNPAID)',
    costingCategories: 'Expense / Other Costing Categories',
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyProfile({
      address,
      mobiles: [mobile1, mobile2].filter(Boolean),
      email: email.trim() || 'zsbaquatics@gmail.com',
      website: website.trim() || 'www.zsbaquatics.com',
      managingPartner,
      partner,
    });
  };

  const handleAddPartnerInSettings = () => {
    const res = addCompanyPartner(newPartnerName);
    if (!res.valid) {
      setPartnerError(res.error || 'Please enter a valid partner name.');
      return;
    }
    setPartnerError('');
    setNewPartnerName('');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    addDropdownItem(activeCategory, newItemText.trim());
    setNewItemText('');
  };

  const handleSaveEdit = () => {
    if (!editingItem || !editingItem.text.trim()) return;
    editDropdownItem(activeCategory, editingItem.original, editingItem.text.trim());
    setEditingItem(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-[#273E56] text-white px-5 py-3 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#00897b]">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#5eead4] bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <span className="text-xl sm:text-2xl font-black tracking-tight text-amber-400 zsb-golden-brand">
            {companyProfile.companyName}
          </span>
          <span className="text-lg text-slate-400">|</span>
          <span className="text-sm sm:text-base font-semibold text-[#80cbc4] uppercase tracking-wide">
            Master Settings &amp; Dropdown Configuration
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="settings-open-snapshots-btn"
            onClick={openSnapshotModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-[#1c2a33] text-slate-200 hover:bg-[#152028] border border-[#334b59] rounded-lg transition cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-[#5eead4]" />
            <span>Database Snapshots ({snapshots.length})</span>
          </button>
          <button
            type="button"
            data-testid="settings-delete-all-records-btn"
            onClick={() => clearAllDatabaseRecords('all')}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border border-rose-400/40 rounded-lg transition cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete All Database Records</span>
          </button>
          <button
            type="button"
            onClick={resetDropdowns}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold bg-[#00897b] hover:bg-[#00796b] text-white rounded-lg transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Dropdowns</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Company Profile & Signatures Settings (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#273E56] text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between border-b border-[#1d2c35]">
              <span className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-[#5eead4]" />
                <span>COMPANY &amp; SIGNATURE DETAILS</span>
              </span>
              <span className="text-[10px] text-[#80cbc4] font-bold uppercase">
                Corporate Identity
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="p-4 space-y-3.5 text-xs">
              {/* Brand Name & Official Logo */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Company Brand &amp; Logo</label>
                <div className="p-3 bg-[#273E56] rounded-lg border border-[#1d2c35] flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#5eead4] bg-white p-0.5 shrink-0 shadow-md flex items-center justify-center">
                    <img
                      src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                      alt={companyProfile.companyName}
                      className="w-full h-full object-contain rounded-full"
                    />
                  </div>
                  <div>
                    <div className="text-xl font-black tracking-tight text-amber-400 zsb-golden-brand">
                      {companyProfile.companyName}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      Official Company Seal Logo • Integrated across all vouchers, headers &amp; PDF / PNG prints
                    </div>
                  </div>
                </div>
              </div>

              {/* Address (Font will be Black Color) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-600" />
                  <span>Address (Black Font in Prints)</span>
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-bold text-black"
                />
              </div>

              {/* Mobile Numbers (Font will be Black Color) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-slate-600" />
                    <span>Mobile 1 (Black Font)</span>
                  </label>
                  <input
                    type="text"
                    value={mobile1}
                    onChange={(e) => setMobile1(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono font-bold text-black"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-slate-600" />
                    <span>Mobile 2 (Black Font)</span>
                  </label>
                  <input
                    type="text"
                    value={mobile2}
                    onChange={(e) => setMobile2(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono font-bold text-black"
                  />
                </div>
              </div>

              {/* Email & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1">
                    <Mail className="w-3.5 h-3.5 text-slate-600" />
                    <span>EMAIL (Black Font in Prints)</span>
                  </label>
                  <input
                    type="text"
                    aria-label="EMAIL"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-black"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1">
                    <Globe className="w-3.5 h-3.5 text-slate-600" />
                    <span>WEBSITE</span>
                  </label>
                  <input
                    type="text"
                    aria-label="WEBSITE"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-black"
                  />
                </div>
              </div>

              {/* Signatures: Managing Partner & Partner */}
              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 space-y-2">
                <div className="font-bold text-amber-950 uppercase flex items-center space-x-1">
                  <PenTool className="w-3.5 h-3.5 text-amber-700" />
                  <span>SIGNATORY PROFILES (PRINT &amp; PDF SEALS)</span>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-0.5">
                    Managing Partner Name:
                  </label>
                  <input
                    type="text"
                    value={managingPartner}
                    onChange={(e) => setManagingPartner(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-0.5">
                    Partner Name:
                  </label>
                  <input
                    type="text"
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                  />
                </div>

                {/* Additional Partners (4-Partner Support + ADD PARTNER) */}
                <div className="pt-2 border-t border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-950 uppercase text-[11px]">
                      Company Partners ({registeredPartners.length}/{Math.max(DEFAULT_TARGET_PARTNER_COUNT, registeredPartners.length)})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {registeredPartners.map((pName) => {
                      const isCustom = !primaryPartnerKeys.has(pName.trim().toLowerCase());
                      return (
                        <span
                          key={pName}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-amber-300 text-slate-900 font-semibold text-[11px]"
                        >
                          <span>{pName}</span>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => removeCompanyPartner(pName)}
                              aria-label={`Remove partner ${pName}`}
                              className="p-0.5 rounded text-[10px] cursor-pointer"
                            >
                              <X className="w-3 h-3 shrink-0" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  {partnerError && (
                    <div
                      role="alert"
                      className="p-2 rounded bg-rose-50 border border-rose-200 text-[11px] font-medium text-rose-700"
                    >
                      {partnerError}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      data-testid="settings-new-partner-input"
                      value={newPartnerName}
                      onChange={(e) => setNewPartnerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPartnerInSettings();
                        }
                      }}
                      placeholder={`Enter Partner ${registeredPartners.length + 1} name`}
                      className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-900"
                    />
                    <button
                      type="button"
                      data-testid="settings-add-partner-btn"
                      onClick={handleAddPartnerInSettings}
                      className="px-2.5 py-1 rounded font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>ADD PARTNER</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#00897b] hover:bg-[#00796b] text-white py-2 rounded-lg font-bold text-xs uppercase shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Company Configuration</span>
              </button>
            </form>
          </div>

          {/* Super Admin Security & Password Configuration Card */}
          <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>SUPER ADMIN SECURITY &amp; PASSWORD</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-800 text-amber-300 font-bold uppercase">
                Protected Clear
              </span>
            </div>

            <form onSubmit={handleUpdatePassword} className="p-4 space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    {superAdminPassword === DEFAULT_SUPER_ADMIN_PASSWORD ? (
                      <>
                        Default Password Active:{' '}
                        <code className="px-1.5 py-0.5 rounded bg-amber-200/70 font-mono font-black">
                          {DEFAULT_SUPER_ADMIN_PASSWORD}
                        </code>
                      </>
                    ) : (
                      <strong>Custom Super Admin Password Active</strong>
                    )}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-rose-700 uppercase">
                  Required for Clear All
                </span>
              </div>

              <div>
                <label
                  htmlFor="settings-current-super-pwd"
                  className="font-bold text-slate-700 block mb-1"
                >
                  Current Super Admin Password
                </label>
                <input
                  id="settings-current-super-pwd"
                  data-testid="settings-current-super-pwd"
                  type="password"
                  value={currentPwd}
                  onChange={(e) => {
                    setCurrentPwd(e.target.value);
                    setPwdStatus(null);
                  }}
                  placeholder="Enter current password..."
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="settings-new-super-pwd"
                    className="font-bold text-slate-700 block mb-1"
                  >
                    New Password
                  </label>
                  <input
                    id="settings-new-super-pwd"
                    data-testid="settings-new-super-pwd"
                    type="password"
                    value={newPwd}
                    onChange={(e) => {
                      setNewPwd(e.target.value);
                      setPwdStatus(null);
                    }}
                    placeholder="Min 4 chars"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-confirm-super-pwd"
                    className="font-bold text-slate-700 block mb-1"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="settings-confirm-super-pwd"
                    data-testid="settings-confirm-super-pwd"
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => {
                      setConfirmPwd(e.target.value);
                      setPwdStatus(null);
                    }}
                    placeholder="Repeat password"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {pwdStatus && (
                <div
                  role="alert"
                  className={`p-2 rounded border text-[11px] font-bold ${
                    pwdStatus.type === 'error'
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  }`}
                >
                  {pwdStatus.message}
                </div>
              )}

              <button
                type="submit"
                data-testid="settings-save-super-pwd-btn"
                className="w-full bg-rose-700 hover:bg-rose-800 text-white py-2 rounded font-bold text-xs uppercase shadow transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Update Super Admin Password</span>
              </button>
            </form>
          </div>

          {/* Database Snapshot & Local JSON Recovery Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#273E56] text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between border-b border-[#1d2c35]">
              <span className="flex items-center space-x-2">
                <Archive className="w-4 h-4 text-[#5eead4]" />
                <span>DATABASE SNAPSHOT &amp; JSON RECOVERY</span>
              </span>
              <span className="text-[10px] font-mono text-[#80cbc4] font-bold">
                {snapshots.length} Saved
              </span>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Create local JSON archives of your current records or restore state in one click if data is accidentally cleared or corrupted.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="settings-quick-snapshot-btn"
                  onClick={() => createSnapshot(undefined, 'Created from Settings panel', 'manual')}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Snapshot</span>
                </button>
                <button
                  type="button"
                  data-testid="settings-download-snapshot-btn"
                  onClick={() => downloadSnapshotJSON()}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-[#273E56] hover:bg-[#1c2a33] text-[#5eead4] font-bold text-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .JSON</span>
                </button>
              </div>

              {snapshots.length > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <div className="font-bold text-slate-900 truncate">
                      Latest: {snapshots[0].label}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {snapshots[0].recordCounts.totalRecords} records · {snapshots[0].checksum}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-restore-latest-btn"
                    onClick={() => restoreSnapshot(snapshots[0].id)}
                    className="px-2.5 py-1.5 rounded bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-[11px] shrink-0 transition cursor-pointer"
                  >
                    Restore Latest
                  </button>
                </div>
              )}

              <button
                type="button"
                data-testid="settings-manage-snapshots-btn"
                onClick={openSnapshotModal}
                className="w-full py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#273E56] font-bold text-xs uppercase transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-[#00897b]" />
                <span>Open Snapshot &amp; Recovery Manager ({snapshots.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Master Dropdown Editor (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#273E56] text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between border-b border-[#1d2c35]">
              <span className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-[#5eead4]" />
                <span>DROPDOWN MANAGER (ADD / EDIT / DELETE)</span>
              </span>
              <span className="text-[11px] text-[#80cbc4]">
                {dropdownOptions[activeCategory].length} items in list
              </span>
            </div>

            {/* Category selector pills */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-1.5">
              {(Object.keys(categoryTitles) as Array<keyof DropdownOptions>).map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setEditingItem(null);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#00897b] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {categoryTitles[cat]}
                  </button>
                );
              })}
            </div>

            {/* Add New Item Input */}
            <form onSubmit={handleAddItem} className="p-3 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2">
              <input
                type="text"
                placeholder={`Add new option to ${categoryTitles[activeCategory]}...`}
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#1877d2] hover:bg-[#1465b5] text-white rounded text-xs font-bold uppercase transition flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </form>

            {/* List of Current Items in the Selected Category */}
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {dropdownOptions[activeCategory].map((item) => {
                  const isEditing = editingItem?.original === item;

                  if (isEditing) {
                    return (
                      <div
                        key={item}
                        className="p-1.5 bg-amber-50 rounded border border-amber-300 flex items-center space-x-1"
                      >
                        <input
                          type="text"
                          value={editingItem.text}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, text: e.target.value })
                          }
                          className="flex-1 bg-white border border-amber-400 rounded px-2 py-0.5 text-xs font-bold text-slate-900"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingItem(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item}
                      className="p-2 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-between transition"
                    >
                      <span className="font-semibold text-slate-800 truncate pr-2">
                        {item}
                      </span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => setEditingItem({ original: item, text: item })}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            deleteDropdownItem(activeCategory, item);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title={`Delete ${item}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
