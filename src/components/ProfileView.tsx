import React, { useState } from 'react';
import { 
  UserAccount, 
  ServiceCounter, 
  DEFAULT_COUNTERS 
} from '../types';
import { 
  changeUserPassword, 
  saveCurrentUser 
} from '../utils/storage';
import { MTFRB_LOGO } from '../assets/logo';
import { 
  User, 
  Shield, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Monitor, 
  Building2, 
  ArrowLeft, 
  Lock, 
  LogIn, 
  LogOut,
  Clock,
  Sparkles
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: UserAccount | null;
  counters?: ServiceCounter[];
  onBack: () => void;
  onRequireLogin: () => void;
  onLogout?: () => void;
  onUserUpdated?: (updated: UserAccount) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  counters = DEFAULT_COUNTERS,
  onBack,
  onRequireLogin,
  onLogout,
  onUserUpdated,
}) => {
  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto border border-teal-200">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Officer Profile Access</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Please log in with your MTFRB municipal staff credentials to view your profile details and manage your account password.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Return to Previous View
            </button>
            <button
              onClick={onRequireLogin}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Officer Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const assignedStationName = counters.find(c => c.id === currentUser.assignedCounter)?.name || 
    `Counter ${currentUser.assignedCounter || 1}`;

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!newPassword.trim()) {
      setStatusMessage({ type: 'error', text: 'New password cannot be empty.' });
      return;
    }

    if (newPassword.length < 3) {
      setStatusMessage({ type: 'error', text: 'Password must contain at least 3 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changeUserPassword(currentUser.id, currentPassword, newPassword);
      if (result.success) {
        setStatusMessage({ type: 'success', text: 'Your password has been changed successfully and synchronized.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (result.user && onUserUpdated) {
          onUserUpdated(result.user);
        }
      } else {
        setStatusMessage({ type: 'error', text: result.message || 'Failed to update password.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Server connection error.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl text-white p-6 sm:p-8 shadow-lg border border-teal-800/60 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative">
            <img 
              src={MTFRB_LOGO} 
              alt="Official MTFRB Castillejos Seal" 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-amber-400 shadow-md shrink-0" 
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900">
                Staff Profile
              </span>
              <span className="text-xs text-teal-200 font-semibold">
                MTFRB CASTILLEJOS | PORTAL
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
              {currentUser.fullName}
            </h1>
            <p className="text-xs text-teal-100 font-medium flex items-center gap-2 mt-0.5">
              <span>@{currentUser.username}</span>
              <span>•</span>
              <span className="capitalize">{currentUser.designation || (currentUser.role === 'ADMIN' ? 'Municipal Administrator' : 'Counter Officer')}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-teal-800/80 hover:bg-teal-700 text-white text-xs font-bold rounded-xl border border-teal-600/50 shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Workspace</span>
          </button>
          
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2.5 bg-rose-600/80 hover:bg-rose-700 text-white text-xs font-bold rounded-xl border border-rose-500/60 shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Sign out of your session"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: User Account Information Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <User className="w-4 h-4 text-teal-700" />
              <span>Officer Information</span>
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Full Name
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {currentUser.fullName}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  System Username
                </span>
                <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  @{currentUser.username}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Authorization Role
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                    : 'bg-teal-100 text-teal-900 border border-teal-200'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{currentUser.role === 'ADMIN' ? 'System Administrator' : 'Counter Desk Officer'}</span>
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Assigned Desk / Station
                </span>
                <div className="flex items-center gap-2 font-medium text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <Monitor className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="truncate">{assignedStationName}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Account Status
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Active & Verified</span>
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Personnel Identifier
                </span>
                <span className="font-mono text-slate-500 text-[11px]">
                  {currentUser.id}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-700" />
              <span>Municipal Security Policy</span>
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Staff credentials are strictly non-transferable. Please do not share your password with other operators. All ticket calls and approvals are logged under your account.
            </p>
          </div>
        </div>

        {/* Right Column: Change Password Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-teal-700" />
                  <span>Change Account Password</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your personal login password. The change will take effect immediately across all devices.
                </p>
              </div>
              <span className="p-2 bg-teal-50 text-teal-700 rounded-xl border border-teal-200">
                <Lock className="w-4 h-4" />
              </span>
            </div>

            {statusMessage && (
              <div
                className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all animate-in fade-in ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-5">
              {/* Current Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your existing password"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden pr-10 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Required to verify your authorization before saving a new password.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* New Password Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden pr-10 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden pr-10 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password matching feedback */}
              {newPassword && confirmPassword && (
                <div className="text-[11px] font-medium">
                  {newPassword === confirmPassword ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Passwords match</span>
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Passwords do not match</span>
                    </span>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setStatusMessage(null);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Clear Fields
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isSubmitting ? 'Updating...' : 'Save New Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
