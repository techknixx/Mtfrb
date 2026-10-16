import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RotateCcw,
  Monitor,
  UserCheck,
  Shield,
  X,
  Plus,
  Download,
  Upload,
  Database,
  HardDrive,
  FileJson,
  RefreshCw,
  Sparkles,
  Megaphone,
  Lock,
  Mail,
  Tv,
  TicketCheck,
  Send,
  Clock,
  ExternalLink,
  FileText,
  Key,
  CreditCard,
  DollarSign,
  Tag
} from 'lucide-react';
import { UserAccount, UserRole, ServiceCounter, FranchiseType, PaymentFeeItem, PAYMENT_FEES_CATALOG } from '../types';
import { 
  loadUsers, 
  addUser, 
  updateUser, 
  deleteUser, 
  saveCounters, 
  resetUsersToDefault,
  resetQueueData,
  wipeAndResetAllTickets,
  createSystemBackup,
  restoreSystemBackup,
  exportQueueRecordsDatabase,
  exportUserDatabase,
  exportCompleteSystemBackup,
  exportFranchiseDatabase,
  loadFranchiseRecords,
  triggerTestBackupEmail,
  loadCounters,
  loadLobbyAdvisory,
  saveLobbyAdvisory,
  loadTerminalPasswords,
  saveTerminalPasswords,
  loadBackupConfig,
  saveBackupConfig,
  loadLocalBackupLogs,
  triggerBackup,
  loadMunicipalFeesCatalog,
  saveMunicipalFeesCatalog,
  addMunicipalFeeItem,
  updateMunicipalFeeItem,
  deleteMunicipalFeeItem,
  resetMunicipalFeesToDefault,
  fetchMunicipalFeesFromServer,
  canAccessPaymentsDatabase,
  TerminalPasswords,
  BackupConfig,
  BackupNotificationLog
} from '../utils/storage';
import { MTFRB_LOGO } from '../assets/logo';

