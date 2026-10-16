import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Ticket, ServiceCounter, getDocumentsForType, getFranchiseTypeLabel } from '../types';
import { calculateWaitEstimates } from '../utils/storage';
import { soundManager } from '../utils/audio';
import { MTFRB_LOGO } from '../assets/logo';
import { 
  Clock, 
  CheckCircle2, 
  User, 
  Volume2, 
  Sparkles,
  Search,
  QrCode,
  Bell,
  Building2,
  Hash,
  ArrowRightCircle,
  ArrowRight,
  GitCommit,
  Layers,
  ChevronRight
} from 'lucide-react';

interface MobileStatusTrackerProps {
  tickets: Ticket[];
  counters: ServiceCounter[];
  initialTicketNumber?: string;
  onClose?: () => void;
  onSwitchTicket?: (ticketNumber: string) => void;
}

export const MobileStatusTracker: React.FC<MobileStatusTrackerProps> = ({
  tickets,
  counters,
  initialTicketNumber,
  onClose,
  onSwitchTicket,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialTicketNumber || '');
  // Mandatory Sound Notification is strictly forced ON
  const [hasNotifiedCalling, setHasNotifiedCalling] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'status' | 'pipeline' | 'checklist' | 'counters'>('status');
  const [closeCountdown, setCloseCountdown] = useState<number | null>(null);

  // Station transfer / redirection alert state
  const [transferAlert, setTransferAlert] = useState<{
    previousCounterName?: string;
    nextCounterName: string;
    nextCounterId: number;
    officerName?: string;
  } | null>(null);

  const prevTicketStateRef = useRef<{
    status?: string;
    assignedCounter?: number;
    ticketNumber?: string;
  }>({});

  // Always force sound enabled on Mobile Tracking
  useEffect(() => {
    soundManager.setSoundEnabled(true);
    soundManager.setVoiceEnabled(true);
    soundManager.unlockAudio();

    const handleUnlock = () => {
      soundManager.unlockAudio();
    };
    window.addEventListener('click', handleUnlock, { once: true });
    window.addEventListener('touchstart', handleUnlock, { once: true });
    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };
  }, []);

  // Synchronize when initialTicketNumber changes (e.g. from QR scan or ticket selection)
  useEffect(() => {
    if (initialTicketNumber) {
      setSearchQuery(initialTicketNumber.trim().toUpperCase());
    }
  }, [initialTicketNumber]);

  // Find the targeted ticket from live queue state
  const currentTicket = useMemo(() => {
    if (!searchQuery.trim()) {
      // Default to the first waiting or calling ticket if none specified
      return tickets.find(t => t.status === 'CALLING') || 
             tickets.find(t => t.status === 'WAITING') || 
             tickets[0] || null;
    }
    const cleanQuery = searchQuery.trim().toUpperCase();
    const normalizedQuery = cleanQuery.replace(/[^A-Z0-9]/g, '');
    return tickets.find(t => {
      const num = t.ticketNumber.toUpperCase();
      const normNum = num.replace(/[^A-Z0-9]/g, '');
      return num === cleanQuery ||
        normNum === normalizedQuery ||
        t.id.toUpperCase() === cleanQuery ||
        (t.bodyNumber && t.bodyNumber.toUpperCase() === cleanQuery) ||
        (t.plateOrUnitNumber && t.plateOrUnitNumber.toUpperCase() === cleanQuery) ||
        (t.franchiseNumber && t.franchiseNumber.toUpperCase() === cleanQuery);
    }) || null;
  }, [tickets, searchQuery]);

  // Queue position and estimated wait calculations
  const waitInfo = useMemo(() => {
    if (!currentTicket) return { position: 0, estimatedMinutes: 0 };
    return calculateWaitEstimates(tickets, currentTicket.id);
  }, [tickets, currentTicket]);

  // Find counter serving/calling this ticket
  const assignedCounterObj = useMemo(() => {
    if (!currentTicket || !currentTicket.assignedCounter) return null;
    return counters.find(c => c.id === currentTicket.assignedCounter) || null;
  }, [currentTicket, counters]);

  const triggerVibration = (pattern: number[] = [500, 200, 500, 200, 800]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        console.warn('Vibration not permitted by device:', err);
      }
    }
  };

  const playAlertSound = () => {
    if (!currentTicket) return;
    const counterName = assignedCounterObj?.name || 'Assessment';
    soundManager.playMobileCallingAlert(
      currentTicket.ticketNumber,
      counterName,
      getFranchiseTypeLabel(currentTicket.franchiseType)
    );
  };

  // Handle calling notification (mandatory audio chime and smartphone vibration)
  useEffect(() => {
    if (currentTicket && (currentTicket.status === 'CALLING' || currentTicket.status === 'SERVING') && !hasNotifiedCalling) {
      playAlertSound();
      
      // Trigger strong mobile vibration pattern on calling notification
      triggerVibration([600, 250, 600, 250, 1000]);
      setHasNotifiedCalling(true);
    } else if (currentTicket && currentTicket.status !== 'CALLING' && currentTicket.status !== 'SERVING') {
      setHasNotifiedCalling(false);
    }
  }, [currentTicket, hasNotifiedCalling]);

  const activeDocuments = currentTicket 
    ? getDocumentsForType(currentTicket.franchiseType)
    : [];

  // Auto-close browser tab when ticket transaction is completed
  useEffect(() => {
    if (currentTicket && currentTicket.status === 'COMPLETED') {
      if (closeCountdown === null) {
        setCloseCountdown(5); // 5-second countdown to close
      }
    } else {
      setCloseCountdown(null);
    }
  }, [currentTicket?.status]);

  // Station completion & redirection detection hook
  useEffect(() => {
    if (!currentTicket) return;

    const prev = prevTicketStateRef.current;
    const currentCounterId = currentTicket.assignedCounter || 1;
    const currentStatus = currentTicket.status;

    // Check if this ticket was completed at one station and transferred to the next
    const isStationCompletedAndTransferred = 
      prev.ticketNumber === currentTicket.ticketNumber &&
      ((prev.assignedCounter && prev.assignedCounter !== currentCounterId) ||
       (prev.status === 'SERVING' && currentStatus === 'WAITING'));

    if (isStationCompletedAndTransferred && currentStatus !== 'COMPLETED') {
      const prevCounterObj = prev.assignedCounter ? counters.find(c => c.id === prev.assignedCounter) : null;
      const nextCounterObj = counters.find(c => c.id === currentCounterId) || null;
      const nextName = nextCounterObj?.name || `Station ${currentCounterId}`;
      const prevName = prevCounterObj?.name;

      setTransferAlert({
        previousCounterName: prevName,
        nextCounterName: nextName,
        nextCounterId: currentCounterId,
        officerName: nextCounterObj?.officerName,
      });

      // Provide immediate vocal announcement, chime, and strong smartphone vibration
      soundManager.playTransferChime(currentTicket.ticketNumber, nextName, prevName);
      triggerVibration([400, 150, 400, 150, 600]);
    }

    prevTicketStateRef.current = {
      status: currentStatus,
      assignedCounter: currentCounterId,
      ticketNumber: currentTicket.ticketNumber,
    };
  }, [currentTicket?.assignedCounter, currentTicket?.status, currentTicket?.ticketNumber, counters]);

  useEffect(() => {
    if (closeCountdown === null) return;
    if (closeCountdown > 0) {
      const timer = setTimeout(() => {
        setCloseCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (closeCountdown === 0) {
      try {
        window.close();
      } catch (err) {
        console.warn('Browser prevented direct window.close:', err);
      }
      onClose?.();
    }
  }, [closeCountdown, onClose]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans selection:bg-teal-700 selection:text-white pb-6">
      {/* Main Mobile Content Body - Header above logo removed per user directive */}
      <main className="max-w-md w-full mx-auto px-4 pt-6 pb-4 flex-1 flex flex-col gap-3.5">
        {/* Centered MTFRB Logo and Official Branding at the Very Top */}
        <div className="flex flex-col items-center justify-center text-center py-2 w-full relative">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-0 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Back
            </button>
          )}

          <div className="flex items-center justify-center w-full">
            <img 
              src={MTFRB_LOGO} 
              alt="Official MTFRB Castillejos Seal" 
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full object-cover border-3 border-amber-400 shadow-xl mx-auto transition-transform hover:scale-105 shrink-0 block" 
            />
          </div>
          <h2 className="text-base sm:text-lg md:text-xl font-black tracking-wider uppercase text-slate-100 mt-2.5 leading-tight text-center w-full">
            MTFRB CASTILLEJOS | PORTAL
          </h2>
          <p className="text-xs sm:text-sm text-teal-400 font-semibold mt-0.5 text-center w-full">
            Official Citizen Mobile Queue Tracker
          </p>

          {/* Indicators Bar below logo */}
          <div className="flex items-center justify-center gap-2 mt-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-700/60 text-emerald-400 text-xs font-mono shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold tracking-wider">LIVE QUEUE</span>
            </div>

            <div 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-950/90 border border-teal-700/80 text-teal-300 text-xs font-bold shadow-2xs"
              title="Sound alert and smartphone vibration are permanently active"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-amber-300 font-black">SOUND & VIBRATE ON</span>
            </div>
          </div>
        </div>

        {/* Transaction Completed Auto-Close Browser Banner */}
        {currentTicket?.status === 'COMPLETED' && (
          <div className="bg-gradient-to-b from-emerald-950/95 to-slate-950 border-2 border-emerald-500 rounded-2xl p-4 text-center shadow-2xl flex flex-col items-center gap-2.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Transaction Completed</h3>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Thank you for transacting with MTFRB Castillejos. Your franchise queue has ended.
              </p>
            </div>

            <div className="w-full bg-emerald-900/40 border border-emerald-700/60 rounded-xl p-2.5 flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-emerald-300">
                {closeCountdown !== null && closeCountdown > 0 ? (
                  <>Closing browser automatically in <strong className="text-white text-sm font-mono">{closeCountdown}s</strong>...</>
                ) : (
                  <>Closing browser...</>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  try { window.close(); } catch {}
                  onClose?.();
                }}
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer"
              >
                Close Browser Now
              </button>
            </div>
          </div>
        )}

        {/* Ticket Selector / Search Field */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 shadow-sm space-y-2">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (onSwitchTicket && searchQuery.trim()) {
                onSwitchTicket(searchQuery.trim());
              }
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                placeholder="Enter Ticket (e.g. N-101, R-201, CM-301)"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase tracking-wider focus:outline-hidden focus:border-teal-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Track
            </button>
          </form>

          <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/60">
            <span className="inline-flex items-center gap-1 text-teal-400 font-medium">
              <QrCode className="w-3 h-3 text-teal-400" />
              <span>Verify QR on printed ticket</span>
            </span>
            <span className="text-slate-500 font-mono text-[9px]">Live status sync</span>
          </div>
        </div>

        {currentTicket ? (
          <>
            {/* Station Transfer / Redirection Notification Banner */}
            {transferAlert && (
              <div 
                id="mobile-station-redirect-banner"
                className="bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 border-2 border-teal-400 rounded-2xl p-4 text-white shadow-2xl animate-in fade-in slide-in-from-top-3 duration-300 relative overflow-hidden ring-4 ring-teal-500/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/60 flex items-center justify-center shrink-0 text-teal-300">
                    <ArrowRightCircle className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-400 text-slate-950 font-mono">
                        STATION COMPLETED ➔ REDIRECTED
                      </span>
                      <button 
                        type="button"
                        onClick={() => setTransferAlert(null)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-white mt-1">
                      Transferred to: <span className="text-amber-300">{transferAlert.nextCounterName}</span>
                    </h4>
                    {transferAlert.previousCounterName && (
                      <p className="text-xs text-teal-200 mt-0.5">
                        Completed station at <strong className="text-white">{transferAlert.previousCounterName}</strong>.
                      </p>
                    )}
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      👉 Please proceed to <strong className="text-white">{transferAlert.nextCounterName}</strong> (Station #{transferAlert.nextCounterId}).
                      {transferAlert.officerName && (
                        <span> Desk Officer: <strong className="text-teal-300">{transferAlert.officerName}</strong>.</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Urgent Calling / Serving Banner with Audio Chime replay */}
            {(currentTicket.status === 'CALLING' || currentTicket.status === 'SERVING') && (
              <div className="bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 text-slate-950 p-4 rounded-2xl shadow-xl border-2 border-emerald-200 animate-pulse flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-slate-950 text-emerald-300 rounded-lg">
                      <Bell className="w-5 h-5 animate-bounce" />
                    </span>
                    <div>
                      <div className="font-black text-xs sm:text-sm uppercase tracking-wider text-slate-950 leading-tight">
                        NOW SERVING YOUR TICKET!
                      </div>
                      <div className="text-[10px] font-semibold text-slate-900 leading-tight">
                        Please proceed to your assigned service desk now
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={playAlertSound}
                    className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-teal-300 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Play Sound</span>
                  </button>
                </div>
                <div className="bg-slate-950/10 rounded-xl p-2.5 text-center border border-slate-950/20">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                    Your Assigned Service Desk
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-ticket text-slate-950 mt-0.5">
                    {assignedCounterObj?.name || `Counter ${currentTicket.assignedCounter || 1}`}
                  </div>
                </div>
              </div>
            )}

            {/* Status Hero Card */}
            <div className={`rounded-2xl p-4 sm:p-5 border-2 relative overflow-hidden transition-all shadow-xl ${
              currentTicket.status === 'CALLING'
                ? 'bg-gradient-to-b from-amber-900/60 to-slate-900 border-amber-500 ring-4 ring-amber-500/20 animate-pulse'
                : currentTicket.status === 'SERVING'
                ? 'bg-gradient-to-b from-teal-900/60 to-slate-900 border-teal-500'
                : currentTicket.status === 'COMPLETED'
                ? 'bg-gradient-to-b from-emerald-900/60 to-slate-900 border-emerald-500'
                : 'bg-gradient-to-b from-slate-800/80 to-slate-900 border-slate-700'
            }`}>
              {/* Centered Responsive Background Watermark Seal */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
                <img 
                  src={MTFRB_LOGO} 
                  alt="MTFRB Official Seal" 
                  className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 object-contain opacity-15 select-none transition-all" 
                />
              </div>

              {/* Status Card Foreground Content */}
              <div className="relative z-10">
                {/* Dynamic Status Alert Banner */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      currentTicket.status === 'CALLING' 
                        ? 'bg-amber-400 animate-ping' 
                        : currentTicket.status === 'SERVING'
                        ? 'bg-teal-400'
                        : currentTicket.status === 'COMPLETED'
                        ? 'bg-emerald-400'
                        : 'bg-slate-400'
                    }`} />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                      {currentTicket.status === 'CALLING' && '🔔 NOW CALLING — PROCEED TO COUNTER'}
                      {currentTicket.status === 'SERVING' && '🟢 NOW SERVING AT COUNTER'}
                      {currentTicket.status === 'WAITING' && '⏳ QUEUED — WAITING IN LINE'}
                      {currentTicket.status === 'COMPLETED' && '✓ TRANSACTION COMPLETED'}
                      {currentTicket.status === 'NO_SHOW' && '⚠️ MISSED CALL / NO SHOW'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950/60 text-slate-300 border border-slate-700">
                    Live
                  </span>
                </div>

                {/* Big Queue Number */}
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-950/70 border border-teal-600/50 text-[11px] font-mono font-bold text-teal-300 mb-1.5">
                    <span>Verified Ticket No</span>
                    <span className="text-emerald-400">✓</span>
                  </div>
                  <div className="text-5xl sm:text-6xl font-black font-ticket tracking-tight text-white drop-shadow-sm">
                    {currentTicket.ticketNumber}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {getFranchiseTypeLabel(currentTicket.franchiseType)}
                    </span>
                    {currentTicket.priorityLevel === 'PRIORITY' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        ★ Priority Lane ({currentTicket.priorityReason || 'Senior/PWD'})
                      </span>
                    )}
                  </div>
                </div>

                {/* Call to Counter Notice (if Calling or Serving) */}
                {(currentTicket.status === 'CALLING' || currentTicket.status === 'SERVING') && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-center">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Assigned Service Desk:
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-200 mt-0.5">
                      {assignedCounterObj?.name || 'Assessment'}
                    </div>
                    {assignedCounterObj && (
                      <div className="text-xs text-amber-300/80 mt-0.5">
                        Attending Officer: <strong className="text-white">{assignedCounterObj.officerName}</strong>
                      </div>
                    )}
                    <p className="text-[11px] text-amber-200/70 mt-1">
                      Please proceed to {assignedCounterObj?.name || 'the service station'} with your original documents and official slip.
                    </p>
                  </div>
                )}

                {/* Waiting Metrics (Position & Time) */}
                {currentTicket.status === 'WAITING' && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-center">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Position Ahead</div>
                      <div className="text-2xl font-black text-white mt-0.5">
                        {waitInfo.position === 1 ? 'Next' : waitInfo.position}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {waitInfo.position === 1 ? 'You are next in line' : 'applicants before you'}
                      </div>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-center">
                      <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-teal-400" />
                        <span>Estimated Wait</span>
                      </div>
                      <div className="text-2xl font-black text-teal-300 mt-0.5">
                        ~{waitInfo.estimatedMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
                      </div>
                      <div className="text-[10px] text-slate-400">approximate queue time</div>
                    </div>
                  </div>
                )}

                {/* Destination Station when Waiting */}
                {currentTicket.status === 'WAITING' && (
                  <div className="mt-3.5 p-3 bg-teal-950/80 border border-teal-500/50 rounded-xl text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                      Assigned Destination Station:
                    </div>
                    <div className="text-xl font-black text-white mt-0.5">
                      {assignedCounterObj?.name || `Station #${currentTicket.assignedCounter || 1}`}
                    </div>
                    {assignedCounterObj && (
                      <div className="text-xs text-teal-200/90 mt-0.5">
                        Attending Officer: <strong className="text-amber-300">{assignedCounterObj.officerName}</strong>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-300 mt-1">
                      👉 You are in queue for Station #{assignedCounterObj?.id || currentTicket.assignedCounter || 1}. Please proceed to the {assignedCounterObj?.name || 'counter'} waiting area.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Applicant Details Accordion Box (Plate/Unit ID removed, only Body Number retained) */}
            <div className="bg-slate-950/90 rounded-xl border border-slate-800 p-3.5 text-xs shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between">
                <span>Applicant Information</span>
                <span className="text-teal-400 font-mono">ID: {currentTicket.id.slice(0, 10)}</span>
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-2.5">
                <div>
                  <span className="text-slate-500 text-[10px] block">Name:</span>
                  <span className="font-bold text-white truncate block">{currentTicket.applicantName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Zone / Route:</span>
                  <span className="font-bold text-teal-300 block">{currentTicket.zone || 'Zone 1'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Classification:</span>
                  <span className="font-medium text-slate-200 block">{currentTicket.classification || 'Operator'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Body Number:</span>
                  <span className="font-mono font-bold text-amber-300 block">
                    {currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || 'N/A'}
                  </span>
                </div>
                {currentTicket.franchiseNumber && (
                  <div className="col-span-2">
                    <span className="text-slate-500 text-[10px] block">Franchise Number:</span>
                    <span className="font-mono font-bold text-teal-300 block">{currentTicket.franchiseNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 8-Station Sequential Flow Progress Meter */}
            <div className="bg-slate-950/90 rounded-xl border border-slate-800 p-3 shadow-sm">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-teal-400" />
                  <span>Franchise Station Flow</span>
                </span>
                <span className="font-mono text-teal-400 font-bold text-xs">
                  {currentTicket.status === 'COMPLETED' ? (
                    'Station 8 of 8 • Completed'
                  ) : (
                    `Station ${currentTicket.assignedCounter || 1} of 8 • ${assignedCounterObj?.name?.split(' - ')[0] || 'Assessment'}`
                  )}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: currentTicket.status === 'COMPLETED' 
                      ? '100%' 
                      : `${Math.min(100, Math.max(12.5, ((currentTicket.assignedCounter || 1) / 8) * 100))}%` 
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400 font-medium">
                <span>1. Assess</span>
                <span>2. Verify</span>
                <span>3. Inspect</span>
                <span>4. Pay</span>
                <span>8. Release</span>
              </div>
            </div>

            {/* Navigation Tabs (Advice vs 8 Stations vs Requirements vs Desks) */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'status' 
                    ? 'bg-teal-700 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Advice
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pipeline')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'pipeline' 
                    ? 'bg-teal-700 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Stations (8)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('checklist')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'checklist' 
                    ? 'bg-teal-700 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Docs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('counters')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'counters' 
                    ? 'bg-teal-700 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Desks
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'status' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs space-y-2.5">
                <div className="flex items-start gap-2 text-slate-300">
                  <Volume2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Audible Voice Call:</strong> When your ticket is ready, the public address system will announce your number, and your phone will chime if alerts are enabled.
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-300 pt-2 border-t border-slate-800/80">
                  <ArrowRight className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Automatic Station Transfer:</strong> Once an officer completes your station, your ticket is automatically routed to the next counter in the pipeline.
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-300 pt-2 border-t border-slate-800/80">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Keep Browser Tab Open:</strong> This live tracker updates automatically every few seconds. You may safely step outside the lobby.
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-300 pt-2 border-t border-slate-800/80">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Office Location:</strong> Ground Floor, MTFRB Office, Municipal Hall Building, San Juan, Castillejos, Zambales.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pipeline' && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs space-y-2.5">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>8-Station Sequential Flow</span>
                  <span className="text-[10px] text-teal-400 font-mono font-bold">Castillejos MTFRB</span>
                </div>
                <div className="space-y-2">
                  {counters.slice(0, 8).map((c, index) => {
                    const currentStationId = currentTicket.assignedCounter || 1;
                    const isTicketCompleted = currentTicket.status === 'COMPLETED';
                    const isStationDone = isTicketCompleted || c.id < currentStationId;
                    const isCurrentStation = !isTicketCompleted && c.id === currentStationId;
                    const isUpcoming = !isTicketCompleted && c.id > currentStationId;

                    return (
                      <div 
                        key={c.id} 
                        className={`p-2.5 rounded-lg border transition-all ${
                          isCurrentStation 
                            ? 'bg-teal-950/70 border-teal-500 ring-2 ring-teal-500/20 shadow-md' 
                            : isStationDone
                            ? 'bg-slate-900/60 border-slate-800 opacity-90'
                            : 'bg-slate-900/30 border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                              isStationDone 
                                ? 'bg-emerald-500 text-slate-950' 
                                : isCurrentStation
                                ? 'bg-teal-400 text-slate-950 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isStationDone ? '✓' : index + 1}
                            </span>
                            <div>
                              <div className={`font-bold text-xs ${isCurrentStation ? 'text-teal-200' : 'text-white'}`}>
                                {c.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Desk Officer: <span className="text-slate-300">{c.officerName}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            {isStationDone && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                                Completed ✓
                              </span>
                            )}
                            {isCurrentStation && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-900 text-teal-200 border border-teal-500 animate-pulse">
                                {currentTicket.status === 'CALLING' ? 'Calling Now 🔔' : currentTicket.status === 'SERVING' ? 'Serving Now 🟢' : 'Current Station ➔'}
                              </span>
                            )}
                            {isUpcoming && (
                              <span className="text-[10px] text-slate-500 italic">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-2 rounded-lg bg-teal-950/50 border border-teal-800/40 text-[11px] text-teal-300">
                  ℹ️ Upon completion of each station, the officer certifies your documents and your ticket is automatically redirected to the next counter.
                </div>
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Prepare Original & Photocopies:</span>
                  <span className="text-[10px] text-teal-400 font-bold">
                    {getFranchiseTypeLabel(currentTicket.franchiseType)}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {activeDocuments.map((doc) => (
                    <div key={doc.id} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-white text-xs">{doc.name}</div>
                        <div className="text-[10px] text-slate-400">{doc.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'counters' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Active Service Desks
                </div>
                <div className="space-y-1.5">
                  {counters.map((c) => {
                    const servingTicket = tickets.find(t => t.id === c.currentTicketId);
                    return (
                      <div key={c.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs">{c.name.split(' - ')[0]}</div>
                          <div className="text-[10px] text-slate-400">{c.officerName}</div>
                        </div>
                        <div className="text-right">
                          {servingTicket ? (
                            <span className="font-ticket font-bold text-sm px-2 py-0.5 rounded bg-teal-900 text-teal-200 border border-teal-700">
                              {servingTicket.ticketNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Available</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10 px-5 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-white">Ticket Not Found</h3>
            <p className="text-xs font-semibold text-teal-400 mt-2">
              Please verify QR on printed ticket.
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Ensure you are entering the ticket number from your official paper slip, or re-scan the QR code using your phone camera.
            </p>
          </div>
        )}
      </main>

      {/* Mobile Footer */}
      <footer className="max-w-md w-full mx-auto px-4 text-center text-[11px] text-slate-400 pt-3 border-t border-slate-800/80 space-y-1">
        <div className="flex items-center justify-center gap-1.5 font-medium text-teal-400">
          <QrCode className="w-3.5 h-3.5" />
          <span>Verify QR on printed ticket</span>
        </div>
        <p className="text-[10px] text-slate-500">
          MTFRB Castillejos, Zambales • Live Queue System
        </p>
      </footer>
    </div>
  );
};
