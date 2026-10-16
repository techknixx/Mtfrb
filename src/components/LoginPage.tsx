import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  LogIn, 
  KeyRound,
  User, 
  AlertCircle, 
  Monitor, 
  CheckCircle2, 
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  TicketCheck,
  ChevronLeft,
  FileCheck,
  X,
  Lock,
  Check
} from 'lucide-react';
import { UserAccount, ServiceCounter, FranchiseType, getDocumentsForType, getFranchiseTypeLabel } from '../types';
import { authenticateUser, setCurrentUser, loadUsers } from '../utils/storage';
import { MTFRB_LOGO } from '../assets/logo';

interface LoginPageProps {
  currentUser?: UserAccount | null;
  counters?: ServiceCounter[];
  onLoginSuccess: (user: UserAccount, targetCounterId?: number) => void;
  onCancel?: () => void;
  targetRoleRequirement?: 'ADMIN' | 'ANY';
  initialCounterId?: number;
  onNavigateToView?: (view: 'kiosk' | 'display' | 'mobile_tracker' | 'counter') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  counters = [],
  onLoginSuccess,
  onCancel,
  targetRoleRequirement = 'ANY',
  initialCounterId,
  onNavigateToView,
}) => {
  const [users] = useState<UserAccount[]>(() => loadUsers());
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [selectedCounterId, setSelectedCounterId] = useState<number>(
    initialCounterId || currentUser?.assignedCounter || 1
  );
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Modal for viewing requirements checklist
  const [showChecklistModal, setShowChecklistModal] = useState<boolean>(false);
  const [selectedReqType, setSelectedReqType] = useState<FranchiseType>('NEW');

  // Hidden keyboard shortcuts for authorized staff:
  // Ctrl + F11 opens Lobby TV immediately without password
  // Ctrl + F12 opens Kiosk immediately without password
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'F11' || e.code === 'F11')) {
        e.preventDefault();
        e.stopPropagation();
        if (onNavigateToView) {
          onNavigateToView('display');
        }
      } else if (e.ctrlKey && (e.key === 'F12' || e.code === 'F12')) {
        e.preventDefault();
        e.stopPropagation();
        if (onNavigateToView) {
          onNavigateToView('kiosk');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigateToView]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-PH', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine if the entered account is an Admin
  const matchingUser = users.find(
    (u) => u.username.toLowerCase() === usernameInput.trim().toLowerCase()
  );
  const isAdminAccount = matchingUser 
    ? matchingUser.role === 'ADMIN' 
    : targetRoleRequirement === 'ADMIN';

  // Automatically sync counter to officer's assigned station when non-admin matches
  useEffect(() => {
    if (matchingUser && matchingUser.role !== 'ADMIN' && matchingUser.assignedCounter) {
      setSelectedCounterId(matchingUser.assignedCounter);
    }
  }, [matchingUser]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const targetUser = usernameInput.trim();
    if (!targetUser) {
      setErrorMsg('Please enter your authorized username.');
      return;
    }

    if (!passwordInput) {
      setErrorMsg('Please enter your password / security PIN.');
      return;
    }

    const authResult = authenticateUser(targetUser, passwordInput);
    if (!authResult) {
      setErrorMsg('Authentication failed: Invalid username or password.');
      return;
    }

    if (targetRoleRequirement === 'ADMIN' && authResult.role !== 'ADMIN') {
      setErrorMsg('Access Restricted: This station requires an Administrator account.');
      return;
    }

    // Set logged user in storage
    setCurrentUser(authResult);
    setSuccessMsg(`Access Granted: Welcome, ${authResult.fullName}!`);

    // Non-admin accounts are strictly locked to their assigned counter
    const finalCounterId = authResult.role === 'ADMIN'
      ? selectedCounterId
      : (authResult.assignedCounter || 1);

    setTimeout(() => {
      onLoginSuccess(authResult, finalCounterId);
    }, 400);
  };

  const counterStations = counters.length >= 8 ? counters : [
    { id: 1, name: 'Assessment' },
    { id: 2, name: 'Verification' },
    { id: 3, name: 'Inspection' },
    { id: 4, name: 'Payment' },
    { id: 5, name: 'Scanning' },
    { id: 6, name: 'Encoding' },
    { id: 7, name: 'Affixing' },
    { id: 8, name: 'Releasing' }
  ];

  const activeRequirements = getDocumentsForType(selectedReqType);

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-slate-100 flex flex-col justify-between overflow-hidden font-sans selection:bg-teal-500 selection:text-white">
      {/* Background Watermark Seal */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center overflow-hidden z-0">
        <img 
          src={MTFRB_LOGO} 
          alt="MTFRB Official Seal Watermark" 
          className="w-[600px] h-[600px] object-contain select-none" 
        />
      </div>

      {/* Compact Top Header Bar */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <img 
            src={MTFRB_LOGO} 
            alt="MTFRB Castillejos Seal" 
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-amber-400 shadow-sm shrink-0" 
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white tracking-wider">
                MTFRB CASTILLEJOS | PORTAL
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-black uppercase bg-teal-900 text-teal-300 rounded border border-teal-700/60">
                Staff Terminal
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden md:block leading-tight">
              Municipal Tricycle Franchising & Regulatory Board • Castillejos, Zambales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          <div className="hidden md:flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-400 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-teal-400" />
            <span>{currentTime || 'PST Online'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] sm:text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ONLINE</span>
          </div>
        </div>
      </header>

      {/* Main Center Area: Fits cleanly on any viewport height without scrolling */}
      <main className="relative z-10 flex-1 min-h-0 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
        <div className="w-full max-w-xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-7 space-y-4 max-h-full">
          {/* Header Strip */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-500/10 border border-teal-500/30 rounded-xl text-teal-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Personnel Authentication
                </h2>
                <p className="text-xs text-teal-400 font-medium">
                  {targetRoleRequirement === 'ADMIN'
                    ? 'Administrator Security Access'
                    : 'Desk Officer & Operations Station'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30 uppercase tracking-wider">
              Authorized Only
            </span>
          </div>

          {currentUser && onCancel && (
            <div className="p-2.5 bg-teal-950/60 border border-teal-700/60 rounded-xl flex items-center justify-between text-xs text-teal-200">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                <span>Active: <strong>{currentUser.fullName}</strong></span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="text-[11px] font-bold text-teal-300 hover:text-white underline cursor-pointer flex items-center gap-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Return</span>
              </button>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleLogin} autoComplete="off" data-lpignore="true" className="space-y-3.5">
            {/* Decoy inputs to prevent browser autofill popups */}
            <input type="text" name="prevent_autofill_user" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="off" />
            <input type="password" name="prevent_autofill_pwd" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="new-password" />

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/70 border border-rose-700/80 rounded-xl flex items-center gap-2 text-xs text-rose-300 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-950/70 border border-emerald-700/80 rounded-xl flex items-center gap-2 text-xs text-emerald-300 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 2-Column Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Username / Personnel ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="mtfrb_user_input"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-lpignore="true"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="e.g. officer1"
                    className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-medium transition-all"
                    required
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Password / Security PIN
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="mtfrb_credential_input"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-lpignore="true"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Enter password"
                    className="w-full pl-8 pr-8 py-2 text-xs sm:text-sm bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-mono transition-all"
                    required
                  />
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Counter Selection: Hidden and Disabled if Account is Not Admin */}
            <div>
              {isAdminAccount ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-teal-400" />
                      <span>Select Duty Station (Administrator Override):</span>
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      Admin Unlocked
                    </span>
                  </label>
                  <select
                    value={selectedCounterId}
                    onChange={(e) => setSelectedCounterId(Number(e.target.value))}
                    className="w-full py-2 px-3 text-xs sm:text-sm bg-slate-950/90 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden cursor-pointer"
                  >
                    {counterStations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Lock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="text-xs">
                      Duty Station: <strong>{matchingUser ? (counterStations.find(c => c.id === matchingUser.assignedCounter)?.name || 'Designated Station') : 'Designated Station'}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-medium">
                    Locked to Assigned Desk
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons: Sign In + Official Requirements Checklist Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowChecklistModal(true)}
                className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Official Requirements Checklist</span>
              </button>

              <button
                type="submit"
                className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Official Requirements Checklist Modal (User Request 11) */}
      {showChecklistModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-400/10 text-amber-400 rounded-lg border border-amber-400/30">
                  <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Official MTFRB Requirements Checklist
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Mandatory evaluation criteria for tricycle franchise processing
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChecklistModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Franchise Type Filter Tabs */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-4 gap-1.5 shrink-0">
              {(
                [
                  { type: 'NEW', label: 'New Franchise' },
                  { type: 'RENEWAL', label: 'Renewal' },
                  { type: 'CHANGE_MOTOR', label: 'Change Motor' },
                  { type: 'DROPPING', label: 'Dropping' },
                ] as const
              ).map((item) => {
                const isTabActive = selectedReqType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedReqType(item.type)}
                    className={`py-1.5 px-2 rounded-xl text-center transition-all cursor-pointer ${
                      isTabActive
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white font-medium'
                    }`}
                  >
                    <div className="text-[10px] sm:text-xs font-bold truncate">
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Checklist Items Container */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {activeRequirements.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="p-3 bg-slate-950/70 border border-slate-800/90 rounded-xl flex items-start gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span>{doc.name}</span>
                      {doc.mandatory ? (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-400">Optional</span>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {doc.description}
                      </p>
                    )}
                  </div>
                  <div className="p-1 text-emerald-400 bg-emerald-950/50 rounded border border-emerald-800/40 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                Total: <strong className="text-amber-400">{activeRequirements.length} required documents</strong> for {getFranchiseTypeLabel(selectedReqType)}
              </span>
              <button
                type="button"
                onClick={() => setShowChecklistModal(false)}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer: Strictly visible on all screen sizes */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-slate-400 shrink-0">
        <div>
          <span className="text-[10px] sm:text-[11px]">Municipality of Castillejos • Province of Zambales</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-medium">MTFRB Tricycle Franchising & Regulatory Board</span>
        </div>
      </footer>
    </div>
  );
};
