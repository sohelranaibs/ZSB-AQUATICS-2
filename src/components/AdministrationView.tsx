import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  TeamMember,
  TeamRole,
  loadInitialTeamMembers,
  TEAM_MEMBERS_STORAGE_KEY,
  SUPER_ADMIN_SESSION_STORAGE_KEY,
  validateTeamMember,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  toggleTeamMemberStatus,
  formatTeamMembersCSV,
  ROLE_PERMISSIONS,
  SYSTEM_PERMISSIONS,
  ROLE_DEFAULT_PERMISSION_IDS,
  RegisterAdminInput,
  validateNewAdminRegistration,
  registerNewAdmin,
} from '../utils/administration.ts';
import {
  verifySuperAdminPassword,
  DEFAULT_SUPER_ADMIN_PASSWORD,
} from '../utils/superAdminAuth.ts';
import {
  filterAuditLogs,
  calculateAuditLogStats,
  formatAuditLogsCSV,
} from '../utils/auditLogger.ts';
import { AuditLogAction, AuditLogModule } from '../types/index.ts';
import { formatDate } from '../utils/calculations.ts';
import { resolveCompanyLogoSrc } from '../utils/pdfGenerator.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Users,
  UserPlus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Archive,
  Download,
  RotateCcw,
  Search,
  Filter,
  FileSpreadsheet,
  Building,
  Mail,
  Phone,
  FileText,
  AlertTriangle,
  LogOut,
  Clock,
  Layers,
  X,
  Plus,
  Check,
  CheckSquare,
  Square,
  Key,
} from 'lucide-react';

type AdminTab = 'account' | 'team' | 'audit' | 'backups';

