import React, { useState, useEffect } from 'react';
import { Ticket, ServiceCounter, getFranchiseTypeLabel } from '../types';
import { soundManager } from '../utils/audio';
import { MTFRB_LOGO } from '../assets/logo';
import { loadLobbyAdvisory } from '../utils/storage';
import { 
  Volume2, 
  Sparkles, 
  Bell, 
  Minimize2,
  Car,
  User
} from 'lucide-react';

interface PublicDisplayBoardProps {
  tickets: Ticket[];
  counters: ServiceCounter[];
  onExit?: () => void;
}

export const PublicDisplayBoard: React.FC<PublicDisplayBoardProps> = ({
  tickets,
  counters,
  onExit,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [advisoryText, setAdvisoryText] = useState<string>(() => loadLobbyAdvisory());

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to advisory updates
  useEffect(() => {
    const updateAdvisory = () => {
      setAdvisoryText(loadLobbyAdvisory());
    };
    window.addEventListener('franchise_queue_updated', updateAdvisory);
    return () => window.removeEventListener('franchise_queue_updated', updateAdvisory);
  }, []);

  const [audioActivated, setAudioActivated] = useState<boolean>(() => soundManager.isAudioUnlocked());

  // Ensure audio unlocked on interaction
  useEffect(() => {
    soundManager.setSoundEnabled(true);
    soundManager.setVoiceEnabled(true);
    soundManager.unlockAudio();

    const handleInteract = () => {
      soundManager.unlockAudio();
      setAudioActivated(true);
    };
    window.addEventListener('click', handleInteract);
    window.addEventListener('keydown', handleInteract);
    window.addEventListener('touchstart', handleInteract);
    return () => {
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('keydown', handleInteract);
      window.removeEventListener('touchstart', handleInteract);
    };
  }, []);

  // Listen for real-time global call announcements from ANY browser or computer
  const lastProcessedAnnouncementId = React.useRef<string>('');
  useEffect(() => {
    const handleGlobalAnnouncement = (event: Event) => {
      const customEvent = event as CustomEvent;
      const announcement = customEvent.detail;
      if (!announcement || !announcement.ticketNumber) return;

      if (announcement.id && announcement.id === lastProcessedAnnouncementId.current) {
        return; // Prevent duplicate playback
      }
      lastProcessedAnnouncementId.current = announcement.id;

      // Ensure audio context is unlocked & speak across lobby speakers
      soundManager.unlockAudio();
      setAudioActivated(true);

      soundManager.playCallingAlert(
        announcement.ticketNumber,
        announcement.counterName ? `${announcement.counterName}` : 'Service Station',
        announcement.serviceType,
        announcement.bodyNumber || announcement.ticketNumber
      );
    };

    window.addEventListener('mtfrb_call_announcement', handleGlobalAnnouncement);
    return () => window.removeEventListener('mtfrb_call_announcement', handleGlobalAnnouncement);
  }, []);

  // Listen for F12 key (disable Esc to avoid accidental closure)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || e.code === 'F12') {
        e.preventDefault();
        onExit?.();
      } else if (e.key === 'Escape' || e.code === 'Escape') {
        // Explicitly disable Esc to avoid accidental closure of the system
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  const handleTestChime = () => {
    soundManager.unlockAudio();
    setAudioActivated(true);
    soundManager.playCallingAlert('1248', 'Assessment Station', 'New Franchise', '1248');
  };

  // Find most recently called ticket
  const callingTickets = tickets
    .filter((t) => t.status === 'CALLING' || t.status === 'SERVING')
    .sort((a, b) => (b.calledAt || 0) - (a.calledAt || 0));

  const spotlightTicket = callingTickets[0];
  const spotlightCounter = counters.find((c) => c.id === spotlightTicket?.assignedCounter);
  const totalWaiting = tickets.filter((t) => t.status === 'WAITING').length;

  // Fallback auto-announce on Lobby TV if direct state changes occur
  const lastAnnouncedCalledAt = React.useRef<number>(0);
  useEffect(() => {
    if (
      spotlightTicket &&
      spotlightTicket.calledAt &&
      spotlightTicket.calledAt > lastAnnouncedCalledAt.current &&
      Date.now() - spotlightTicket.calledAt < 15000
    ) {
      lastAnnouncedCalledAt.current = spotlightTicket.calledAt;
      soundManager.unlockAudio();
      soundManager.playCallingAlert(
        spotlightTicket.ticketNumber,
        spotlightCounter?.name ? `${spotlightCounter.name} Station` : 'Service Station',
        undefined,
        spotlightTicket.bodyNumber || spotlightTicket.plateOrUnitNumber || spotlightTicket.ticketNumber
      );
    }
  }, [spotlightTicket?.calledAt, spotlightTicket?.ticketNumber, spotlightTicket?.bodyNumber, spotlightCounter?.name]);

  // Upcoming tickets categorized to track all upcoming tickets
  const upcomingNew = tickets
    .filter((t) => t.status === 'WAITING' && t.franchiseType === 'NEW')
    .sort((a, b) => {
      if (a.priorityLevel === 'PRIORITY' && b.priorityLevel !== 'PRIORITY') return -1;
      if (b.priorityLevel === 'PRIORITY' && a.priorityLevel !== 'PRIORITY') return 1;
      return a.createdAt - b.createdAt;
    })
    .slice(0, 3);

  const upcomingRenewal = tickets
    .filter((t) => t.status === 'WAITING' && t.franchiseType === 'RENEWAL')
    .sort((a, b) => {
      if (a.priorityLevel === 'PRIORITY' && b.priorityLevel !== 'PRIORITY') return -1;
      if (b.priorityLevel === 'PRIORITY' && a.priorityLevel !== 'PRIORITY') return 1;
      return a.createdAt - b.createdAt;
    })
    .slice(0, 3);

  const upcomingChangeMotor = tickets
    .filter((t) => t.status === 'WAITING' && t.franchiseType === 'CHANGE_MOTOR')
    .sort((a, b) => {
      if (a.priorityLevel === 'PRIORITY' && b.priorityLevel !== 'PRIORITY') return -1;
      if (b.priorityLevel === 'PRIORITY' && a.priorityLevel !== 'PRIORITY') return 1;
      return a.createdAt - b.createdAt;
    })
    .slice(0, 3);

  const upcomingDropping = tickets
    .filter((t) => t.status === 'WAITING' && t.franchiseType === 'DROPPING')
    .sort((a, b) => {
      if (a.priorityLevel === 'PRIORITY' && b.priorityLevel !== 'PRIORITY') return -1;
      if (b.priorityLevel === 'PRIORITY' && a.priorityLevel !== 'PRIORITY') return 1;
      return a.createdAt - b.createdAt;
    })
    .slice(0, 3);

  return (
    <div className="relative h-full w-full max-w-[1920px] mx-auto flex flex-col overflow-hidden p-1.5 sm:p-2.5 gap-2 sm:gap-2.5 text-slate-100 select-none">
      {/* Background MTFRB Logo Watermark at ~10% Opacity for maximum element legibility */}
      <div 
        className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0"
        aria-hidden="true"
      >
        <img 
          src={MTFRB_LOGO} 
          alt="MTFRB Seal Background" 
          className="w-[min(65vw,65vh)] h-[min(65vw,65vh)] max-w-[580px] max-h-[580px] object-contain opacity-[0.09] select-none pointer-events-none" 
        />
      </div>

      {/* Top TV Screen Header - Compact & High Contrast */}
      <div className="relative z-10 bg-slate-900/95 text-white rounded-xl px-2.5 sm:px-3.5 py-1.5 shadow-md border border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img 
            src={MTFRB_LOGO} 
            alt="MTFRB Castillejos Seal" 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-amber-400 shadow-sm shrink-0" 
          />
          <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-teal-400 leading-tight truncate">
              MTFRB Castillejos • Zambales
            </div>
            <h1 className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-white leading-tight truncate">
              MTFRB CASTILLEJOS | PORTAL
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 hidden md:block leading-tight truncate">
              Live Public Service Board • Municipal Tricycle Franchising & Regulatory Board
            </p>
          </div>
        </div>

        {/* Live Clock & Audio Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-teal-400 leading-none">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 hidden sm:block leading-tight mt-0.5">
              {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 border-l border-slate-700/80 pl-2 sm:pl-2.5">
            {/* Forced Sound Enabled Indicator */}
            <div 
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-950/90 border border-teal-500/70 text-teal-300 text-xs font-bold shadow-2xs"
              title="Voice synthesis and calling chime are permanently enabled"
            >
              <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="text-[9px] sm:text-[10px] text-amber-300 font-black tracking-wider whitespace-nowrap">SOUND: ON</span>
            </div>

            <button
              onClick={handleTestChime}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors hidden sm:flex items-center gap-1 cursor-pointer"
              title="Test audio chime on lobby speakers"
            >
              <Bell className="w-3 h-3 text-teal-400 shrink-0" />
              <span className="text-[10px] sm:text-xs">Chime</span>
            </button>

            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 hover:border-slate-500 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                title="Exit Full Screen TV Mode (or press F12)"
              >
                <Minimize2 className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="hidden md:inline text-[10px] sm:text-xs">Exit</span>
                <kbd className="px-1 py-0.2 rounded bg-slate-950 text-teal-300 font-mono text-[9px] border border-slate-700 font-bold">
                  F12
                </kbd>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Autoplay Audio Activation Banner (Browsers require 1 user interaction to enable speech synthesis across separate screens) */}
      {!audioActivated && (
        <div 
          onClick={() => {
            soundManager.unlockAudio();
            setAudioActivated(true);
            soundManager.playChime();
          }}
          className="relative z-20 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-between gap-2 shadow-lg cursor-pointer transition-all animate-bounce"
        >
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-slate-950 shrink-0" />
            <span>Click anywhere on this screen to enable full cross-computer Speech & Voice Announcements for this Lobby TV.</span>
          </div>
          <span className="px-2.5 py-0.5 rounded bg-slate-950 text-amber-300 text-[10px] font-black uppercase shrink-0">
            Click to Activate Audio
          </span>
        </div>
      )}

      {/* Spotlight Now Serving Hero Stage - High Impact, Much Bigger Proportions & Large Contents */}
      {spotlightTicket ? (
        <div className="flex-1 min-h-[190px] sm:min-h-[220px] lg:min-h-[240px] bg-gradient-to-r from-teal-950 via-slate-900 to-slate-950 rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 shadow-2xl border-3 border-teal-400/90 ring-4 ring-teal-500/20 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-5 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <Sparkles className="w-56 h-56 lg:w-72 lg:h-72 text-teal-300" />
          </div>

          {/* Left: Ticket Number & Client Name */}
          <div className="relative z-10 flex-1 min-w-0 text-center md:text-left flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-black tracking-widest uppercase bg-teal-500/30 text-teal-300 border border-teal-400/60 mb-1 shadow-xs w-fit mx-auto md:mx-0">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping"></span>
              <span>NOW SERVING • CURRENT APPLICANT</span>
            </div>

            <div className="flex flex-col md:flex-row items-center md:items-baseline gap-2 sm:gap-5 my-0.5 sm:my-1">
              <div className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[9.25rem] 2xl:text-[10.5rem] font-black font-ticket tracking-tight text-amber-300 drop-shadow-2xl leading-none shrink-0">
                {spotlightTicket.ticketNumber}
              </div>
              <div className="flex flex-col items-center md:items-start min-w-0">
                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-wide truncate max-w-sm sm:max-w-md lg:max-w-xl xl:max-w-2xl drop-shadow-lg leading-tight">
                  {spotlightTicket.applicantName}
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1.5 sm:mt-2">
                  <span className="text-xs sm:text-sm md:text-base font-extrabold px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg bg-teal-900/90 text-teal-100 border border-teal-500/70 shadow-xs">
                    {getFranchiseTypeLabel(spotlightTicket.franchiseType)}
                  </span>
                  {spotlightTicket.bodyNumber && (
                    <span className="text-xs sm:text-sm md:text-base font-bold px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5 shadow-xs">
                      <Car className="w-4 h-4 text-amber-400" />
                      <span>Body #{spotlightTicket.bodyNumber}</span>
                    </span>
                  )}
                  {spotlightTicket.priorityLevel === 'PRIORITY' && (
                    <span className="text-xs sm:text-sm md:text-base px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg bg-amber-500/30 text-amber-300 font-black border border-amber-400/60 shadow-xs">
                      ★ Priority Lane
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Much Bigger Counter Destination Box */}
          <div className="relative z-10 bg-slate-950/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-5 lg:p-6 border-3 border-teal-400/80 text-center shrink-0 min-w-[220px] sm:min-w-[280px] lg:min-w-[340px] xl:min-w-[390px] shadow-2xl flex flex-col justify-center">
            <div className="text-xs sm:text-sm md:text-base font-black tracking-widest uppercase text-teal-300">
              PLEASE PROCEED TO
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-5.5xl xl:text-6xl font-black font-ticket text-amber-300 tracking-tight my-1 sm:my-1.5 drop-shadow-lg uppercase leading-tight break-words">
              {spotlightCounter?.name || 'ASSESSMENT'}
            </div>
            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs sm:text-sm text-slate-200 font-bold mx-auto">
              <span>Station Desk</span>
            </div>
            {spotlightCounter?.officerName && (
              <div className="text-xs sm:text-sm md:text-base text-teal-300/90 mt-1.5 truncate">
                Officer on Duty: <strong className="text-white">{spotlightCounter.officerName}</strong>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-[190px] sm:min-h-[220px] lg:min-h-[240px] bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 rounded-2xl p-4 sm:p-6 lg:p-7 shadow-2xl border-2 border-slate-800 flex items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-black tracking-widest uppercase text-teal-400 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
              <span>LOBBY QUEUE SYSTEM ACTIVE • READY FOR CALL</span>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white font-ticket">
              Next Ticket Will Be Summoned Shortly
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Please hold your official ticket slip and listen for your number to be called with chime on this board.
            </p>
          </div>
          <div className="bg-slate-950/90 rounded-2xl p-4 sm:p-5 border-2 border-teal-500/40 text-center shrink-0 min-w-[180px] sm:min-w-[220px] shadow-xl">
            <div className="text-xs uppercase font-bold tracking-wider text-slate-400">Waiting in Line</div>
            <div className="text-5xl sm:text-6xl font-black font-ticket text-teal-300 my-0.5 leading-none">{totalWaiting}</div>
            <div className="text-xs text-slate-400 font-semibold">Applicants Queued</div>
          </div>
        </div>
      )}

      {/* 8 Service Counters Status Windows Matrix: 4 columns x 2 rows, compact & legible */}
      <div className="shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
          {counters.map((c) => {
            const ticketServing = tickets.find((t) => t.id === c.currentTicketId && (t.status === 'CALLING' || t.status === 'SERVING'));
            const isBusy = !!ticketServing;
            const isCalling = ticketServing?.status === 'CALLING';

            return (
              <div
                key={c.id}
                className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all flex flex-col justify-between ${
                  isCalling
                    ? 'border-amber-400 bg-amber-950/60 shadow-lg ring-2 ring-amber-400/40 animate-pulse'
                    : isBusy
                    ? 'border-teal-500/80 bg-slate-900/95 shadow-xs ring-1 ring-teal-500/20'
                    : 'border-slate-800/90 bg-slate-900/75'
                }`}
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-800 gap-1">
                  <span className="font-black text-[11px] sm:text-xs lg:text-sm text-amber-300 truncate tracking-tight" title={c.name}>
                    {c.name}
                  </span>
                  <span
                    className={`text-[8px] sm:text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider shrink-0 shadow-xs ${
                      isCalling
                        ? 'bg-amber-400 text-slate-950 animate-pulse font-black'
                        : isBusy
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-bold'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 font-semibold'
                    }`}
                  >
                    {isCalling ? '● Calling' : isBusy ? '● Serving' : 'Open'}
                  </span>
                </div>

                <div className="py-0.5 sm:py-1 text-center my-auto">
                  <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                    {isCalling ? 'Now Calling' : isBusy ? 'Current Ticket' : 'Station Available'}
                  </div>
                  <div className={`text-2xl sm:text-3xl lg:text-3.5xl font-black font-ticket my-0.5 tracking-tight drop-shadow-xs leading-none ${
                    isCalling ? 'text-amber-300' : isBusy ? 'text-white' : 'text-slate-600'
                  }`}>
                    {ticketServing ? ticketServing.ticketNumber : '—'}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold text-teal-300 truncate px-0.5 min-h-[16px] leading-tight">
                    {ticketServing ? (
                      <span className="inline-flex items-center justify-center gap-1 truncate max-w-full">
                        <span className="truncate">{ticketServing.applicantName}</span>
                        {ticketServing.bodyNumber && (
                          <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-amber-300 border border-slate-700 shrink-0">
                            #{ticketServing.bodyNumber}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium text-[10px]">Ready</span>
                    )}
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/80 text-[9px] sm:text-[10px] text-slate-400 flex items-center justify-between leading-none">
                  <span className="truncate max-w-[120px] sm:max-w-[150px] flex items-center gap-1 font-medium text-slate-300">
                    <User className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                    <span className="truncate">{c.officerName || 'Officer on Duty'}</span>
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase shrink-0">Desk #{c.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Queues Section: 4 Distinct Transaction Categories - Slightly Bigger, Max 3 Waiting Items */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
        {/* 1. Upcoming: New Franchise */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-2 sm:p-2.5 flex flex-col overflow-hidden shadow-md">
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full bg-teal-400 shrink-0"></span>
              <h3 className="font-bold text-white text-xs sm:text-sm truncate">
                Upcoming: New Franchise
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/80 shrink-0">
              {upcomingNew.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {upcomingNew.length === 0 ? (
              <div className="py-2.5 text-center text-slate-500 text-xs font-medium">
                No applicants waiting.
              </div>
            ) : (
              upcomingNew.slice(0, 3).map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-1.5 px-2 sm:px-2.5 rounded-lg bg-slate-800/90 border border-slate-700/70 text-xs sm:text-sm leading-tight hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-ticket font-extrabold text-teal-300 text-xs sm:text-sm shrink-0">
                      {t.ticketNumber}
                    </span>
                    <span className="text-slate-100 font-semibold truncate max-w-[85px] sm:max-w-[120px] md:max-w-[140px]">
                      {t.applicantName}
                    </span>
                  </div>
                  {t.priorityLevel === 'PRIORITY' ? (
                    <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 shrink-0">
                      ★ Prio
                    </span>
                  ) : t.bodyNumber && t.bodyNumber !== t.ticketNumber ? (
                    <span className="text-[8px] sm:text-[9px] font-mono px-1 py-0.2 rounded bg-slate-900/90 text-slate-300 border border-slate-700 shrink-0">
                      #{t.bodyNumber}
                    </span>
                  ) : t.zone ? (
                    <span className="text-[8px] sm:text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-900/60 text-slate-400 border border-slate-700/50 shrink-0">
                      {t.zone}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Upcoming: Franchise Renewal */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-2 sm:p-2.5 flex flex-col overflow-hidden shadow-md">
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0"></span>
              <h3 className="font-bold text-white text-xs sm:text-sm truncate">
                Upcoming: Franchise Renewal
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/80 shrink-0">
              {upcomingRenewal.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {upcomingRenewal.length === 0 ? (
              <div className="py-2.5 text-center text-slate-500 text-xs font-medium">
                No applicants waiting.
              </div>
            ) : (
              upcomingRenewal.slice(0, 3).map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-1.5 px-2 sm:px-2.5 rounded-lg bg-slate-800/90 border border-slate-700/70 text-xs sm:text-sm leading-tight hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-ticket font-extrabold text-blue-300 text-xs sm:text-sm shrink-0">
                      {t.ticketNumber}
                    </span>
                    <span className="text-slate-100 font-semibold truncate max-w-[85px] sm:max-w-[120px] md:max-w-[140px]">
                      {t.applicantName}
                    </span>
                  </div>
                  {t.priorityLevel === 'PRIORITY' ? (
                    <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 shrink-0">
                      ★ Prio
                    </span>
                  ) : t.bodyNumber && t.bodyNumber !== t.ticketNumber ? (
                    <span className="text-[8px] sm:text-[9px] font-mono px-1 py-0.2 rounded bg-slate-900/90 text-slate-300 border border-slate-700 shrink-0">
                      #{t.bodyNumber}
                    </span>
                  ) : t.zone ? (
                    <span className="text-[8px] sm:text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-900/60 text-slate-400 border border-slate-700/50 shrink-0">
                      {t.zone}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Upcoming: Change Motor */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-2 sm:p-2.5 flex flex-col overflow-hidden shadow-md">
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0"></span>
              <h3 className="font-bold text-white text-xs sm:text-sm truncate">
                Upcoming: Change Motor
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/80 shrink-0">
              {upcomingChangeMotor.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {upcomingChangeMotor.length === 0 ? (
              <div className="py-2.5 text-center text-slate-500 text-xs font-medium">
                No applicants waiting.
              </div>
            ) : (
              upcomingChangeMotor.slice(0, 3).map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-1.5 px-2 sm:px-2.5 rounded-lg bg-slate-800/90 border border-slate-700/70 text-xs sm:text-sm leading-tight hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-ticket font-extrabold text-emerald-300 text-xs sm:text-sm shrink-0">
                      {t.ticketNumber}
                    </span>
                    <span className="text-slate-100 font-semibold truncate max-w-[85px] sm:max-w-[120px] md:max-w-[140px]">
                      {t.applicantName}
                    </span>
                  </div>
                  {t.priorityLevel === 'PRIORITY' ? (
                    <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 shrink-0">
                      ★ Prio
                    </span>
                  ) : t.bodyNumber && t.bodyNumber !== t.ticketNumber ? (
                    <span className="text-[8px] sm:text-[9px] font-mono px-1 py-0.2 rounded bg-slate-900/90 text-slate-300 border border-slate-700 shrink-0">
                      #{t.bodyNumber}
                    </span>
                  ) : t.zone ? (
                    <span className="text-[8px] sm:text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-900/60 text-slate-400 border border-slate-700/50 shrink-0">
                      {t.zone}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. Upcoming: Order for Dropping */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-2 sm:p-2.5 flex flex-col overflow-hidden shadow-md">
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0"></span>
              <h3 className="font-bold text-white text-xs sm:text-sm truncate">
                Upcoming: Order for Dropping
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/80 shrink-0">
              {upcomingDropping.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {upcomingDropping.length === 0 ? (
              <div className="py-2.5 text-center text-slate-500 text-xs font-medium">
                No dropping requests waiting.
              </div>
            ) : (
              upcomingDropping.slice(0, 3).map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-1.5 px-2 sm:px-2.5 rounded-lg bg-slate-800/90 border border-slate-700/70 text-xs sm:text-sm leading-tight hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-ticket font-extrabold text-amber-300 text-xs sm:text-sm shrink-0">
                      {t.ticketNumber}
                    </span>
                    <span className="text-slate-100 font-semibold truncate max-w-[85px] sm:max-w-[120px] md:max-w-[140px]">
                      {t.applicantName}
                    </span>
                  </div>
                  {t.priorityLevel === 'PRIORITY' ? (
                    <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 shrink-0">
                      ★ Prio
                    </span>
                  ) : t.bodyNumber && t.bodyNumber !== t.ticketNumber ? (
                    <span className="text-[8px] sm:text-[9px] font-mono px-1 py-0.2 rounded bg-slate-900/90 text-slate-300 border border-slate-700 shrink-0">
                      #{t.bodyNumber}
                    </span>
                  ) : t.zone ? (
                    <span className="text-[8px] sm:text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-900/60 text-slate-400 border border-slate-700/50 shrink-0">
                      {t.zone}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Public Lobby Notice Continuous Scrolling Looping Marquee */}
      <div className="bg-slate-900/95 rounded-xl px-2.5 sm:px-3 py-1 border border-slate-800 flex items-center gap-2 overflow-hidden text-xs text-slate-300 shrink-0 shadow-inner">
        <span className="font-black px-2 py-0.5 bg-teal-600 text-white rounded text-[9px] sm:text-[10px] tracking-wider uppercase shrink-0 shadow-xs flex items-center gap-1">
          <Bell className="w-3 h-3 text-amber-300 animate-pulse shrink-0" />
          <span>LOBBY ADVISORY</span>
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee font-bold text-amber-200 text-[11px] sm:text-xs tracking-wide">
            <span className="mx-6">{advisoryText}</span>
            <span className="text-teal-400 font-extrabold">•</span>
            <span className="mx-6">{advisoryText}</span>
            <span className="text-teal-400 font-extrabold">•</span>
            <span className="mx-6">{advisoryText}</span>
            <span className="text-teal-400 font-extrabold">•</span>
          </div>
        </div>
      </div>
    </div>
  );
};
