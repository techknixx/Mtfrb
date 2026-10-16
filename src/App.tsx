import React, { useState, useEffect, useCallback } from 'react';
import { Ticket, ServiceCounter, UserAccount } from './types';
import { 
  loadTickets, 
  saveTickets, 
  loadCounters, 
  saveCounters, 
  resetQueueData, 
  subscribeToRealTimeQueue, 
  ensureTicketRegistered,
  loadCurrentUser,
  saveCurrentUser,
  clearCurrentUser
} from './utils/storage';
import { Navbar, AppView } from './components/Navbar';
import { KioskView } from './components/KioskView';
import { CounterOfficerWorkspace } from './components/CounterOfficerWorkspace';
import { PublicDisplayBoard } from './components/PublicDisplayBoard';
import { AnalyticsView } from './components/AnalyticsView';
import { MobileStatusTracker } from './components/MobileStatusTracker';
import { AdminView } from './components/AdminView';
import { LoginPage } from './components/LoginPage';
import { ProfileView } from './components/ProfileView';
import { InformationPage } from './components/InformationPage';
import { soundManager } from './utils/audio';
import { MTFRB_LOGO } from './assets/logo';
import { 
  Building2, 
  HelpCircle, 
  ShieldCheck, 
  Sparkles, 
  ExternalLink,
  Volume2
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [previousView, setPreviousView] = useState<AppView>('counter');
  const [isKioskLocked, setIsKioskLocked] = useState<boolean>(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counters, setCounters] = useState<ServiceCounter[]>([]);
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null);
  const [mobileTicketQuery, setMobileTicketQuery] = useState<string>('');
  
  // User Authentication & Officer on Duty state
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => loadCurrentUser());
  const [activeCounterId, setActiveCounterId] = useState<number>(() => {
    const user = loadCurrentUser();
    return user?.assignedCounter || 1;
  });

  // Check URL parameters for direct mobile QR scans
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const ticketParam = params.get('ticket') || params.get('ticketId') || params.get('t');
        if (ticketParam) {
          const cleanNum = ticketParam.trim().toUpperCase();
          setMobileTicketQuery(cleanNum);
          setCurrentView('mobile_tracker');
          setIsKioskLocked(false);

          // If ticket details were provided in QR link, ensure the server has registered it
          const id = params.get('id');
          const name = params.get('name');
          const type = params.get('type') as any;
          const prio = params.get('prio') as any;
          if (cleanNum && (name || id)) {
            ensureTicketRegistered({
              id: id || `t_qr_${cleanNum}`,
              ticketNumber: cleanNum,
              applicantName: name || 'Queue Applicant',
              franchiseType: type || (cleanNum.startsWith('R') ? 'RENEWAL' : 'NEW'),
              priorityLevel: prio || (cleanNum.includes('P') ? 'PRIORITY' : 'REGULAR'),
              priorityReason: (params.get('reason') as any) || undefined,
              franchiseNumber: params.get('frn') || undefined,
              plateOrUnitNumber: params.get('plate') || undefined,
              zone: (params.get('zone') as any) || 'Zone 1',
              classification: (params.get('class') as any) || 'Operator',
              status: 'WAITING',
              createdAt: Date.now(),
              verifiedDocuments: [],
              callCount: 0,
            });
          }
        }
      }
    } catch {}
  }, []);

  // Sync state from storage and listen to real-time SSE stream & cross-tab events
  const syncStateFromStorage = useCallback(() => {
    setTickets(loadTickets());
    setCounters(loadCounters());
  }, []);

  useEffect(() => {
    syncStateFromStorage();

    // 1. Cross-tab synchronization via storage event
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key && e.key.includes('franchise')) {
        syncStateFromStorage();
      }
    };

    const handleCustomEvent = () => {
      syncStateFromStorage();
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('franchise_queue_updated', handleCustomEvent);
    window.addEventListener('mtfrb_tickets_updated', handleCustomEvent);
    window.addEventListener('mtfrb_counters_updated', handleCustomEvent);

    // 2. Real-time server connection (SSE + polling fallback)
    const unsubscribe = subscribeToRealTimeQueue(({ tickets: liveTickets, counters: liveCounters }) => {
      setTickets(liveTickets);
      setCounters(liveCounters);
    });

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('franchise_queue_updated', handleCustomEvent);
      window.removeEventListener('mtfrb_tickets_updated', handleCustomEvent);
      window.removeEventListener('mtfrb_counters_updated', handleCustomEvent);
      unsubscribe();
    };
  }, [syncStateFromStorage]);

  // Handle new ticket created by Kiosk
  const handleTicketGenerated = (newTicket: Ticket) => {
    syncStateFromStorage();
  };

  // Reset queue data to seed
  const handleResetData = () => {
    resetQueueData();
    syncStateFromStorage();
  };

  // Return from Lobby TV Full Screen
  const handleExitDisplay = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setCurrentView(previousView === 'display' ? 'counter' : previousView);
  }, [previousView]);

  // Return from Kiosk Full Screen
  const handleExitKiosk = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setIsKioskLocked(false);
    setCurrentView(previousView === 'kiosk' ? 'counter' : previousView);
  }, [previousView]);

  // Full Screen Control (STRICTLY restricted to Lobby TV Display and Public Kiosk; NEVER for Inspection Station, Counter, Admin, etc.)
  useEffect(() => {
    // If not in display or kiosk mode, ensure fullscreen is exited and never trigger fullscreen on clicks
    if (currentView !== 'display' && currentView !== 'kiosk') {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
      return;
    }

    const triggerFullscreen = () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
            // Ignored if browser requires user gesture
          });
        }
      } catch {}
    };

    // Attempt immediately when view changes to display or kiosk
    triggerFullscreen();

    // Browser security requires a user gesture; go full screen on user interaction for kiosk/display only
    const handleGesture = () => {
      triggerFullscreen();
    };

    window.addEventListener('click', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + F11 opens Lobby TV directly from any view without password
      if (e.ctrlKey && (e.key === 'F11' || e.code === 'F11')) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectView('display');
        return;
      }

      // Ctrl + F12 opens Kiosk directly from any view without password
      if (e.ctrlKey && (e.key === 'F12' || e.code === 'F12')) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectView('kiosk');
        return;
      }

      if (e.key === 'F12' || e.code === 'F12') {
        e.preventDefault();
        if (currentView === 'display') {
          handleExitDisplay();
        } else if (currentView === 'kiosk') {
          handleExitKiosk();
        }
      } else if (e.key === 'Escape' || e.code === 'Escape') {
        if (currentView === 'display' || currentView === 'kiosk') {
          // Explicitly disable Esc to avoid accidental closure of kiosk or lobby display
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentView, handleExitDisplay, handleExitKiosk]);

  // View selection logic: when kiosk is selected, open kiosk directly without password lock
  const handleSelectView = useCallback((view: AppView) => {
    if (view === 'kiosk') {
      if (currentView !== 'display' && currentView !== 'kiosk') {
        setPreviousView(currentView);
      }
      setCurrentView('kiosk');
      setIsKioskLocked(false);
    } else {
      if (currentView !== 'display' && currentView !== 'kiosk') {
        setPreviousView(currentView);
      }
      setCurrentView(view);
    }
  }, [currentView]);

  // Global staff shortcut listener:
  // Ctrl + F11: Launch Lobby TV Display directly without password
  // Ctrl + F12: Launch Citizen Kiosk directly without password
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'F11' || e.code === 'F11')) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectView('display');
      } else if (e.ctrlKey && (e.key === 'F12' || e.code === 'F12')) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectView('kiosk');
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleSelectView]);

  const handleUnlockKiosk = () => {
    setIsKioskLocked(false);
  };

  const handleLockKiosk = () => {
    setIsKioskLocked(true);
  };

  const handleLoginSuccess = (user: UserAccount, targetCounterId?: number) => {
    const assignedCounterId = targetCounterId || user.assignedCounter || 1;
    const userWithAssignedStation: UserAccount = {
      ...user,
      assignedCounter: assignedCounterId,
    };
    setCurrentUser(userWithAssignedStation);
    saveCurrentUser(userWithAssignedStation);
    setActiveCounterId(assignedCounterId);

    // If assigned to a counter, update counter's active officer
    const updated = counters.map(c => 
      c.id === assignedCounterId ? { ...c, officerName: user.fullName } : c
    );
    setCounters(updated);
    saveCounters(updated);

    // Transition directly to Counter Desk
    setCurrentView('counter');
  };

  const handleLogout = () => {
    clearCurrentUser();
    setCurrentUser(null);
    setCurrentView('login');
  };

  const waitingCount = tickets.filter((t) => t.status === 'WAITING').length;

  return (
    <div className={`${currentView === 'display' || currentView === 'kiosk' || currentView === 'login' ? 'h-screen overflow-hidden' : 'min-h-screen'} ${currentView === 'display' || currentView === 'mobile_tracker' || currentView === 'login' ? 'bg-slate-950' : 'bg-slate-100'} text-slate-800 flex flex-col selection:bg-teal-100 selection:text-teal-900`}>
      {/* Top Navigation: Hidden when Lobby TV, Kiosk, Mobile Tracker, or Login is active */}
      {currentView !== 'display' && currentView !== 'kiosk' && currentView !== 'mobile_tracker' && currentView !== 'login' && (
        <Navbar
          currentView={currentView}
          onSelectView={handleSelectView}
          waitingCount={waitingCount}
          isKioskLocked={isKioskLocked}
          onUnlockKiosk={handleUnlockKiosk}
          onLockKiosk={handleLockKiosk}
          currentUser={currentUser}
          onOpenLogin={() => {
            setPreviousView(currentView);
            setCurrentView('login');
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content Area */}
      {currentView === 'login' ? (
        <main className="fixed inset-0 z-50 w-screen h-screen overflow-hidden">
          <LoginPage
            currentUser={currentUser}
            counters={counters}
            onLoginSuccess={handleLoginSuccess}
            onCancel={currentUser ? () => setCurrentView(previousView === 'login' ? 'counter' : previousView) : undefined}
            initialCounterId={currentUser?.assignedCounter || 1}
            onNavigateToView={(view) => {
              if (view === 'kiosk') {
                setIsKioskLocked(true);
              }
              setPreviousView('login');
              setCurrentView(view);
            }}
          />
        </main>
      ) : currentView === 'display' ? (
        <main className="fixed inset-0 z-50 w-screen h-screen h-[100dvh] overflow-hidden bg-slate-950 p-1 sm:p-1.5 md:p-2 lg:p-2.5 animate-in fade-in duration-200 flex flex-col">
          <PublicDisplayBoard
            tickets={tickets}
            counters={counters}
            onExit={handleExitDisplay}
          />
        </main>
      ) : currentView === 'kiosk' ? (
        <main className="fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-slate-950 p-0 sm:p-2 md:p-3 animate-in fade-in duration-200 flex flex-col">
          <KioskView
            tickets={tickets}
            onTicketGenerated={handleTicketGenerated}
            isKioskLocked={isKioskLocked}
            onExit={handleExitKiosk}
          />
        </main>
      ) : currentView === 'mobile_tracker' ? (
        <main className="flex-1 w-full bg-slate-900 animate-in fade-in duration-150">
          <MobileStatusTracker
            tickets={tickets}
            counters={counters}
            initialTicketNumber={
              mobileTicketQuery || 
              (tickets.find(t => t.status === 'CALLING')?.ticketNumber || 
               tickets.find(t => t.status === 'WAITING')?.ticketNumber || 
               (tickets.length > 0 ? tickets[tickets.length - 1].ticketNumber : 'N-101'))
            }
            onClose={() => setCurrentView(previousView === 'kiosk' ? 'kiosk' : 'counter')}
            onSwitchTicket={(ticketNum) => setMobileTicketQuery(ticketNum)}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {currentView === 'counter' && (
            <CounterOfficerWorkspace
              tickets={tickets}
              counters={counters}
              currentUser={currentUser}
              onOpenLoginModal={() => {
                setPreviousView('counter');
                setCurrentView('login');
              }}
              initialCounterId={activeCounterId}
              onTicketsUpdated={(updated) => {
                setTickets(updated);
                saveTickets(updated);
              }}
              onCountersUpdated={(updated) => {
                setCounters(updated);
                saveCounters(updated);
              }}
            />
          )}

          {currentView === 'analytics' && (
            <AnalyticsView
              tickets={tickets}
              counters={counters}
              onReset={handleResetData}
            />
          )}

          {currentView === 'admin' && (
            <AdminView
              currentUser={currentUser}
              counters={counters}
              tickets={tickets}
              onCountersUpdated={(updated) => {
                setCounters(updated);
                saveCounters(updated);
              }}
              onRequireLogin={() => {
                setPreviousView('admin');
                setCurrentView('login');
              }}
              onNavigateToCounter={(counterId) => {
                setActiveCounterId(counterId);
                setPreviousView('admin');
                setCurrentView('counter');
              }}
              onResetQueue={handleResetData}
            />
          )}

          {currentView === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              counters={counters}
              onBack={() => setCurrentView(previousView === 'profile' ? 'counter' : previousView)}
              onRequireLogin={() => {
                setPreviousView('profile');
                setCurrentView('login');
              }}
              onLogout={handleLogout}
              onUserUpdated={(updatedUser) => {
                setCurrentUser(updatedUser);
                saveCurrentUser(updatedUser);
              }}
            />
          )}

          {currentView === 'information' && (
            <InformationPage
              currentUser={currentUser}
              onRequireLogin={() => {
                setPreviousView('information');
                setCurrentView('login');
              }}
              onNavigateToCounter={(counterId) => {
                setActiveCounterId(counterId);
                setPreviousView('information');
                setCurrentView('counter');
              }}
            />
          )}
        </main>
      )}

      {/* Footer: Hidden when Lobby TV, Kiosk, Mobile Tracker, or Login is active */}
      {currentView !== 'display' && currentView !== 'kiosk' && currentView !== 'mobile_tracker' && currentView !== 'login' && (
        <footer className="mt-auto py-6 border-t border-slate-200 bg-white text-xs text-slate-500 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img 
                src={MTFRB_LOGO} 
                alt="MTFRB Seal" 
                className="w-6 h-6 rounded-full object-cover border border-amber-400" 
              />
              <span className="font-bold text-slate-800">
                MTFRB CASTILLEJOS | PORTAL
              </span>
              <span>•</span>
              <span>Municipal Tricycle Franchising & Regulatory Board</span>
            </div>

            <div className="flex items-center gap-4 text-slate-500">
              <span className="text-[11px]">
                Active Terminal Sync
              </span>
              <button
                onClick={() => {
                  soundManager.playChime();
                }}
                className="text-teal-700 hover:text-teal-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio Chime Active</span>
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