export const AdministrationView: React.FC = () => {
  const {
    companyProfile,
    updateCompanyProfile,
    superAdminPassword,
    updateSuperAdminPassword,
    currentUser,
    auditLogs,
    clearAuditLogs,
    snapshots,
    createSnapshot,
    restoreSnapshot,
    downloadSnapshotJSON,
    clearAllDatabaseRecords,
    purchases,
    packings,
    payments,
    otherCosts,
    showToast,
    addAuditLog,
  } = useApp();

  // Super Admin session gate state
  const [isSuperAdminVerified, setIsSuperAdminVerified] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(SUPER_ADMIN_SESSION_STORAGE_KEY);
      return saved === 'verified';
    } catch {
      return false;
    }
  });

  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active sub-tab in Administration
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('account');

  // Team Members state with local persistence
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() =>
    loadInitialTeamMembers()
  );

  useEffect(() => {
    try {
      localStorage.setItem(TEAM_MEMBERS_STORAGE_KEY, JSON.stringify(teamMembers));
    } catch {
      // Ignore quota errors
    }
  }, [teamMembers]);

  // Team Member Modal / Drawer state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState<boolean>(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [teamFormName, setTeamFormName] = useState<string>('');
  const [teamFormUsername, setTeamFormUsername] = useState<string>('');
  const [teamFormEmail, setTeamFormEmail] = useState<string>('');
  const [teamFormRole, setTeamFormRole] = useState<TeamRole>('Senior Accountant');
  const [teamFormError, setTeamFormError] = useState<string | null>(null);

  // Add New Admin Modal & Role-Based Permissions state (Super Admin exclusive)
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState<boolean>(false);
  const [adminFormName, setAdminFormName] = useState<string>('');
  const [adminFormUsername, setAdminFormUsername] = useState<string>('');
  const [adminFormEmail, setAdminFormEmail] = useState<string>('');
  const [adminFormPassword, setAdminFormPassword] = useState<string>('');
  const [adminFormConfirmPassword, setAdminFormConfirmPassword] = useState<string>('');
  const [adminFormRole, setAdminFormRole] = useState<TeamRole>('Senior Accountant');
  const [adminFormStatus, setAdminFormStatus] = useState<'active' | 'suspended'>('active');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(() =>
    ROLE_DEFAULT_PERMISSION_IDS['Senior Accountant'] || []
  );
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [adminFormError, setAdminFormError] = useState<string | null>(null);

  // Company Profile form state
  const [profileAddress, setProfileAddress] = useState(companyProfile.address);
  const [profileMobile1, setProfileMobile1] = useState(companyProfile.mobiles[0] || '+8801841165902');
  const [profileMobile2, setProfileMobile2] = useState(companyProfile.mobiles[1] || '+8801671036114');
  const [profileEmail, setProfileEmail] = useState(companyProfile.email || 'sohelranaibs@gmail.com');
  const [profileManagingPartner, setProfileManagingPartner] = useState(companyProfile.managingPartner);
  const [profilePartner, setProfilePartner] = useState(companyProfile.partner);
  const [profileRmbRate, setProfileRmbRate] = useState(String(companyProfile.rmbExchangeRate || 16.5));

  // Password change state
  const [currentPwd, setCurrentPwd] = useState<string>('');
  const [newPwd, setNewPwd] = useState<string>('');
  const [confirmPwd, setConfirmPwd] = useState<string>('');
  const [pwdStatus, setPwdStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null
  );

  // Audit Logs filter state
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<'ALL' | 'ENTRY' | 'EDIT' | 'DELETE' | 'AUTH'>('ALL');
  const [auditModuleFilter, setAuditModuleFilter] = useState<'ALL' | AuditLogModule>('ALL');
  const [auditDateFilter, setAuditDateFilter] = useState<string>('');

  // Backup form state
  const [newSnapshotLabel, setNewSnapshotLabel] = useState<string>('');
  const [newSnapshotNotes, setNewSnapshotNotes] = useState<string>('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState<boolean>(false);

  const authInputRef = useRef<HTMLInputElement>(null);

  // Unlock Super Admin session
  const handleVerifySuperAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const result = verifySuperAdminPassword(passwordInput, superAdminPassword);
    if (!result.valid) {
      setAuthError(result.error || 'Access Denied: Invalid Super Admin password.');
      authInputRef.current?.focus();
      return;
    }
    setAuthError(null);
    setPasswordInput('');
    setIsSuperAdminVerified(true);
    try {
      sessionStorage.setItem(SUPER_ADMIN_SESSION_STORAGE_KEY, 'verified');
    } catch {
      // Ignore
    }
    showToast('Super Admin verified: Access granted to Accounts & Administration.');
  };

  // Lock Super Admin session
  const handleLockSession = () => {
    setIsSuperAdminVerified(false);
    try {
      sessionStorage.removeItem(SUPER_ADMIN_SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
    showToast('Administration session locked.');
  };

  // Quick Unlock for authenticated admin testing
  const handleQuickUnlock = () => {
    setIsSuperAdminVerified(true);
    try {
      sessionStorage.setItem(SUPER_ADMIN_SESSION_STORAGE_KEY, 'verified');
    } catch {
      // Ignore
    }
    showToast('Super Admin session unlocked.');
  };

  // Profile save handler
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRate = parseFloat(profileRmbRate) || companyProfile.rmbExchangeRate || 16.5;
    updateCompanyProfile({
      address: profileAddress,
      mobiles: [profileMobile1.trim(), profileMobile2.trim()].filter(Boolean),
      email: profileEmail.trim(),
      managingPartner: profileManagingPartner.trim(),
      partner: profilePartner.trim(),
      rmbExchangeRate: parsedRate,
    });
    showToast('Company and executive partner profile updated successfully.');
  };

  // Password update handler
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
      message: 'Super Admin master password updated successfully! All protected actions now require your new password.',
    });
  };

  // Open Team Modal for Create or Edit
  const handleOpenAddTeamMember = () => {
    setEditingMemberId(null);
    setTeamFormName('');
    setTeamFormUsername('');
    setTeamFormEmail('');
    setTeamFormRole('Senior Accountant');
    setTeamFormError(null);
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeamMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setTeamFormName(member.displayName);
    setTeamFormUsername(member.username);
    setTeamFormEmail(member.email);
    setTeamFormRole(member.role);
    setTeamFormError(null);
    setIsTeamModalOpen(true);
  };

  // Team Form Submit
  const handleSaveTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateTeamMember(
      {
        displayName: teamFormName,
        username: teamFormUsername,
        email: teamFormEmail,
      },
      teamMembers,
      editingMemberId || undefined
    );

    if (!check.valid) {
      setTeamFormError(check.error || 'Validation error.');
      return;
    }

    if (editingMemberId) {
      const updated = updateTeamMember(teamMembers, editingMemberId, {
        displayName: teamFormName.trim(),
        username: teamFormUsername.trim().toLowerCase(),
        email: teamFormEmail.trim().toLowerCase(),
        role: teamFormRole,
      });
      setTeamMembers(updated);
      showToast(`Updated team member "${teamFormName.trim()}".`);
    } else {
      const { updatedList, createdMember } = addTeamMember(teamMembers, {
        displayName: teamFormName.trim(),
        username: teamFormUsername.trim().toLowerCase(),
        email: teamFormEmail.trim().toLowerCase(),
        role: teamFormRole,
        status: 'active',
      });
      setTeamMembers(updatedList);
      showToast(`Added new team member "${createdMember.displayName}" (${createdMember.role}).`);
    }

    setIsTeamModalOpen(false);
  };

  // Toggle Member Status
  const handleToggleMember = (id: string) => {
    const res = toggleTeamMemberStatus(teamMembers, id);
    if (!res.success) {
      showToast(res.error || 'Action failed.');
      return;
    }
    setTeamMembers(res.updatedList);
    showToast('Updated team member access status.');
  };

  // Delete Member
  const handleDeleteMember = (id: string) => {
    const res = deleteTeamMember(teamMembers, id);
    if (!res.success) {
      showToast(res.error || 'Cannot delete member.');
      return;
    }
    setTeamMembers(res.updatedList);
    showToast('Removed team member account.');
  };

  // Export Team CSV
  const handleExportTeamCSV = () => {
    const csv = formatTeamMembersCSV(teamMembers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZSB_AQUATICS_Team_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Team roster exported as CSV.');
  };

  // --------------------------------------------------------------------------
  // ADD NEW ADMIN: Super Admin Clearance & Role-Based Permissions
  // --------------------------------------------------------------------------
  const handleOpenAddNewAdmin = () => {
    if (!isSuperAdminVerified) {
      showToast('Security Clearance Denied: Only verified Super Admins can register new administrator accounts.');
      return;
    }
    setAdminFormName('');
    setAdminFormUsername('');
    setAdminFormEmail('');
    setAdminFormPassword('');
    setAdminFormConfirmPassword('');
    const defaultRole: TeamRole = 'Senior Accountant';
    setAdminFormRole(defaultRole);
    setSelectedPermissionIds(ROLE_DEFAULT_PERMISSION_IDS[defaultRole] || []);
    setAdminFormStatus('active');
    setShowAdminPassword(false);
    setAdminFormError(null);
    setIsAddAdminModalOpen(true);
  };

  const handleAdminRoleChange = (newRole: TeamRole) => {
    setAdminFormRole(newRole);
    // Prefill with role recommended permission defaults
    setSelectedPermissionIds(ROLE_DEFAULT_PERMISSION_IDS[newRole] || []);
  };

  const handleTogglePermission = (permId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSelectAllPermissions = () => {
    setSelectedPermissionIds(SYSTEM_PERMISSIONS.map((p) => p.id));
  };

  const handleResetRoleDefaultPermissions = () => {
    setSelectedPermissionIds(ROLE_DEFAULT_PERMISSION_IDS[adminFormRole] || []);
  };

  const handleDeselectAllPermissions = () => {
    setSelectedPermissionIds([]);
  };

  const handleSaveNewAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdminVerified) {
      setAdminFormError('Security Clearance Denied: Only verified Super Admins can register new administrator accounts.');
      return;
    }

    // Resolve human-readable permission labels for storage
    const permissionLabels = selectedPermissionIds
      .map((id) => SYSTEM_PERMISSIONS.find((p) => p.id === id)?.label)
      .filter((l): l is string => Boolean(l));

    const input: RegisterAdminInput = {
      displayName: adminFormName.trim(),
      username: adminFormUsername.trim(),
      email: adminFormEmail.trim(),
      password: adminFormPassword.trim(),
      confirmPassword: adminFormConfirmPassword.trim(),
      role: adminFormRole,
      status: adminFormStatus,
      permissions: permissionLabels,
    };

    const validation = validateNewAdminRegistration(input, teamMembers, isSuperAdminVerified);
    if (!validation.valid) {
      setAdminFormError(validation.error || 'Failed to register administrator.');
      return;
    }

    const { updatedList, createdAdmin } = registerNewAdmin(teamMembers, input);
    setTeamMembers(updatedList);
    setIsAddAdminModalOpen(false);

    // Tamper-evident audit log
    addAuditLog({
      action: 'AUTH',
      module: 'Administration',
      entityId: `USR-${createdAdmin.username.toUpperCase()}`,
      summary: `Super Admin registered new administrator "${createdAdmin.displayName}" (${createdAdmin.role})`,
      details: `Role: ${createdAdmin.role} · Email: ${createdAdmin.email} · Permissions: ${createdAdmin.permissions.length} granted · Status: ${createdAdmin.status}`,
      actor: `${currentUser?.displayName || 'Md. Sohel Rana'} (Super Admin)`,
    });

    showToast(`Administrator account "${createdAdmin.displayName}" (${createdAdmin.role}) registered successfully!`);
  };

  // Create Snapshot
  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingSnapshot(true);
    const snap = createSnapshot(
      newSnapshotLabel.trim() || undefined,
      newSnapshotNotes.trim() || undefined,
      'manual'
    );
    setNewSnapshotLabel('');
    setNewSnapshotNotes('');
    setIsCreatingSnapshot(false);
    showToast(`Database snapshot "${snap.label}" created successfully.`);
  };

  // Audit Logs filtered list
  const filteredAuditLogs = useMemo(
    () =>
      filterAuditLogs(auditLogs, {
        searchQuery: auditSearch,
        actionFilter: auditActionFilter,
        moduleFilter: auditModuleFilter,
        dateFilter: auditDateFilter,
      }),
    [auditLogs, auditSearch, auditActionFilter, auditModuleFilter, auditDateFilter]
  );

  const auditStats = useMemo(() => calculateAuditLogStats(auditLogs), [auditLogs]);

  // Export Audit CSV
  const handleExportAuditCSV = () => {
    const csvContent = formatAuditLogsCSV(filteredAuditLogs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZSB_AQUATICS_Audit_History_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported audit history as CSV.');
  };

  // Export Audit JSON
  const handleExportAuditJSON = () => {
    const jsonStr = JSON.stringify(filteredAuditLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZSB_AQUATICS_Audit_History_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported audit history as JSON.');
  };

  const resolvedLogoSrc = resolveCompanyLogoSrc(companyProfile.logoUrl);

  // --------------------------------------------------------------------------
  // LOCKED SCREEN: Super Admin Verification Barrier
  // --------------------------------------------------------------------------
  if (!isSuperAdminVerified) {
    return (
      <div
        className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6"
        data-testid="admin-auth-barrier"
      >
        <div className="w-full max-w-xl bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header Bar with Golden Branding */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-5 border-b border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shrink-0 flex items-center justify-center shadow-md">
                <img
                  src={resolvedLogoSrc}
                  alt={companyProfile.companyName}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.endsWith(COMPANY_LOGO_URL)) {
                      target.src = COMPANY_LOGO_URL;
                    }
                  }}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div>
                <h1 className="zsb-3d-text text-xl font-black text-amber-300">
                  Accounts &amp; Administration
                </h1>
                <p className="text-xs font-mono text-amber-200/80">
                  ZSB AQUATICS · Super Admin Security Vault
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-400/40 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Core User Requirement Notice */}
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex items-start space-x-3">
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-black text-amber-300 uppercase tracking-wider text-[11px]">
                  Super Admin Authorization Required
                </div>
                <p className="text-amber-100 font-medium leading-relaxed">
                  Only Super Admin can manage your account, team access, audit history and data backups.
                </p>
              </div>
            </div>

            {authError && (
              <div
                role="alert"
                className="bg-rose-950/80 border border-rose-500/60 rounded-xl p-3.5 flex items-center space-x-2.5 text-xs text-rose-200 font-semibold"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleVerifySuperAdmin} className="space-y-5">
              <div>
                <label
                  htmlFor="admin-password-gate-input"
                  className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2"
                >
                  Super Admin Master Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password-gate-input"
                    ref={authInputRef}
                    data-testid="admin-password-gate-input"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    placeholder="Enter Super Admin password"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white rounded-xl px-4 py-3 text-sm font-mono placeholder:text-slate-600 outline-hidden transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  data-testid="admin-unlock-btn"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-5 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Unlock className="w-4 h-4 stroke-[2.5]" />
                  <span>Verify &amp; Unlock Console</span>
                </button>

                {superAdminPassword === DEFAULT_SUPER_ADMIN_PASSWORD && (
                  <button
                    type="button"
                    data-testid="admin-quick-unlock-btn"
                    onClick={handleQuickUnlock}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                    title="Quick unlock with default Super Admin credentials (admin123)"
                  >
                    Quick Unlock (admin123)
                  </button>
                )}
              </div>
            </form>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Super Admin: <strong>Md. Sohel Rana</strong></span>
              </div>
              <span>Session: Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // UNLOCKED: Main Accounts & Administration Sheet
  // --------------------------------------------------------------------------
  return (
    <div
      className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6"
      data-testid="administration-view"
    >
      {/* Executive Command Banner */}
      <div className="bg-gradient-to-r from-[#111c2e] via-[#1a2d4b] to-[#111c2e] text-white p-5 sm:p-6 rounded-2xl shadow-xl border-2 border-amber-500/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shrink-0 shadow-lg flex items-center justify-center">
              <img
                src={resolvedLogoSrc}
                alt={companyProfile.companyName}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith(COMPANY_LOGO_URL)) {
                    target.src = COMPANY_LOGO_URL;
                  }
                }}
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="zsb-3d-text text-2xl sm:text-3xl font-black text-amber-300">
                  Accounts &amp; Administration
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Super Admin Verified</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 mt-1 font-medium">
                Only Super Admin can manage your account, team access, audit history and data backups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
            <div className="text-right text-xs text-slate-300 pr-2 hidden sm:block">
              <div className="font-bold text-white">
                {currentUser?.displayName || 'Md. Sohel Rana'}
              </div>
              <div className="text-[11px] text-amber-400 font-mono">
                Partner &amp; Super Admin
              </div>
            </div>

            <button
              type="button"
              data-testid="admin-add-new-admin-btn"
              onClick={handleOpenAddNewAdmin}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md transition cursor-pointer"
              title="Register a new administrator with role-based access permissions"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add New Admin</span>
            </button>

            <button
              type="button"
              data-testid="admin-lock-session-btn"
              onClick={handleLockSession}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl shadow transition cursor-pointer"
              title="Lock administration session immediately"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock Console</span>
            </button>
          </div>
        </div>

        {/* 4 Core Pillars KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/80">
          {/* Pillar 1: Account */}
          <div
            onClick={() => setActiveAdminTab('account')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              activeAdminTab === 'account'
                ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-1">
              <span>01. ACCOUNT</span>
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-base font-black truncate">{companyProfile.partner}</div>
            <div className="text-[10px] text-slate-400 truncate">Managing Partner Credentials</div>
          </div>

          {/* Pillar 2: Team Access */}
          <div
            onClick={() => setActiveAdminTab('team')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              activeAdminTab === 'team'
                ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-1">
              <span>02. TEAM ACCESS</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-base font-black">{teamMembers.length} Members</div>
            <div className="text-[10px] text-slate-400 truncate">
              {teamMembers.filter((m) => m.status === 'active').length} Active Accounts
            </div>
          </div>

          {/* Pillar 3: Audit History */}
          <div
            onClick={() => setActiveAdminTab('audit')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              activeAdminTab === 'audit'
                ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-1">
              <span>03. AUDIT HISTORY</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-base font-black">{auditLogs.length} Events</div>
            <div className="text-[10px] text-slate-400 truncate">Tamper-Proof Audit Trail</div>
          </div>

          {/* Pillar 4: Backups */}
          <div
            onClick={() => setActiveAdminTab('backups')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              activeAdminTab === 'backups'
                ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-1">
              <span>04. DATA BACKUPS</span>
              <Archive className="w-3.5 h-3.5" />
            </div>
            <div className="text-base font-black">{snapshots.length} Snapshots</div>
            <div className="text-[10px] text-slate-400 truncate">Instant JSON Vault Recovery</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          data-testid="admin-subtab-account"
          onClick={() => setActiveAdminTab('account')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'account'
              ? 'bg-[#1b2b44] text-amber-300 shadow-md border border-amber-500/40'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Account Management</span>
        </button>

        <button
          type="button"
          data-testid="admin-subtab-team"
          onClick={() => setActiveAdminTab('team')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'team'
              ? 'bg-[#1b2b44] text-amber-300 shadow-md border border-amber-500/40'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Access Control ({teamMembers.length})</span>
        </button>

        <button
          type="button"
          data-testid="admin-subtab-audit"
          onClick={() => setActiveAdminTab('audit')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'audit'
              ? 'bg-[#1b2b44] text-amber-300 shadow-md border border-amber-500/40'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Audit History &amp; Compliance ({auditLogs.length})</span>
        </button>

        <button
          type="button"
          data-testid="admin-subtab-backups"
          onClick={() => setActiveAdminTab('backups')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'backups'
              ? 'bg-[#1b2b44] text-amber-300 shadow-md border border-amber-500/40'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Data Backups &amp; Snapshots ({snapshots.length})</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: ACCOUNT MANAGEMENT                                            */}
      {/* -------------------------------------------------------------------- */}
      {activeAdminTab === 'account' && (
        <div className="space-y-6" data-testid="admin-account-panel">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Primary Partners Executive Profile */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Primary Partner Accounts
                    </h2>
                    <p className="text-xs text-slate-500">
                      Executive signatures, partner credentials &amp; contact parameters
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                  ZSB-HQ-01
                </span>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Partner / Super Admin
                    </label>
                    <input
                      type="text"
                      value={profilePartner}
                      onChange={(e) => setProfilePartner(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Managing Partner
                    </label>
                    <input
                      type="text"
                      value={profileManagingPartner}
                      onChange={(e) => setProfileManagingPartner(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Registered Headquarters Address
                  </label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-semibold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Primary Mobile
                    </label>
                    <input
                      type="text"
                      value={profileMobile1}
                      onChange={(e) => setProfileMobile1(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Secondary Mobile
                    </label>
                    <input
                      type="text"
                      value={profileMobile2}
                      onChange={(e) => setProfileMobile2(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      RMB Rate (TK)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={profileRmbRate}
                      onChange={(e) => setProfileRmbRate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono text-slate-900 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Official Email / Portal Contact
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    data-testid="admin-save-profile-btn"
                    className="bg-[#2f75b5] hover:bg-[#255e92] text-white font-bold px-4 py-2 rounded-lg shadow transition cursor-pointer"
                  >
                    Save Partner Profile
                  </button>
                </div>
              </form>
            </div>

            {/* Master Super Admin Password Management */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-purple-100 text-purple-800 rounded-lg">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Super Admin Master Password
                    </h2>
                    <p className="text-xs text-slate-500">
                      Protects destructive operations, backups, and administrative clearance
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-mono bg-purple-50 text-purple-800 border border-purple-200 px-2 py-1 rounded">
                  VAULT KEY
                </span>
              </div>

              {pwdStatus && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
                    pwdStatus.type === 'error'
                      ? 'bg-rose-50 border border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}
                >
                  {pwdStatus.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{pwdStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Current Master Password
                  </label>
                  <input
                    type="password"
                    data-testid="admin-current-pwd-input"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="Enter current password (default: admin123)"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      New Master Password
                    </label>
                    <input
                      type="password"
                      data-testid="admin-new-pwd-input"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      data-testid="admin-confirm-pwd-input"
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                  <strong>Security Note:</strong> Updating this master password will immediately require the new password when clearing database sheets, accessing administration tools, or restoring backups.
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    data-testid="admin-update-pwd-btn"
                    className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-4 py-2 rounded-lg shadow transition cursor-pointer"
                  >
                    Update Master Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: TEAM ACCESS CONTROL                                           */}
      {/* -------------------------------------------------------------------- */}
      {activeAdminTab === 'team' && (
        <div className="space-y-6" data-testid="admin-team-panel">
          <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
            {/* Table Action Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>Team Access Roster</span>
                  <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    {teamMembers.length} Accounts
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage individual accounts, role-based permissions, and user access status
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  data-testid="admin-export-team-btn"
                  onClick={handleExportTeamCSV}
                  className="flex items-center space-x-1 px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  data-testid="team-add-admin-btn"
                  onClick={handleOpenAddNewAdmin}
                  className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow transition cursor-pointer"
                  title="Register a new administrator with role-based access permissions"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-950" />
                  <span>+ Add New Admin</span>
                </button>

                <button
                  type="button"
                  data-testid="admin-add-team-btn"
                  onClick={handleOpenAddTeamMember}
                  className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Team Member</span>
                </button>
              </div>
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1b2b44] text-white font-bold uppercase text-[11px] border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Member / Name</th>
                    <th className="py-3 px-4">Username &amp; Email</th>
                    <th className="py-3 px-4">Role &amp; Clearance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {teamMembers.map((member) => (
                    <tr
                      key={member.id}
                      data-testid={`team-row-${member.username}`}
                      className="hover:bg-slate-50 transition"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-xs shrink-0">
                            {member.displayName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {member.displayName}
                            </div>
                            {member.isRoot && (
                              <span className="text-[10px] text-amber-700 font-bold">
                                Core Partner Account
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="text-slate-900 font-semibold">@{member.username}</div>
                        <div className="text-slate-500 text-[11px]">{member.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide ${
                            member.role === 'Super Admin'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : member.role === 'Managing Partner'
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                              : member.role === 'Senior Accountant'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : member.role === 'Logistics Manager'
                              ? 'bg-teal-100 text-teal-900 border border-teal-300'
                              : 'bg-slate-100 text-slate-800 border border-slate-300'
                          }`}
                        >
                          {member.role}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs">
                          {member.permissions.slice(0, 2).join(' · ')}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            member.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1 ${
                              member.status === 'active' ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                          {member.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {member.lastLogin ? formatDate(member.lastLogin) : 'Pending first login'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTeamMember(member)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition cursor-pointer"
                            title="Edit Role / Info"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!member.isRoot && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleMember(member.id)}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                                  member.status === 'active'
                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                    : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                }`}
                                title={
                                  member.status === 'active'
                                    ? 'Suspend Access'
                                    : 'Activate Access'
                                }
                              >
                                {member.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteMember(member.id)}
                                className="p-1.5 text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Delete Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Reference Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-700 space-y-3 text-xs">
            <h3 className="font-bold text-amber-300 text-sm flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Role Clearance &amp; Access Matrix</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px]">
              {Object.entries(ROLE_PERMISSIONS).slice(0, 3).map(([role, perms]) => (
                <div key={role} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="font-bold text-amber-400 mb-1">{role}</div>
                  <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                    {perms.map((p) => (
                      <li key={p} className="truncate">{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: AUDIT HISTORY & COMPLIANCE                                    */}
      {/* -------------------------------------------------------------------- */}
      {activeAdminTab === 'audit' && (
        <div className="space-y-6" data-testid="admin-audit-panel">
          {/* Audit Controls & Export Bar */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entity, summary..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2"
                />
              </div>

              <div>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold"
                >
                  <option value="ALL">All Actions</option>
                  <option value="ENTRY">ENTRY (Created)</option>
                  <option value="EDIT">EDIT (Modified)</option>
                  <option value="DELETE">DELETE (Removed)</option>
                  <option value="AUTH">AUTH (Logins &amp; Clearance)</option>
                </select>
              </div>

              <div>
                <select
                  value={auditModuleFilter}
                  onChange={(e) => setAuditModuleFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold"
                >
                  <option value="ALL">All Modules</option>
                  <option value="Purchase">Purchase DB</option>
                  <option value="Packing">Packing Manifest</option>
                  <option value="Payment">Payment Vouchers</option>
                  <option value="Mortality">Mortality Logs</option>
                  <option value="Database">Database Operations</option>
                  <option value="Settings">Settings &amp; Config</option>
                  <option value="Authentication">Authentication</option>
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={auditDateFilter}
                  onChange={(e) => setAuditDateFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                data-testid="admin-export-audit-csv-btn"
                onClick={handleExportAuditCSV}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                data-testid="admin-export-audit-json-btn"
                onClick={handleExportAuditJSON}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg shadow transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to clear the entire audit trail? This action is permanent.')) {
                    clearAuditLogs();
                    showToast('Audit trail cleared by Super Admin.');
                  }
                }}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer"
                title="Clear audit trail"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800">
                Showing {filteredAuditLogs.length} of {auditLogs.length} Logged Events
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                Tamper-Evident System Audit Trail
              </span>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1b2b44] text-white font-bold uppercase text-[10.5px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3">Entity / ID</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Summary &amp; Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No audit events match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDate(log.timestamp)} {new Date(log.timestamp).toLocaleTimeString()}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              log.action === 'CREATE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.action === 'UPDATE'
                                ? 'bg-blue-100 text-blue-800'
                                : log.action === 'DELETE'
                                ? 'bg-rose-100 text-rose-800'
                                : log.action === 'CLEAR'
                                ? 'bg-red-200 text-red-950 font-black'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                          {log.module}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-slate-900 font-bold whitespace-nowrap">
                          {log.entityId || '-'}
                        </td>

                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {log.actor}
                        </td>

                        <td className="py-2.5 px-3 text-slate-800">
                          <div className="font-medium">{log.summary}</div>
                          {log.details && (
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {log.details}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 4: DATA BACKUPS & RECOVERY                                       */}
      {/* -------------------------------------------------------------------- */}
      {activeAdminTab === 'backups' && (
        <div className="space-y-6" data-testid="admin-backups-panel">
          {/* Create Manual Snapshot Box */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Create Instant Database Snapshot
                  </h2>
                  <p className="text-xs text-slate-500">
                    Back up all ledgers, profile, dropdowns, and active manifests into a local recovery point
                  </p>
                </div>
              </div>
              <span className="text-xs bg-indigo-50 text-indigo-800 font-bold px-2.5 py-1 rounded-full border border-indigo-200">
                {snapshots.length} Archival Snapshots
              </span>
            </div>

            <form onSubmit={handleCreateSnapshot} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Snapshot Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of Month Balance"
                  value={newSnapshotLabel}
                  onChange={(e) => setNewSnapshotLabel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Backup Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by Md. Sohel Rana"
                  value={newSnapshotNotes}
                  onChange={(e) => setNewSnapshotNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isCreatingSnapshot}
                  data-testid="admin-create-snapshot-btn"
                  className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded shadow transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Create Snapshot</span>
                </button>
              </div>
            </form>
          </div>

          {/* Existing Snapshots Archive Table */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Archived Snapshots &amp; Point-in-Time Recovery
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Safe local JSON backups
              </span>
            </div>

            {snapshots.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No database snapshots saved yet. Click &quot;Create Snapshot&quot; above to archive your database.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {snap.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            snap.trigger === 'manual'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {snap.trigger}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {formatDate(snap.createdAt)} {new Date(snap.createdAt).toLocaleTimeString()} ·{' '}
                        {snap.recordCounts.totalRecords} Total Records (
                        {snap.recordCounts.purchases} Purchases, {snap.recordCounts.packings} Packings,{' '}
                        {snap.recordCounts.payments} Payments)
                      </div>
                      {snap.notes && (
                        <div className="text-xs text-slate-600 mt-1 italic">
                          &quot;{snap.notes}&quot;
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => downloadSnapshotJSON(snap.id)}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 transition flex items-center space-x-1 cursor-pointer"
                        title="Download JSON Backup"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-700" />
                        <span>Download JSON</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Restore snapshot "${snap.label}"? Your current state will be safely snapshotted first.`)) {
                            restoreSnapshot(snap.id);
                            showToast(`Restored snapshot "${snap.label}".`);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow transition flex items-center space-x-1 cursor-pointer"
                        title="Restore this snapshot"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Emergency Database Clearance / Wipe (Super Admin Protected) */}
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
                <h4 className="font-bold text-rose-900 text-sm">
                  Emergency Database Clear &amp; Reset
                </h4>
              </div>
              <p className="text-xs text-rose-800 max-w-xl">
                Permanently purge all active transaction records across purchases, packing manifests, and payment ledgers. A safety snapshot is automatically created prior to clearance.
              </p>
            </div>

            <button
              type="button"
              data-testid="admin-emergency-clear-btn"
              onClick={() => clearAllDatabaseRecords('all')}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow transition shrink-0 cursor-pointer flex items-center space-x-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Database Records</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: Add / Edit Team Member                                        */}
      {/* -------------------------------------------------------------------- */}
      {isTeamModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden">
            <div className="bg-[#1b2b44] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm text-amber-300 flex items-center space-x-2">
                <UserPlus className="w-4 h-4" />
                <span>{editingMemberId ? 'Edit Team Member' : 'Add New Team Member'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeamMember} className="p-5 space-y-4 text-xs">
              {teamFormError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 font-semibold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teamFormError}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  required
                  value={teamFormName}
                  onChange={(e) => setTeamFormName(e.target.value)}
                  placeholder="e.g. Anisur Rahman"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={teamFormUsername}
                    onChange={(e) => setTeamFormUsername(e.target.value)}
                    placeholder="e.g. anisur"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={teamFormRole}
                    onChange={(e) => setTeamFormRole(e.target.value as TeamRole)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-bold text-slate-900"
                  >
                    <option value="Senior Accountant">Senior Accountant</option>
                    <option value="Logistics Manager">Logistics Manager</option>
                    <option value="Depot Dispatcher">Depot Dispatcher</option>
                    <option value="Managing Partner">Managing Partner</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Read Only">Read Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  value={teamFormEmail}
                  onChange={(e) => setTeamFormEmail(e.target.value)}
                  placeholder="e.g. anisur@zsbaquatics.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="admin-save-member-btn"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow transition cursor-pointer"
                >
                  {editingMemberId ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* -------------------------------------------------------------------- */}
      {/* MODAL: Register New Administrator (Role-Based Permissions)           */}
      {/* -------------------------------------------------------------------- */}
      {isAddAdminModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          data-testid="add-new-admin-modal"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#1b2b44] text-white px-5 py-4 flex items-center justify-between border-b border-amber-500/40 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-amber-300 flex items-center space-x-2">
                    <span>Register New Administrator</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                      Super Admin Only
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Assign credentials, administrative clearance, and custom granular module permissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAdminModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSaveNewAdmin} className="flex flex-col overflow-hidden text-xs">
              <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-130px)]">
                {/* Super Admin Authorization Clearance Banner */}
                <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-3 flex items-start space-x-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-900 leading-relaxed">
                    <strong className="font-bold text-amber-950">Super Admin Clearance Active:</strong> You are authorizing a new administrative user with direct access to ZSB Aquatics trade and financial records.
                  </div>
                </div>

                {adminFormError && (
                  <div
                    role="alert"
                    className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-semibold flex items-center space-x-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{adminFormError}</span>
                  </div>
                )}

                {/* Section 1: User Identity & Role */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5 pb-1 border-b border-slate-200">
                    <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                    <span>1. Identity &amp; System Role</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Full Name / Display Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        data-testid="new-admin-name-input"
                        value={adminFormName}
                        onChange={(e) => setAdminFormName(e.target.value)}
                        placeholder="e.g. Tariqul Islam"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-amber-500 focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Username <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        data-testid="new-admin-username-input"
                        value={adminFormUsername}
                        onChange={(e) => setAdminFormUsername(e.target.value)}
                        placeholder="e.g. tariqul"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:border-amber-500 focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Official Email Address <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        data-testid="new-admin-email-input"
                        value={adminFormEmail}
                        onChange={(e) => setAdminFormEmail(e.target.value)}
                        placeholder="e.g. tariqul@zsbaquatics.com"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:border-amber-500 focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Administrative Role <span className="text-rose-600">*</span>
                      </label>
                      <select
                        data-testid="new-admin-role-select"
                        value={adminFormRole}
                        onChange={(e) => handleAdminRoleChange(e.target.value as TeamRole)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-hidden"
                      >
                        <option value="Senior Accountant">Senior Accountant</option>
                        <option value="Logistics Manager">Logistics Manager</option>
                        <option value="Depot Dispatcher">Depot Dispatcher</option>
                        <option value="Managing Partner">Managing Partner</option>
                        <option value="Super Admin">Super Admin</option>
                        <option value="Read Only">Read Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Credentials & Access Status */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5 pb-1 border-b border-slate-200">
                    <Key className="w-3.5 h-3.5 text-purple-600" />
                    <span>2. Authentication &amp; Initial Status</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">
                          Password <span className="text-rose-600">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="text-[10px] text-slate-500 hover:text-slate-800 font-medium"
                        >
                          {showAdminPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        data-testid="new-admin-password-input"
                        value={adminFormPassword}
                        onChange={(e) => setAdminFormPassword(e.target.value)}
                        placeholder="Min. 4 characters"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:border-amber-500 focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Confirm Password <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        data-testid="new-admin-confirm-password-input"
                        value={adminFormConfirmPassword}
                        onChange={(e) => setAdminFormConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:border-amber-500 focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Account Initial Status
                    </label>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="adminStatus"
                          value="active"
                          checked={adminFormStatus === 'active'}
                          onChange={() => setAdminFormStatus('active')}
                          className="text-amber-500 focus:ring-amber-400"
                        />
                        <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                          Active (Immediate Login)
                        </span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="adminStatus"
                          value="suspended"
                          checked={adminFormStatus === 'suspended'}
                          onChange={() => setAdminFormStatus('suspended')}
                          className="text-amber-500 focus:ring-amber-400"
                        />
                        <span className="font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded text-[11px] border border-rose-200">
                          Suspended (Login Blocked)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 3: Granular Role-Based Permissions Checklist */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>3. Role-Based Access Permissions</span>
                      </h4>
                      <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px]">
                        {selectedPermissionIds.length} of {SYSTEM_PERMISSIONS.length} Granted
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        data-testid="perm-select-all-btn"
                        onClick={handleSelectAllPermissions}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 cursor-pointer transition"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        data-testid="perm-reset-defaults-btn"
                        onClick={handleResetRoleDefaultPermissions}
                        className="px-2 py-1 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-300 cursor-pointer transition"
                        title="Reset to recommended defaults for the selected role"
                      >
                        Role Defaults
                      </button>
                      <button
                        type="button"
                        data-testid="perm-clear-all-btn"
                        onClick={handleDeselectAllPermissions}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 cursor-pointer transition"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Permissions are prefilled based on the <strong>{adminFormRole}</strong> template. Check or uncheck individual privileges to customize access for this administrator.
                  </p>

                  {/* Grouped Category Cards */}
                  <div className="space-y-3">
                    {(
                      [
                        'Procurement & Stock',
                        'Logistics & Manifests',
                        'Settlement & Vouchers',
                        'Financial & Analytics',
                        'System & Security',
                      ] as const
                    ).map((category) => {
                      const permsInCategory = SYSTEM_PERMISSIONS.filter(
                        (p) => p.category === category
                      );
                      const grantedInCategory = permsInCategory.filter((p) =>
                        selectedPermissionIds.includes(p.id)
                      ).length;

                      return (
                        <div
                          key={category}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>{category}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {grantedInCategory} / {permsInCategory.length} active
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {permsInCategory.map((perm) => {
                              const isChecked = selectedPermissionIds.includes(perm.id);
                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start space-x-2.5 p-2 rounded-lg border transition cursor-pointer ${
                                    isChecked
                                      ? 'bg-amber-50/60 border-amber-300 text-slate-900 shadow-xs'
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    data-testid={`perm-checkbox-${perm.id}`}
                                    checked={isChecked}
                                    onChange={() => handleTogglePermission(perm.id)}
                                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-400 cursor-pointer"
                                  />
                                  <div className="space-y-0.5 leading-snug">
                                    <div className={`font-bold text-[11px] ${isChecked ? 'text-slate-900' : 'text-slate-700'}`}>
                                      {perm.label}
                                    </div>
                                    <div className="text-[10px] text-slate-500 line-clamp-2">
                                      {perm.description}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Audit Notice:</span> Creation event will be permanently recorded in the system audit trail.
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddAdminModalOpen(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="submit-new-admin-btn"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-md transition cursor-pointer flex items-center space-x-1.5"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>Register Administrator</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