interface AdminViewProps {
  currentUser: UserAccount | null;
  counters: ServiceCounter[];
  onCountersUpdated: (counters: ServiceCounter[]) => void;
  onRequestAdminLogin?: () => void;
  onRequireLogin?: () => void;
  onNavigateToCounter?: (counterId: number) => void;
  onResetQueue?: () => void;
  tickets?: any[];
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  counters,
  onCountersUpdated,
  onRequestAdminLogin,
  onRequireLogin,
  onNavigateToCounter,
  onResetQueue,
  tickets = [],
}) => {
  const handleOpenLogin = onRequestAdminLogin || onRequireLogin;
  const [activeTab, setActiveTab] = useState<'users' | 'backup_restore' | 'payments'>('users');
  const [users, setUsers] = useState<UserAccount[]>(() => loadUsers());
  const [feesCatalog, setFeesCatalog] = useState<PaymentFeeItem[]>(() => loadMunicipalFeesCatalog());
  const [feeSearchQuery, setFeeSearchQuery] = useState<string>('');
  const [feeCategoryFilter, setFeeCategoryFilter] = useState<string>('ALL');
  
  // Modal states for Fee CRUD
  const [showAddFeeModal, setShowAddFeeModal] = useState<boolean>(false);
  const [editingFee, setEditingFee] = useState<PaymentFeeItem | null>(null);
  const [deleteConfirmFeeId, setDeleteConfirmFeeId] = useState<string | null>(null);
  const [resetConfirmFees, setResetConfirmFees] = useState<boolean>(false);
  
  // Fee Form inputs
  const [feeFormName, setFeeFormName] = useState<string>('');
  const [feeFormAmount, setFeeFormAmount] = useState<string>('');
  const [feeFormDescription, setFeeFormDescription] = useState<string>('');
  const [feeFormCategory, setFeeFormCategory] = useState<'regulatory' | 'permit' | 'processing' | 'other'>('regulatory');
  const [feeFormError, setFeeFormError] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resetConfirmUserId, setResetConfirmUserId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetQueueConfirm, setShowResetQueueConfirm] = useState<boolean>(false);
  const [showWipeTicketsConfirm, setShowWipeTicketsConfirm] = useState<boolean>(false);
  const [advisoryInput, setAdvisoryInput] = useState<string>(() => loadLobbyAdvisory());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Terminal Passwords state
  const [terminalPasswords, setTerminalPasswords] = useState<TerminalPasswords>(() => loadTerminalPasswords());
  const [kioskPasswordInput, setKioskPasswordInput] = useState<string>(() => loadTerminalPasswords().kioskPassword);
  const [lobbyTvPasswordInput, setLobbyTvPasswordInput] = useState<string>(() => loadTerminalPasswords().lobbyTvPassword);

  // Google Drive & Backup configuration state
  const [backupConfig, setBackupConfig] = useState<BackupConfig>(() => loadBackupConfig());
  const [newNotificationEmail, setNewNotificationEmail] = useState<string>('');
  const [backupLogs, setBackupLogs] = useState<BackupNotificationLog[]>(() => loadLocalBackupLogs());
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);

  // Form states for Add User
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('OFFICER');
  const [assignedCounter, setAssignedCounter] = useState<number>(1);
  const [designation, setDesignation] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Real-time synchronization across different users, computers, and browsers
  useEffect(() => {
    const handleSync = () => {
      setUsers(loadUsers());
      setTerminalPasswords(loadTerminalPasswords());
      setBackupConfig(loadBackupConfig());
      setBackupLogs(loadLocalBackupLogs());
      setAdvisoryInput(loadLobbyAdvisory());
      setFeesCatalog(loadMunicipalFeesCatalog());
    };

    fetchMunicipalFeesFromServer().then((serverFees) => {
      if (serverFees && serverFees.length > 0) {
        setFeesCatalog(serverFees);
      }
    });

    const handleFeesSync = (e: Event) => {
      const customEvent = e as CustomEvent<PaymentFeeItem[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setFeesCatalog(customEvent.detail);
      } else {
        setFeesCatalog(loadMunicipalFeesCatalog());
      }
    };

    window.addEventListener('mtfrb_users_updated', handleSync);
    window.addEventListener('mtfrb_fees_catalog_updated', handleFeesSync);
    window.addEventListener('franchise_queue_updated', handleSync);
    window.addEventListener('franchise_backup_config_updated', handleSync);
    window.addEventListener('storage', handleSync);

    // Poll to keep directory synchronized even if browser network sleeps
    const interval = setInterval(handleSync, 2500);

    return () => {
      window.removeEventListener('mtfrb_users_updated', handleSync);
      window.removeEventListener('mtfrb_fees_catalog_updated', handleFeesSync);
      window.removeEventListener('franchise_queue_updated', handleSync);
      window.removeEventListener('franchise_backup_config_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Add/Remove Counter state
  const [showAddCounterModal, setShowAddCounterModal] = useState<boolean>(false);
  const [deleteConfirmCounterId, setDeleteConfirmCounterId] = useState<number | null>(null);
  const [newCounterName, setNewCounterName] = useState<string>('');
  const [newCounterId, setNewCounterId] = useState<number>(1);
  const [newCounterOfficer, setNewCounterOfficer] = useState<string>('');
  const [newCounterTypes, setNewCounterTypes] = useState<FranchiseType[]>([
    'NEW',
    'RENEWAL',
    'CHANGE_MOTOR',
    'DROPPING',
  ]);
  const [counterFormError, setCounterFormError] = useState<string>('');

  const handleOpenAddCounter = () => {
    const maxId = counters.reduce((m, c) => Math.max(m, c.id), 0);
    setNewCounterId(maxId + 1);
    setNewCounterName(`Counter ${maxId + 1}`);
    setNewCounterOfficer(users[0]?.fullName || 'Maria Santos');
    setNewCounterTypes(['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING']);
    setCounterFormError('');
    setShowAddCounterModal(true);
  };

  const handleToggleCounterType = (type: FranchiseType) => {
    if (newCounterTypes.includes(type)) {
      if (newCounterTypes.length > 1) {
        setNewCounterTypes(newCounterTypes.filter((t) => t !== type));
      }
    } else {
      setNewCounterTypes([...newCounterTypes, type]);
    }
  };

  const handleCreateCounter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounterName.trim()) {
      setCounterFormError('Counter name is required.');
      return;
    }
    const numId = Number(newCounterId);
    if (!numId || numId <= 0) {
      setCounterFormError('Please provide a valid positive counter number.');
      return;
    }
    if (counters.some((c) => c.id === numId)) {
      setCounterFormError(`A counter with ID ${numId} already exists. Please choose another counter ID.`);
      return;
    }
    const newCounter: ServiceCounter = {
      id: numId,
      name: newCounterName.trim(),
      officerName: newCounterOfficer || users[0]?.fullName || 'Unassigned',
      allowedTypes: newCounterTypes.length > 0 ? newCounterTypes : ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
      status: 'OPEN',
      currentTicketId: null,
    };
    const updated = [...counters, newCounter].sort((a, b) => a.id - b.id);
    saveCounters(updated);
    onCountersUpdated(updated);
    setShowAddCounterModal(false);
    showToast('success', `${newCounter.name} (Counter ${newCounter.id}) added successfully.`);
  };

  const handleDeleteCounter = (counterId: number) => {
    if (counters.length <= 1) {
      showToast('error', 'Cannot remove the last operational counter. At least 1 counter must remain active.');
      setDeleteConfirmCounterId(null);
      return;
    }
    const target = counters.find((c) => c.id === counterId);
    const updated = counters.filter((c) => c.id !== counterId);
    saveCounters(updated);
    onCountersUpdated(updated);
    setDeleteConfirmCounterId(null);
    showToast('success', `${target?.name || `Counter ${counterId}`} has been removed.`);
  };

  const handleReloadDefaultOfficers = () => {
    const canonical = resetUsersToDefault();
    setUsers(canonical);
    showToast('success', 'Official Officers Directory Database reloaded with canonical default records.');
  };

  // Fee Management Handlers
  const handleOpenAddFee = () => {
    setFeeFormName('');
    setFeeFormAmount('');
    setFeeFormDescription('');
    setFeeFormCategory('regulatory');
    setFeeFormError('');
    setShowAddFeeModal(true);
  };

  const handleOpenEditFee = (fee: PaymentFeeItem) => {
    setEditingFee(fee);
    setFeeFormName(fee.name);
    setFeeFormAmount(String(fee.amount));
    setFeeFormDescription(fee.description || '');
    setFeeFormCategory(fee.category || 'other');
    setFeeFormError('');
  };

  const handleSaveAddFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeFormName.trim()) {
      setFeeFormError('Fee item name is required.');
      return;
    }
    const parsedAmount = parseFloat(feeFormAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setFeeFormError('Please enter a valid non-negative amount in PHP.');
      return;
    }

    const newItem = addMunicipalFeeItem({
      name: feeFormName.trim(),
      amount: parsedAmount,
      description: feeFormDescription.trim(),
      category: feeFormCategory,
    });
    setFeesCatalog(loadMunicipalFeesCatalog());
    setShowAddFeeModal(false);
    showToast('success', `Fee item "${newItem.name}" (₱${newItem.amount.toFixed(2)}) added to checklist.`);
  };

  const handleSaveEditFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFee) return;
    if (!feeFormName.trim()) {
      setFeeFormError('Fee item name is required.');
      return;
    }
    const parsedAmount = parseFloat(feeFormAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setFeeFormError('Please enter a valid non-negative amount in PHP.');
      return;
    }

    updateMunicipalFeeItem(editingFee.id, {
      name: feeFormName.trim(),
      amount: parsedAmount,
      description: feeFormDescription.trim(),
      category: feeFormCategory,
    });
    setFeesCatalog(loadMunicipalFeesCatalog());
    setEditingFee(null);
    showToast('success', `Fee item "${feeFormName.trim()}" updated successfully.`);
  };

  const handleDeleteFee = (feeId: string) => {
    const target = feesCatalog.find((f) => f.id === feeId);
    deleteMunicipalFeeItem(feeId);
    setFeesCatalog(loadMunicipalFeesCatalog());
    setDeleteConfirmFeeId(null);
    showToast('success', `Fee item "${target?.name || 'Selected fee'}" removed from checklist.`);
  };

  const handleResetFees = () => {
    const defaults = resetMunicipalFeesToDefault();
    setFeesCatalog(defaults);
    setResetConfirmFees(false);
    showToast('success', 'Municipal Fee Checklist reset to default Castillejos schedule.');
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const refreshUsersList = () => {
    const list = loadUsers();
    setUsers(list);
  };

  const handleExportBackup = () => {
    try {
      const backup = createSystemBackup();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      const filename = `MTFRB_System_Backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('success', `Backup downloaded successfully (${backup.tickets.length} tickets, ${backup.users.length} users).`);
    } catch (err: any) {
      showToast('error', 'Failed to generate backup: ' + (err.message || 'Unknown error'));
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const result = restoreSystemBackup(parsed);
        if (result.success) {
          refreshUsersList();
          onCountersUpdated(loadCounters());
          showToast('success', result.message);
        } else {
          showToast('error', result.message);
        }
      } catch (err: any) {
        showToast('error', 'Invalid JSON backup file: ' + (err.message || 'Parse error'));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteWipeTickets = () => {
    wipeAndResetAllTickets();
    setShowWipeTicketsConfirm(false);
    onCountersUpdated(loadCounters());
    showToast('success', 'All tickets removed and ticket sequence numbering reset to 101.');
  };

  const handleSaveAdvisory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!advisoryInput.trim()) {
      showToast('error', 'Advisory announcement text cannot be empty.');
      return;
    }
    saveLobbyAdvisory(advisoryInput.trim());
    showToast('success', 'Lobby advisory announcement broadcasted and updated live on Lobby TV displays.');
  };

  const handleSaveTerminalPasswords = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKiosk = kioskPasswordInput.trim();
    const cleanTv = lobbyTvPasswordInput.trim();
    if (!cleanKiosk || !cleanTv) {
      showToast('error', 'Kiosk and Lobby TV passwords cannot be empty.');
      return;
    }
    const updated = saveTerminalPasswords({
      kioskPassword: cleanKiosk,
      lobbyTvPassword: cleanTv,
    });
    setTerminalPasswords(updated);
    showToast('success', 'Terminal security passwords updated successfully for Kiosk and Lobby TV.');
  };

  const handleAddNotificationEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newNotificationEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      showToast('error', 'Please enter a valid email address.');
      return;
    }
    if (backupConfig.notificationEmails.includes(email)) {
      showToast('error', 'This email is already in the notification recipient list.');
      return;
    }
    const updatedEmails = [...backupConfig.notificationEmails, email];
    const updated = saveBackupConfig({ notificationEmails: updatedEmails });
    setBackupConfig(updated);
    setNewNotificationEmail('');
    showToast('success', `Added ${email} to backup notification recipients.`);
  };

  const handleRemoveNotificationEmail = (emailToRemove: string) => {
    if (backupConfig.notificationEmails.length <= 1) {
      showToast('error', 'At least one notification recipient email must be retained.');
      return;
    }
    const updatedEmails = backupConfig.notificationEmails.filter((e) => e !== emailToRemove);
    const updated = saveBackupConfig({ notificationEmails: updatedEmails });
    setBackupConfig(updated);
    showToast('success', `Removed ${emailToRemove} from notification recipients.`);
  };

  const handleTriggerManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await triggerBackup('MANUAL');
      if (res.success) {
        setBackupLogs(loadLocalBackupLogs());
        showToast('success', `Backup completed! Notification queued for ${backupConfig.notificationEmails.join(', ')}.`);
      } else {
        showToast('error', 'Backup failed to complete.');
      }
    } catch (err: any) {
      showToast('error', 'Backup error: ' + (err.message || 'Unknown error'));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleTestNotificationEmail = async () => {
    setIsSendingTestEmail(true);
    try {
      const target = backupConfig.targetEmail || backupConfig.notificationEmails[0] || 'waltermart0427@gmail.com';
      const res = await triggerTestBackupEmail(target);
      if (res.success) {
        setBackupLogs(loadLocalBackupLogs());
        showToast('success', res.message || `Test backup notification sent successfully to ${target}!`);
      } else {
        showToast('error', res.message || 'Failed to dispatch test notification email.');
      }
    } catch (err: any) {
      showToast('error', 'Test email error: ' + (err?.message || 'Server error'));
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleExportQueueRecords = () => {
    try {
      const filename = exportQueueRecordsDatabase();
      showToast('success', `Queue Record Database exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'Failed to export Queue Database: ' + (err?.message || 'Error'));
    }
  };

  const handleExportUserDb = () => {
    try {
      const filename = exportUserDatabase();
      showToast('success', `Personnel & User Database exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'Failed to export User Database: ' + (err?.message || 'Error'));
    }
  };

  const handleExportComplete = () => {
    try {
      const filename = exportCompleteSystemBackup();
      showToast('success', `Complete System Database exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'Failed to export Complete System: ' + (err?.message || 'Error'));
    }
  };

  const handleExportFranchiseDb = () => {
    try {
      const filename = exportFranchiseDatabase();
      showToast('success', `Franchise Database exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'Failed to export Franchise Database: ' + (err?.message || 'Error'));
    }
  };

  const handleTriggerAutoDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      // 1. Auto download full system backup to user's PC (User Request 3)
      handleExportBackup();

      // 2. Sync to Google Drive and notification emails
      const res = await triggerBackup('AUTOMATIC_5MIN');
      if (res.success) {
        setBackupLogs(loadLocalBackupLogs());
        showToast('success', `Backup auto-downloaded to your PC and synced to Google Drive (${backupConfig.targetEmail})!`);
      } else {
        showToast('success', `Backup file downloaded to your PC! Cloud backup queued.`);
      }
    } catch (err: any) {
      showToast('error', 'Auto-download error: ' + (err.message || 'Unknown error'));
    } finally {
      setIsBackingUp(false);
    }
  };

  // If user is not logged in or is not an ADMIN, show access gate
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-slate-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Administrator Access Required
          </h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            The Administration & User Management Portal is strictly restricted to MTFRB Municipal Administrators. 
            {currentUser 
              ? ` You are currently logged in as ${currentUser.fullName} (${currentUser.role}).` 
              : ' Please sign in with an authorized Administrator account.'}
          </p>
          <button
            onClick={handleOpenLogin}
            className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-amber-300" />
            <span>Login as Administrator</span>
          </button>
        </div>
      </div>
    );
  }

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !username.trim() || !password.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      setFormError('Username already exists. Please choose a unique username.');
      return;
    }

    try {
      addUser({
        fullName: fullName.trim(),
        username: cleanUsername,
        password: password.trim(),
        role,
        assignedCounter,
        designation: designation.trim() || (role === 'ADMIN' ? 'Administrator' : 'Counter Officer'),
        isActive: true,
      });

      refreshUsersList();
      setShowAddModal(false);
      setFullName('');
      setUsername('');
      setPassword('');
      setDesignation('');
      setFormError('');
      showToast('success', `User "${fullName.trim()}" successfully created!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add user.');
    }
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      updateUser(editingUser.id, {
        fullName: editingUser.fullName.trim(),
        designation: editingUser.designation?.trim(),
        role: editingUser.role,
        assignedCounter: editingUser.assignedCounter,
        isActive: editingUser.isActive,
      });

      refreshUsersList();
      showToast('success', `User "${editingUser.fullName}" updated successfully.`);
      setEditingUser(null);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update user.');
    }
  };

  const handleDeleteUser = (userId: string) => {
    try {
      const targetUser = users.find((u) => u.id === userId);
      const updatedList = deleteUser(userId);
      setUsers(updatedList);
      setDeleteConfirmUserId(null);
      showToast('success', `User account "${targetUser?.fullName || userId}" permanently deleted.`);
    } catch (err: any) {
      showToast('error', err.message || 'Could not delete user.');
      setDeleteConfirmUserId(null);
    }
  };

  const handleResetPassword = (user: UserAccount) => {
    const newPass = '1234';
    updateUser(user.id, { password: newPass });
    refreshUsersList();
    setResetConfirmUserId(null);
    showToast('success', `Password for ${user.fullName} reset to "1234".`);
  };

  const handleAssignOfficerToCounter = (counterId: number, officerName: string) => {
    const updated = counters.map((c) =>
      c.id === counterId ? { ...c, officerName } : c
    );
    saveCounters(updated);
    onCountersUpdated(updated);
    showToast('success', `${officerName} assigned to Counter ${counterId}.`);
  };

  const handleExecuteQueueReset = () => {
    resetQueueData();
    setShowResetQueueConfirm(false);
    showToast('success', 'Demo Queue Database loaded with 50 waiting list applicants and active counters.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold text-white transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl text-white p-6 sm:p-8 shadow-lg border border-teal-800/60 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-teal-800/80 border-2 border-amber-400/80 text-amber-300 flex items-center justify-center shrink-0 shadow-md">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900">
                Admin Console
              </span>
              <span className="text-xs text-teal-200 font-semibold">
                MTFRB CASTILLEJOS | PORTAL
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
              Officer & User Administration
            </h1>
            <p className="text-xs text-teal-100 font-medium">
              Manage authorized municipal personnel, assign counter stations, and oversee portal access.
            </p>
          </div>
        </div>

        {/* Centered and aligned buttons near title (Wipe & Reset Tickets removed) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 relative z-10 w-full md:w-auto">
          {/* Hidden File Input for Backup Restoration */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportBackup}
            accept=".json,application/json"
            className="hidden"
          />

          <button
            type="button"
            onClick={handleExportBackup}
            className="px-3.5 py-2.5 bg-teal-800/80 hover:bg-teal-700 text-white text-xs font-bold rounded-xl border border-teal-600/50 shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Export complete system records backup (JSON)"
          >
            <Download className="w-4 h-4 text-teal-300" />
            <span>Backup Records</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Restore system records from backup file"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Restore</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Admin Module Tabs: Users Tab vs Backup/Restore Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-teal-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-4 h-4 text-teal-700" />
            <span>Users Tab</span>
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
              activeTab === 'users' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup_restore')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'backup_restore'
                ? 'bg-white text-teal-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Database className="w-4 h-4 text-teal-700" />
            <span>Backup/Restore Tab</span>
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Auto Sync
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-white text-teal-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <CreditCard className="w-4 h-4 text-teal-700" />
            <span>Payments Tab</span>
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
              activeTab === 'payments' ? 'bg-amber-400 text-slate-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {feesCatalog.length} Fees
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
          {activeTab === 'users' && <span>Personnel accounts, credentials & station assignments</span>}
          {activeTab === 'backup_restore' && <span>Database snapshots, restore points & automated backup sync</span>}
          {activeTab === 'payments' && <span>Municipal fee checklist schedule, tariffs & assessment rates</span>}
        </div>
      </div>

      {/* USERS TAB CONTENT */}
      {activeTab === 'users' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Grid: Counter Assignments & Quick Status */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-teal-700" />
              <span>Active Counter Desk Staffing</span>
            </h2>
            <p className="text-xs text-slate-500">
              Live officer assignments, custom stations, and operational counters.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              {counters.length} Operational Counters
            </span>
            <button
              type="button"
              onClick={handleOpenAddCounter}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              title="Add a new service counter station"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Counter</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {counters.map((counter) => {
            return (
              <div
                key={counter.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-teal-900 bg-teal-100 px-2 py-0.5 rounded-md">
                    Counter {counter.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      counter.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {counter.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmCounterId(counter.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      title={`Remove Counter ${counter.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-800 line-clamp-1">
                    {counter.name}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                    <UserCheck className="w-3 h-3 text-teal-600" />
                    <span>Officer on Duty:</span>
                  </div>
                </div>

                {/* Dropdown to change assigned officer */}
                <select
                  value={counter.officerName}
                  onChange={(e) => handleAssignOfficerToCounter(counter.id, e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.fullName}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => onNavigateToCounter?.(counter.id)}
                  className="w-full text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 rounded-lg py-1.5 transition-colors cursor-pointer"
                >
                  Open Counter Workspace →
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Directory Table & Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-700" />
              <span>Municipal Staff & Officer Directory</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorized personnel who can sign in to counters and operate the queuing system.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Total Accounts: <strong className="text-slate-900">{users.length}</strong>
            </span>
            <button
              type="button"
              onClick={handleReloadDefaultOfficers}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-300"
              title="Reload canonical default officers directory database"
            >
              <RotateCcw className="w-3 h-3 text-slate-600" />
              <span>Default Directory</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Officer Name & Designation</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Default Station</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {users.map((user) => {
                const isAdmin = user.role === 'ADMIN';
                const isCurrent = currentUser?.id === user.id;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{user.fullName}</span>
                            {isCurrent && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {user.designation || (isAdmin ? 'Municipal Administrator' : 'Desk Officer')}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                      @{user.username}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isAdmin 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : 'bg-teal-50 text-teal-700 border-teal-200'
                      }`}>
                        {isAdmin ? <ShieldCheck className="w-3 h-3 text-indigo-600" /> : <UserCheck className="w-3 h-3 text-teal-600" />}
                        <span>{user.role}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-800">
                          {user.assignedCounter ? `Counter ${user.assignedCounter}` : 'Any Counter'}
                        </span>
                        {canAccessPaymentsDatabase(user) && (
                          <span 
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit"
                            title="Authorized to access Payments & Collection Database in Information Page"
                          >
                            <CreditCard className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Payments Access</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        user.isActive 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit User Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setResetConfirmUserId(user.id)}
                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Reset Password to 1234"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          disabled={isCurrent}
                          onClick={() => setDeleteConfirmUserId(user.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isCurrent
                              ? 'opacity-30 cursor-not-allowed text-slate-300'
                              : 'text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer'
                          }`}
                          title={isCurrent ? 'Cannot delete your own active session' : 'Delete User'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {/* BACKUP/RESTORE TAB CONTENT */}
  {activeTab === 'backup_restore' && (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* System Database & Data Maintenance Administration */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl border border-teal-100">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                System Database & Data Maintenance
              </h2>
              <p className="text-xs text-slate-500">
                Archive municipal records, create offline backups, or reset daily ticket sequences.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
            Storage Engine: Browser Local & Server Sync
          </span>
        </div>

        {/* Lobby Advisory Announcement Controller (User Request 9) */}
        <div className="mb-6 p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 text-white rounded-2xl border border-slate-800 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40">
                <Megaphone className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Lobby Advisory & Marquee Announcement</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-950 text-teal-300 border border-teal-500/50 uppercase">
                    Live Broadcast
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Update the continuous ticker text looping at the bottom of the Lobby TV screen in real-time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAdvisoryInput('MTFRB PUBLIC ADVISORY: Please prepare original and photocopies of Official Receipt (OR), Certificate of Registration (CR), Barangay Clearance, and valid Government ID. Priority Lane is available at Counter 1 for Senior Citizens, PWDs, and Pregnant Applicants.')}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Reset to default standard announcement"
              >
                Default
              </button>
              <button
                type="button"
                onClick={() => setAdvisoryInput('NOTICE: Document Evaluation cut-off is 4:30 PM. For inquiries or complaints regarding tricycle franchise operations, please coordinate directly with the MTFRB Desk.')}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Use cut-off notice preset"
              >
                Cut-off Notice
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveAdvisory} className="pt-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Announcement Message (Continuous Scrolling Marquee Text):
              </label>
              <textarea
                rows={3}
                value={advisoryInput}
                onChange={(e) => setAdvisoryInput(e.target.value)}
                placeholder="Enter announcement text to display on Lobby TV..."
                className="w-full p-3 text-xs sm:text-sm bg-slate-950 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/40 outline-hidden font-medium resize-y"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Live Preview: <span className="text-teal-300 font-mono italic truncate inline-block max-w-md align-bottom">"{advisoryInput}"</span>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>Save & Broadcast Announcement</span>
              </button>
            </div>
          </form>
        </div>

        {/* Terminal Passwords Management (User Request 1) */}
        <div className="mb-6 p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Kiosk & Lobby TV Password Management</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-500/50 uppercase">
                    Terminal Security
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Configure access passwords required to unlock and launch Citizen Self-Service Kiosk and Lobby TV displays.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveTerminalPasswords}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Terminal Passwords</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <TicketCheck className="w-4 h-4 text-teal-400" />
                  <span>Citizen Kiosk Terminal Password</span>
                </label>
                <span className="text-[10px] font-mono text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                  Current: {terminalPasswords.kioskPassword}
                </span>
              </div>
              <input
                type="text"
                value={kioskPasswordInput}
                onChange={(e) => setKioskPasswordInput(e.target.value)}
                placeholder="Enter Kiosk password"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-hidden"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Authorized staff enters this password when switching into Citizen Kiosk mode.
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Tv className="w-4 h-4 text-amber-400" />
                  <span>Lobby TV Display Password</span>
                </label>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                  Current: {terminalPasswords.lobbyTvPassword}
                </span>
              </div>
              <input
                type="text"
                value={lobbyTvPasswordInput}
                onChange={(e) => setLobbyTvPasswordInput(e.target.value)}
                placeholder="Enter Lobby TV password"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-hidden"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Authorized staff enters this password when switching into Lobby TV mode.
              </p>
            </div>
          </div>
        </div>

        {/* Google Drive Auto-Backup & Email Notifications Hub (User Requests 11, 12, 13) */}
        <div className="mb-6 p-5 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-950 text-white rounded-2xl border border-teal-800/60 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Google Drive Auto-Backup & Email Notifications</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-500/50 uppercase">
                    Every 5 Mins Active
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Automated background snapshot cycles with multi-email dispatch notifications to municipal administrators.
                </p>
              </div>
            </div>

            <div className="flex flex-row items-center gap-2 shrink-0 flex-nowrap overflow-x-auto">
              <button
                type="button"
                onClick={handleTriggerAutoDownloadBackup}
                disabled={isBackingUp}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                title="Auto-download complete backup file to your PC and sync to Google Drive"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>{isBackingUp ? 'Processing...' : 'Auto-Download to PC & Drive'}</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerManualBackup}
                disabled={isBackingUp}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isBackingUp ? 'Backing Up...' : 'Google Drive Backup & Notify'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Target Drive & Frequency Details */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="text-slate-400">Google Drive Account:</span>
                <span className="font-mono font-bold text-teal-300">{backupConfig.targetEmail}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="text-slate-400">PC Auto-Download:</span>
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Auto-Save to PC & Google Drive
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="text-slate-400">Auto-Backup Frequency:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Every 5 Minutes (Active)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Database Rollback Protection:</span>
                <span className="font-bold text-teal-300">Persistent Non-Rollback Sync</span>
              </div>
            </div>

            {/* Notification Emails List & Add Form */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-teal-400" />
                  <span>Notification Email Recipients ({backupConfig.notificationEmails.length})</span>
                </label>
              </div>

              {/* Email Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {backupConfig.notificationEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-teal-950 text-teal-200 border border-teal-800"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveNotificationEmail(email)}
                      className="p-0.5 hover:text-rose-400 transition-colors cursor-pointer"
                      title={`Remove ${email}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Email Form */}
              <form onSubmit={handleAddNotificationEmail} className="flex gap-2 pt-1">
                <input
                  type="email"
                  value={newNotificationEmail}
                  onChange={(e) => setNewNotificationEmail(e.target.value)}
                  placeholder="Add email for backup alerts..."
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-400 outline-hidden"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Recipient</span>
                </button>
              </form>
            </div>
          </div>

          {/* Backup Logs Preview */}
          {backupLogs.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Recent Backup Notifications & Cloud Dispatches
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {backupLogs.slice(0, 3).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                      <span className="font-mono text-slate-300 text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-slate-400 truncate">
                        Recipients: {log.recipients.join(', ')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-teal-400 shrink-0 pl-2">
                      {log.fileSizeKb} KB • {log.totalTickets} tickets
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2 Operations Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: System Records Backup & Restore */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Backup Records & Archives
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
                  JSON Snapshot
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generate an immediate full backup of all current queue tickets, assigned counter stations, ticket sequence counters, and municipal staff accounts. Keep offline files for audit compliance.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500 font-medium">
                <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200">
                  {tickets.length} Active Tickets
                </span>
                <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200">
                  {users.length} Personnel Accounts
                </span>
                <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200">
                  8 Service Counters
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 py-2.5 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export System Backup</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Restore File</span>
              </button>
            </div>
          </div>

          {/* Card 2: Queue Sequence & Seed Reset */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Queue Numbers & Sequence Control
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
                  Seed State
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Load the complete 50-applicant demo waiting list across all franchise transaction categories with active counter assignments and baseline sequence numbers.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Populates 50 waiting list tickets + 4 active frontline counters.</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetQueueConfirm(true)}
                className="flex-1 py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Reset to 50 waiting list demo queue"
              >
                <RefreshCw className="w-4 h-4 text-teal-300" />
                <span>Reset Demo Queue Sequence</span>
              </button>
            </div>
          </div>
        </div>

        {/* Connected Database Hub: Primary Key Body Number & Modular DB Exports (User Requests 3 & 5) */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-teal-700" />
                <span>Connected Databases & Individual Backups</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
                  Auto-Download Enabled
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Direct export and automated backup of each municipal database. All backups auto-download to PC and sync with Google Drive.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Database 1: Franchise Registry (Body Number PK) */}
            <div className="p-4 bg-slate-50 rounded-xl border border-teal-200/80 hover:border-teal-400 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-teal-600" />
                    Franchise Registry
                  </span>
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded border border-amber-300">
                    PK: Body #
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">
                  Connected franchise database linked by unique Body Number. Holds operators, drivers, routes, and permits.
                </p>
                <div className="text-[10px] text-teal-700 font-semibold mb-3">
                  {loadFranchiseRecords().length} Records Registered
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportFranchiseDb}
                className="w-full py-2 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Auto-Download to PC</span>
              </button>
            </div>

            {/* Database 2: Queue Tickets Database */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    Queue Tickets DB
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded">
                    Tickets
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">
                  Daily queue numbers, timestamps, transaction types, counter desk assignments, and service durations.
                </p>
                <div className="text-[10px] text-slate-600 font-semibold mb-3">
                  {tickets.length} Queue Tickets
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportQueueRecords}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Auto-Download to PC</span>
              </button>
            </div>

            {/* Database 3: Personnel & Users DB */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-600" />
                    Personnel Accounts DB
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded">
                    Staff & Auth
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">
                  Municipal officers, administrators, station assignments, active sessions, and credential configurations.
                </p>
                <div className="text-[10px] text-slate-600 font-semibold mb-3">
                  {users.length} Authorized Accounts
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportUserDb}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Auto-Download to PC</span>
              </button>
            </div>

            {/* Database 4: Full System Backup (PC + Google Drive) */}
            <div className="p-4 bg-gradient-to-br from-teal-900 to-slate-900 rounded-xl text-white flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                    Complete Backup
                  </span>
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40">
                    PC + Drive
                  </span>
                </div>
                <p className="text-[11px] text-teal-100 mb-2">
                  Complete snapshot bundling all databases, kiosk settings, advisories, and logs into one verified archive.
                </p>
                <div className="text-[10px] text-teal-300 font-mono mb-3">
                  Auto-syncs to Google Drive
                </div>
              </div>
              <button
                type="button"
                onClick={handleTriggerAutoDownloadBackup}
                disabled={isBackingUp}
                className="w-full py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-black rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isBackingUp ? 'Processing...' : 'Auto-Download Now'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* PAYMENTS TAB: MUNICIPAL FEE CHECKLIST MANAGEMENT */}
      {activeTab === 'payments' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Access Policy Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-sm">
                    Access Control: Payments & Collection Database
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Restricted Access
                  </span>
                </div>
                <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                  The <strong>Payments & Collection Database</strong> in the Information Page is strictly accessible only to <strong>Administrator</strong> and <strong>Payments (Counter 4 / Cashier)</strong> accounts. It is completely hidden and blocked for all other users.
                </p>
              </div>
            </div>
          </div>

          {/* Header Card with Add Item and Reset actions */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
                    <CreditCard className="w-4 h-4" />
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    Municipal Fee Checklist & Schedule of Rates
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Configure the official municipal fees and tariffs that appear on the Cashier & Payments Station checklist. Any item added, updated, or removed here immediately updates the cashier counter and official receipt breakdown.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setResetConfirmFees(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Reset to official standard Castillejos municipal fees schedule"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Default Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddFee}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Fee Item</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={feeSearchQuery}
                  onChange={(e) => setFeeSearchQuery(e.target.value)}
                  placeholder="Search fee by name or description..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
                <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                {feeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFeeSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">
                  Category:
                </span>
                {(['ALL', 'regulatory', 'permit', 'processing', 'other'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFeeCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                      feeCategoryFilter === cat
                        ? 'bg-teal-800 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Items' : cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fees Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Configured Checklist Items ({feesCatalog.length})
                </h3>
              </div>
              <div className="text-xs font-mono text-slate-500">
                Total Baseline Tariff:{' '}
                <span className="font-bold text-slate-900">
                  ₱{feesCatalog.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/70 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Fee Description & Purpose</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Standard Amount (PHP)</th>
                    <th className="py-3 px-4 text-center">Status on Station</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feesCatalog
                    .filter((fee) => {
                      if (feeCategoryFilter !== 'ALL' && fee.category !== feeCategoryFilter) {
                        return false;
                      }
                      if (feeSearchQuery.trim()) {
                        const q = feeSearchQuery.toLowerCase();
                        return (
                          fee.name.toLowerCase().includes(q) ||
                          (fee.description && fee.description.toLowerCase().includes(q))
                        );
                      }
                      return true;
                    })
                    .map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{fee.name}</div>
                          {fee.description ? (
                            <div className="text-xs text-slate-500 mt-0.5">{fee.description}</div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">No additional note provided</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              fee.category === 'permit'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : fee.category === 'regulatory'
                                ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                : fee.category === 'processing'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {fee.category || 'other'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-slate-900">
                          ₱{fee.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active (Unchecked by default)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditFee(fee)}
                              className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit fee name, amount, or category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmFeeId(fee.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete fee from checklist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {feesCatalog.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No fee items currently configured. Click "Reset Default Schedule" or "Add Fee Item" to populate the checklist.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Explanatory Info Card */}
          <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200/80 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="text-xs text-teal-950">
              <span className="font-bold">Payment Station Checklist Behavior:</span> At the Cashier Station desk, all items on this Municipal Fee Checklist start completely <span className="font-bold underline">unchecked by default</span>. The cashier assesses the applicant's requirements, checks only the applicable fees, and prints the municipal receipt.
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400 text-slate-900 rounded-xl font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Add Municipal Staff Account</h3>
                  <p className="text-xs text-teal-200">Register a new officer or administrator</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormError('');
                }}
                className="text-slate-300 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Clara Santos"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. msantos"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Password / PIN *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (e.g. 123)"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    System Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-bold"
                  >
                    <option value="OFFICER">OFFICER (Counter Desk Access)</option>
                    <option value="ADMIN">ADMIN (Full System Administration)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Default Counter Station
                  </label>
                  <select
                    value={assignedCounter}
                    onChange={(e) => setAssignedCounter(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-medium"
                  >
                    {counters.map((c) => (
                      <option key={c.id} value={c.id}>
                        Counter {c.id} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Designation / Title
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Franchise Evaluation Officer"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create User Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-bold">Edit Account: {editingUser.fullName}</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Designation
                </label>
                <input
                  type="text"
                  value={editingUser.designation || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, designation: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    System Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-hidden font-bold"
                  >
                    <option value="OFFICER">OFFICER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Default Counter
                  </label>
                  <select
                    value={editingUser.assignedCounter || 1}
                    onChange={(e) => setEditingUser({ ...editingUser, assignedCounter: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-hidden font-medium"
                  >
                    {counters.map((c) => (
                      <option key={c.id} value={c.id}>
                        Counter {c.id} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingUser.isActive}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Account Active</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM: Reset Password */}
      {resetConfirmUserId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Reset User Password?</h3>
            <p className="text-xs text-slate-600">
              The password will be reset to default <strong className="font-mono text-slate-900">1234</strong>.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setResetConfirmUserId(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const target = users.find((u) => u.id === resetConfirmUserId);
                  if (target) handleResetPassword(target);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM: Delete User */}
      {deleteConfirmUserId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Delete User Account?</h3>
            <p className="text-xs text-slate-600">
              This action is permanent. The user will no longer be able to log in to the portal.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmUserId(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUserId)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM: Reset Queue */}
      {showResetQueueConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Load 50-Applicant Demo Queue?</h3>
            <p className="text-xs text-slate-600">
              This will populate the system with 50 waiting list applicants across all franchise transaction categories (New, Renewal, Change Motor, Dropping) and active service counter tickets.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowResetQueueConfirm(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteQueueReset}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs cursor-pointer"
              >
                Load 50 Demo Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Counter */}
      {showAddCounterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400 text-slate-900 rounded-xl font-bold">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Add Service Counter</h3>
                  <p className="text-xs text-teal-200">Deploy a new operational desk station</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddCounterModal(false);
                  setCounterFormError('');
                }}
                className="text-slate-300 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCounter} className="p-6 space-y-4">
              {counterFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{counterFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Counter ID Number *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCounterId}
                    onChange={(e) => setNewCounterId(parseInt(e.target.value) || 1)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Counter Name *
                  </label>
                  <input
                    type="text"
                    value={newCounterName}
                    onChange={(e) => setNewCounterName(e.target.value)}
                    placeholder="e.g. Assessment, Express Desk"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Officer on Duty
                </label>
                <select
                  value={newCounterOfficer}
                  onChange={(e) => setNewCounterOfficer(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.fullName}>
                      {u.fullName} ({u.designation || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Allowed Franchise Transaction Types
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'] as FranchiseType[]).map((type) => {
                    const checked = newCounterTypes.includes(type);
                    return (
                      <button
                        type="button"
                        key={type}
                        onClick={() => handleToggleCounterType(type)}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                          checked
                            ? 'bg-teal-50 text-teal-900 border-teal-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{type.replace('_', ' ')}</span>
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCounterModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Counter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM: Remove Counter */}
      {deleteConfirmCounterId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Remove Counter {deleteConfirmCounterId}?
            </h3>
            <p className="text-xs text-slate-600">
              This will decommission and remove Counter {deleteConfirmCounterId} ({counters.find(c => c.id === deleteConfirmCounterId)?.name}) from the operational desk stations.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmCounterId(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCounter(deleteConfirmCounterId)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                Remove Counter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Fee Item */}
      {showAddFeeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400 text-slate-900 rounded-xl font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Add Municipal Fee Item</h3>
                  <p className="text-xs text-teal-200">Include new item on the payment station checklist</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFeeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddFee} className="p-6 space-y-4">
              {feeFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feeFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fee Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={feeFormName}
                  onChange={(e) => setFeeFormName(e.target.value)}
                  placeholder="e.g. Environmental Clearance Fee"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Standard Amount (PHP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeFormAmount}
                    onChange={(e) => setFeeFormAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-7 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={feeFormCategory}
                  onChange={(e) => setFeeFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="regulatory">Regulatory (Franchise, Registrations)</option>
                  <option value="permit">Permit (Mayor's, Business)</option>
                  <option value="processing">Processing (Secretaries, Application)</option>
                  <option value="other">Other Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Ordinance Reference (Optional)
                </label>
                <textarea
                  value={feeFormDescription}
                  onChange={(e) => setFeeFormDescription(e.target.value)}
                  placeholder="Brief note or statutory basis..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFeeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save to Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Fee Item */}
      {editingFee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400 text-slate-900 rounded-xl font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Edit Municipal Fee Item</h3>
                  <p className="text-xs text-teal-200">Modify fee naming, tariff rate or category</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingFee(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditFee} className="p-6 space-y-4">
              {feeFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feeFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fee Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={feeFormName}
                  onChange={(e) => setFeeFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Standard Amount (PHP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeFormAmount}
                    onChange={(e) => setFeeFormAmount(e.target.value)}
                    required
                    className="w-full pl-7 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={feeFormCategory}
                  onChange={(e) => setFeeFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="regulatory">Regulatory (Franchise, Registrations)</option>
                  <option value="permit">Permit (Mayor's, Business)</option>
                  <option value="processing">Processing (Secretaries, Application)</option>
                  <option value="other">Other Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Ordinance Reference (Optional)
                </label>
                <textarea
                  value={feeFormDescription}
                  onChange={(e) => setFeeFormDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-800 hover:bg-teal-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Update Fee Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM: Delete Fee Item */}
      {deleteConfirmFeeId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Delete Fee Item?
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove <span className="font-bold text-slate-900">"{feesCatalog.find((f) => f.id === deleteConfirmFeeId)?.name}"</span> from the Municipal Fee Checklist? It will no longer appear on Cashier Station desks.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmFeeId(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFee(deleteConfirmFeeId)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                Delete Fee Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM: Reset Fees to Default */}
      {resetConfirmFees && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Reset Municipal Fees Schedule?
            </h3>
            <p className="text-xs text-slate-600">
              This will restore the standard Castillejos schedule (Franchise Fee 100/1500, Secretaries 100, Mayor's Permit 500, Business Permit 150, Annual Registration 100, etc.).
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmFees(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetFees}
                className="px-4 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs cursor-pointer"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
