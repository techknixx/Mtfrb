import React, { useState, useEffect } from 'react';
import { 
  TicketCheck, 
  Tv, 
  MonitorCheck, 
  BarChart3, 
  Volume2, 
  Lock, 
  Unlock, 
  KeyRound, 
  AlertCircle, 
  X, 
  CheckCircle2,
  Shield,
  ShieldCheck,
  UserCheck,
  LogIn,
  LogOut,
  User,
  Info,
  Menu,
  ArrowRightLeft
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { UserAccount, DEFAULT_COUNTERS, AppView } from '../types';
import { MTFRB_LOGO } from '../assets/logo';

export type { AppView };

interface NavbarProps {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  waitingCount: number;
  isKioskLocked: boolean;
  onUnlockKiosk: () => void;
  onLockKiosk: () => void;
  currentUser?: UserAccount | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentView, 
  onSelectView, 
  waitingCount,
  isKioskLocked,
  onUnlockKiosk,
  onLockKiosk,
  currentUser,
  onOpenLogin,
  onLogout,
}) => {
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const showDisabledToast = (moduleName: string) => {
    setToastMessage(`${moduleName} is disabled while Kiosk mode is selected. Use Staff Unlock to access.`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '1234') {
      onUnlockKiosk();
      setShowUnlockModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Please enter the authorized municipal staff PIN (1234).');
    }
  };

  // Close hamburger menu on Escape key & prevent body scrolling when open in modal state
  useEffect(() => {
    if (isMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMenuOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
      {/* Disabled Notification Banner Toast */}
      {toastMessage && (
        <div className="bg-amber-600 text-white text-xs px-4 py-2 font-medium flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-amber-100 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand Logo & Name with Official Seal */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative group cursor-pointer" onClick={() => onSelectView('kiosk')}>
              <img 
                src={MTFRB_LOGO} 
                alt="MTFRB Castillejos Seal" 
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shadow-xs"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-600/30"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                  MTFRB CASTILLEJOS | PORTAL
                </span>
                <span className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] font-black bg-teal-50 text-teal-800 rounded border border-teal-200 uppercase tracking-wider">
                  Official
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Municipal Tricycle Franchising & Regulatory Board • Castillejos, Zambales
              </p>
            </div>
          </div>

          {/* Module Navigation Tabs (Visible on PC desktop, accessible via Hamburger Menu on mobile & tablets) */}
          <div className="hidden lg:flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto">
              {/* Counter Desk Button */}
              <button
                type="button"
                disabled={currentView === 'kiosk' && isKioskLocked}
                onClick={() => {
                  if (currentView === 'kiosk' && isKioskLocked) {
                    showDisabledToast('Counter Desk');
                  } else {
                    onSelectView('counter');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all ${
                  currentView === 'kiosk' && isKioskLocked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-transparent'
                    : currentView === 'counter'
                    ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80 cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 cursor-pointer'
                }`}
                title="Counter Desk Officer Workspace"
              >
                {currentView === 'kiosk' && isKioskLocked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <MonitorCheck className="w-4 h-4" />
                )}
                <span>Counter Desk</span>
              </button>

              {/* Reports (formerly Data / Queue Log) */}
              <button
                type="button"
                disabled={currentView === 'kiosk' && isKioskLocked}
                onClick={() => {
                  if (currentView === 'kiosk' && isKioskLocked) {
                    showDisabledToast('Reports');
                  } else {
                    onSelectView('analytics');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all ${
                  currentView === 'kiosk' && isKioskLocked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-transparent'
                    : currentView === 'analytics'
                    ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80 cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 cursor-pointer'
                }`}
              >
                {currentView === 'kiosk' && isKioskLocked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                <span>Reports</span>
              </button>

              {/* Admin Button - only visible if logged-in user is ADMIN */}
              {currentUser?.role === 'ADMIN' && (
                <button
                  type="button"
                  disabled={currentView === 'kiosk' && isKioskLocked}
                  onClick={() => {
                    if (currentView === 'kiosk' && isKioskLocked) {
                      showDisabledToast('Admin Panel');
                    } else {
                      onSelectView('admin');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all ${
                    currentView === 'kiosk' && isKioskLocked
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-transparent'
                      : currentView === 'admin'
                      ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/80 cursor-pointer'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 cursor-pointer'
                  }`}
                  title="System Administration & User Management"
                >
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Admin</span>
                </button>
              )}

              {/* Information Option (User Request 6) */}
              <button
                type="button"
                disabled={currentView === 'kiosk' && isKioskLocked}
                onClick={() => {
                  if (currentView === 'kiosk' && isKioskLocked) {
                    showDisabledToast('Information');
                  } else {
                    onSelectView('information');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all ${
                  currentView === 'kiosk' && isKioskLocked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-transparent'
                    : currentView === 'information'
                    ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80 cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 cursor-pointer'
                }`}
                title="Tricycle Franchise Information & Records"
              >
                {currentView === 'kiosk' && isKioskLocked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <Info className="w-4 h-4 text-teal-600" />
                )}
                <span>Information</span>
              </button>
            </nav>

            {/* Lock / Unlock Staff Control */}
            {currentView === 'kiosk' ? (
              isKioskLocked ? (
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer shrink-0"
                  title="Counter Desk, Lobby TV & others are disabled. Click to authenticate as staff."
                >
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Staff Unlock</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLockKiosk}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 border border-teal-300 hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer shrink-0"
                  title="Lock terminal to Kiosk Mode again"
                >
                  <Unlock className="w-3.5 h-3.5 text-teal-700" />
                  <span>Lock Kiosk</span>
                </button>
              )
            ) : null}
          </div>

          {/* Right Section: Desktop controls (PC version) + Hamburger Menu (Mobile & Tablets only) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* PC Desktop Version: Profile, Switch & Logout Buttons (Hidden on mobile & tablets) */}
            <div className="hidden lg:flex items-center gap-2">
              {currentUser ? (
                <>
                  {/* Officer Profile Badge / Button */}
                  <button
                    id="desktop-profile-btn"
                    type="button"
                    onClick={() => onSelectView('profile')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      currentView === 'profile'
                        ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-xs ring-1 ring-teal-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                    title="View Officer Profile & Account Settings"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      currentUser.role === 'ADMIN' ? 'bg-indigo-600 text-white' : 'bg-teal-700 text-white'
                    }`}>
                      {currentUser.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                        {currentUser.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        @{currentUser.username} • {currentUser.role === 'ADMIN' ? 'Admin' : 'Officer'}
                      </div>
                    </div>
                  </button>

                  {/* Switch Station or User */}
                  {onOpenLogin && (
                    <button
                      id="desktop-switch-btn"
                      type="button"
                      onClick={onOpenLogin}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                      title="Switch Station or Active Officer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                      <span>Switch</span>
                    </button>
                  )}

                  {/* Logout Button */}
                  {onLogout && (
                    <button
                      id="desktop-logout-btn"
                      type="button"
                      onClick={onLogout}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                      title="Sign out of current account"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  )}
                </>
              ) : (
                onOpenLogin && (
                  <button
                    id="desktop-login-btn"
                    type="button"
                    onClick={onOpenLogin}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Officer Sign In</span>
                  </button>
                )
              )}
            </div>

            {/* Hamburger Menu Trigger Button (ONLY on Mobile and Tablets: hidden on PC / lg screens) */}
            <button
              id="navbar-hamburger-btn"
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-300/80 bg-white hover:bg-slate-50 hover:border-teal-400 text-slate-800 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Open Navigation and User Menu"
              aria-label="Open Navigation and User Menu"
              aria-expanded={isMenuOpen}
            >
              {currentUser ? (
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 ${
                    currentUser.role === 'ADMIN' ? 'bg-indigo-600 text-white' : 'bg-teal-700 text-white'
                  }`}>
                    {currentUser.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="text-left pr-0.5">
                    <div className="text-xs font-bold text-slate-800 leading-none truncate max-w-[90px]">
                      @{currentUser.username}
                    </div>
                  </div>
                </div>
              ) : null}
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HAMBURGER MENU DRAWER / MODAL (User Profile, Switch, Logout, Navigation) */}
      {/* ========================================================================= */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[99999] flex justify-end animate-in fade-in duration-150 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over Panel: responsive to all screen sizes */}
          <div 
            id="hamburger-menu-panel"
            className="relative w-full sm:w-[400px] md:w-[440px] max-w-full bg-white h-full shadow-2xl z-10 flex flex-col overflow-y-auto border-l border-slate-200 animate-in slide-in-from-right duration-200 overscroll-contain"
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <img 
                  src={MTFRB_LOGO} 
                  alt="MTFRB Seal" 
                  className="w-8 h-8 rounded-full object-cover border-2 border-amber-400 shrink-0"
                />
                <div>
                  <h2 className="font-extrabold text-sm tracking-tight text-white">
                    MTFRB CASTILLEJOS
                  </h2>
                  <p className="text-[10px] text-teal-300 font-mono uppercase tracking-wider">
                    Staff & Portal Console
                  </p>
                </div>
              </div>
              <button
                id="hamburger-close-btn"
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Officer Profile & Account Section */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Active Staff Account
              </div>

              {currentUser ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                      currentUser.role === 'ADMIN' 
                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white' 
                        : 'bg-gradient-to-br from-teal-600 to-teal-800 text-white'
                    }`}>
                      {currentUser.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm text-slate-900 truncate">
                          {currentUser.fullName}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          currentUser.role === 'ADMIN'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-teal-100 text-teal-800 border border-teal-200'
                        }`}>
                          {currentUser.role === 'ADMIN' ? 'Administrator' : 'Officer'}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-bold text-teal-700 mt-0.5">
                        @{currentUser.username}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Station:{' '}
                        <strong className="text-slate-700">
                          {DEFAULT_COUNTERS.find(c => c.id === currentUser.assignedCounter)?.name || 'General Desk'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Primary User Actions: Profile, Switch, Logout */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {/* Profile Button */}
                    <button
                      id="menu-profile-btn"
                      type="button"
                      onClick={() => {
                        onSelectView('profile');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                        currentView === 'profile'
                          ? 'bg-teal-700 text-white border-teal-800 shadow-sm'
                          : 'bg-white hover:bg-teal-50 text-slate-800 hover:text-teal-900 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${currentView === 'profile' ? 'bg-teal-800 text-white' : 'bg-teal-100 text-teal-700'}`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div>Officer Profile</div>
                          <div className={`text-[10px] font-normal ${currentView === 'profile' ? 'text-teal-100' : 'text-slate-500'}`}>
                            Account details & change password
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold opacity-75">Open →</span>
                    </button>

                    {/* Switch Station / Officer Button */}
                    <button
                      id="menu-switch-btn"
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (onOpenLogin) onOpenLogin();
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-900 font-bold text-xs transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                          <ArrowRightLeft className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div>Switch Station / Officer</div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            Change counter desk or switch user
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700">Switch →</span>
                    </button>

                    {/* Logout Button */}
                    {onLogout && (
                      <button
                        id="menu-logout-btn"
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 font-bold text-xs transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                            <LogOut className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <div>Sign Out / Logout</div>
                            <div className="text-[10px] text-rose-500 font-normal">
                              End session & return to login screen
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-rose-600">Logout</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-3 shadow-2xs">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Not Logged In</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Log in to access your designated counter desk and process tickets.
                    </p>
                  </div>
                  <button
                    id="menu-login-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Officer Sign In</span>
                  </button>
                </div>
              )}
            </div>

            {/* Portal Navigation Links (Mobile & Tablet Friendly) */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Portal Modules
              </div>

              <div className="space-y-1.5">
                {/* Counter Desk */}
                <button
                  type="button"
                  disabled={currentView === 'kiosk' && isKioskLocked}
                  onClick={() => {
                    if (currentView === 'kiosk' && isKioskLocked) {
                      showDisabledToast('Counter Desk');
                    } else {
                      onSelectView('counter');
                      setIsMenuOpen(false);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    currentView === 'counter'
                      ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <MonitorCheck className={`w-4 h-4 ${currentView === 'counter' ? 'text-teal-700' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <div>Counter Desk Workspace</div>
                    <div className="text-[10px] text-slate-500 font-normal">Ticket calling, processing & transfers</div>
                  </div>
                </button>

                {/* Reports */}
                <button
                  type="button"
                  disabled={currentView === 'kiosk' && isKioskLocked}
                  onClick={() => {
                    if (currentView === 'kiosk' && isKioskLocked) {
                      showDisabledToast('Reports');
                    } else {
                      onSelectView('analytics');
                      setIsMenuOpen(false);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    currentView === 'analytics'
                      ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className={`w-4 h-4 ${currentView === 'analytics' ? 'text-teal-700' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <div>Reports & Analytics</div>
                    <div className="text-[10px] text-slate-500 font-normal">Queue activity log & throughput</div>
                  </div>
                </button>

                {/* Admin - Only for Admin */}
                {currentUser?.role === 'ADMIN' && (
                  <button
                    type="button"
                    disabled={currentView === 'kiosk' && isKioskLocked}
                    onClick={() => {
                      if (currentView === 'kiosk' && isKioskLocked) {
                        showDisabledToast('Admin Panel');
                      } else {
                        onSelectView('admin');
                        setIsMenuOpen(false);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      currentView === 'admin'
                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Shield className={`w-4 h-4 ${currentView === 'admin' ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <div className="text-left">
                      <div>Admin Panel</div>
                      <div className="text-[10px] text-slate-500 font-normal">Users, terminals & configuration</div>
                    </div>
                  </button>
                )}

                {/* Information */}
                <button
                  type="button"
                  disabled={currentView === 'kiosk' && isKioskLocked}
                  onClick={() => {
                    if (currentView === 'kiosk' && isKioskLocked) {
                      showDisabledToast('Information');
                    } else {
                      onSelectView('information');
                      setIsMenuOpen(false);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    currentView === 'information'
                      ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Info className={`w-4 h-4 ${currentView === 'information' ? 'text-teal-600' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <div>Information & Records</div>
                    <div className="text-[10px] text-slate-500 font-normal">Tricycle registry & requirements</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Terminal Settings */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Audio & System Status
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 py-1">
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span>Chime & Synthesizer</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Always Active
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Close Navigation Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Municipal Staff Authentication
                  </h3>
                  <p className="text-xs text-slate-500">
                    Terminal is locked in Kiosk Mode
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUnlockModal(false);
                  setPinError('');
                  setPinInput('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Protected Terminal Setting</span>
              </div>
              <p>
                Counter Desk, Lobby TV, and Queue Log are disabled on this terminal so the public can only access ticket creation.
              </p>
              <p className="text-slate-500">
                Enter your staff authorization PIN to temporarily unlock all views.
              </p>
            </div>

            <form onSubmit={handleUnlockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff PIN Code
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="Enter 4-digit PIN (Default: 1234)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-mono tracking-widest text-center"
                  autoFocus
                />
                {pinError && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{pinError}</p>
                )}
                <p className="text-[11px] text-slate-400 mt-1 text-center">
                  Default municipal staff PIN: <span className="font-mono font-bold text-slate-600">1234</span>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setPinError('');
                    setPinInput('');
                  }}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Keep Locked
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock with PIN</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

