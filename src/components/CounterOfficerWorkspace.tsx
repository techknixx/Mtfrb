import React, { useState, useEffect, useMemo } from 'react';
import { 
  Ticket, 
  ServiceCounter, 
  getDocumentsForType,
  getFranchiseTypeLabel,
  UserAccount,
  TricycleFranchiseRecord,
  TricycleInspectionChecklist,
  createDefaultInspectionChecklist
} from '../types';
import { 
  loadTickets,
  loadCounters,
  saveTickets, 
  saveCounters, 
  saveQueueState,
  calculateWaitEstimates, 
  getFranchiseRecordByBodyNumber, 
  loadFranchiseRecords, 
  callTicketOnServer, 
  getInspectionChecklist,
  saveInspectionChecklist,
  isBodyNumberInspectionPassed
} from '../utils/storage';
import { soundManager } from '../utils/audio';
import { TicketSlipModal } from './TicketSlipModal';
import { FranchiseRecordModal } from './FranchiseRecordModal';
import { InspectionChecklistSection } from './InspectionChecklistSection';
import { PaymentStationSection } from './PaymentStationSection';
import { PhysicalInspectionDataModal } from './PhysicalInspectionDataModal';
import { MTFRB_LOGO } from '../assets/logo';
import { WaitingQueueSection } from './WaitingQueueSection';
import { 
  Volume2, 
  CheckCircle, 
  UserX, 
  ArrowRightCircle, 
  RotateCcw, 
  Clock, 
  User, 
  FileText, 
  Car, 
  Phone, 
  Mail,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Check,
  Printer,
  ArrowRightLeft,
  Send,
  X,
  UserCheck,
  LogIn,
  Monitor,
  ClipboardCheck,
  Receipt,
  Stamp,
  Wrench,
  Eye,
  Edit3,
  TabletSmartphone,
  Smartphone,
  ShieldAlert,
  Motorbike
} from 'lucide-react';

interface CounterOfficerWorkspaceProps {
  tickets: Ticket[];
  counters: ServiceCounter[];
  onTicketsUpdated: (tickets: Ticket[]) => void;
  onCountersUpdated: (counters: ServiceCounter[]) => void;
  currentUser?: UserAccount | null;
  onOpenLoginModal?: () => void;
  initialCounterId?: number;
}

export const CounterOfficerWorkspace: React.FC<CounterOfficerWorkspaceProps> = ({
  tickets,
  counters,
  onTicketsUpdated,
  onCountersUpdated,
  currentUser,
  onOpenLoginModal,
  initialCounterId = 1,
}) => {
  // Selected counter id
  const [selectedCounterId, setSelectedCounterId] = useState<number>(initialCounterId);

  useEffect(() => {
    if (initialCounterId) {
      setSelectedCounterId(initialCounterId);
    }
  }, [initialCounterId]);

  const activeCounter = counters.find((c) => c.id === selectedCounterId) || counters[0];

  // Officer internal notes
  const [officerNotes, setOfficerNotes] = useState<string>('');

  // Active service timer
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Ticket to reprint / view QR slip modal
  const [reprintTicket, setReprintTicket] = useState<Ticket | null>(null);

  // Ticket transfer modal state (for current ticket or any waiting ticket)
  const [transferModalTicket, setTransferModalTicket] = useState<Ticket | null>(null);
  const [transferDestination, setTransferDestination] = useState<number>(4);
  const [transferRemarks, setTransferRemarks] = useState<string>('');

  // Find currently assigned ticket to this counter
  const currentTicket = tickets.find((t) => t.id === activeCounter.currentTicketId && (t.status === 'CALLING' || t.status === 'SERVING'));

  // Franchise Information & Records Database Linkage
  const [viewingFranchiseRecord, setViewingFranchiseRecord] = useState<TricycleFranchiseRecord | null>(null);
  const [viewingInspectionBody, setViewingInspectionBody] = useState<string | null>(null);
  const [inspectingBody, setInspectingBody] = useState<string | null>(null);
  const [franchiseDbVersion, setFranchiseDbVersion] = useState<number>(0);

  // Listen for database changes from other tabs/modals
  useEffect(() => {
    const handleDbUpdate = () => {
      setFranchiseDbVersion((v) => v + 1);
    };
    window.addEventListener('mtfrb_franchise_registry_updated', handleDbUpdate);
    return () => window.removeEventListener('mtfrb_franchise_registry_updated', handleDbUpdate);
  }, []);

  // Verification station allows editing records to verify physical documents and correct typos
  const isVerificationStation = Boolean(
    activeCounter && (activeCounter.id === 2 || activeCounter.name.toLowerCase().includes('verification'))
  );

  // Inspection station replaces the generic checklist with the official MTFRB Physical Inspection Checklist
  const isInspectionStation = Boolean(
    activeCounter && (activeCounter.id === 3 || activeCounter.name.toLowerCase().includes('inspection'))
  );

  // Payment station replaces requirements checklist with fee collection & OR receipting
  const isPaymentStation = Boolean(
    activeCounter && (activeCounter.id === 4 || activeCounter.name.toLowerCase().includes('payment'))
  );

  // Device check: Inspection Station is ONLY available on tablets & smartphones (Requirement 2 & 3)
  const [isTabletOrMobile, setIsTabletOrMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const isNarrow = window.innerWidth < 1024;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return Boolean(hasTouch || isNarrow || isMobileUA);
  });

  useEffect(() => {
    const handleResize = () => {
      const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      const isNarrow = window.innerWidth < 1024;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsTabletOrMobile(Boolean(hasTouch || isNarrow || isMobileUA));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Quick Queue drawer for mobile/tablet first inspection view
  const [mobileQueueOpen, setMobileQueueOpen] = useState<boolean>(false);

  // Checklist view mode: defaults to INSPECTION for Inspection Station, DOCUMENTS for others
  const [checklistTab, setChecklistTab] = useState<'INSPECTION' | 'DOCUMENTS'>(() =>
    isInspectionStation ? 'INSPECTION' : 'DOCUMENTS'
  );

  // Synchronize default checklist tab when counter changes
  useEffect(() => {
    if (isInspectionStation) {
      setChecklistTab('INSPECTION');
    } else {
      setChecklistTab('DOCUMENTS');
    }
  }, [isInspectionStation, selectedCounterId]);

  // Standalone inspection on idle inspection desk (for walk-in units or direct physical inspections)
  const [showIdleInspection, setShowIdleInspection] = useState<boolean>(false);
  const [idleInspectionBody, setIdleInspectionBody] = useState<string>('');

  // Auto-transfer feedback notification
  const [autoTransferNotice, setAutoTransferNotice] = useState<{
    ticketNumber: string;
    applicantName: string;
    fromCounter: string;
    toCounter: string;
  } | null>(null);

  // Check if active counter is Releasing (Station 8)
  const isReleasingCounter = 
    activeCounter.id === 8 || 
    activeCounter.name.toLowerCase().includes('releas');

  // Determine the next sequential counter in the pipeline
  const activeCounterIndex = counters.findIndex((c) => c.id === activeCounter.id);
  const nextCounter = 
    !isReleasingCounter && activeCounterIndex >= 0 && activeCounterIndex < counters.length - 1
      ? counters[activeCounterIndex + 1]
      : !isReleasingCounter
      ? (counters.find((c) => c.id === activeCounter.id + 1) || null)
      : null;

  // Dedicated MTFRB pipeline routing:
  // Counter 3 (Inspection) always transfers to Counter 4 (Payment).
  // All other non-releasing counters transfer to the sequential nextCounter.
  const paymentCounter = counters.find((c) => c.id === 4 || c.name.toLowerCase().includes('payment')) || counters[3] || { id: 4, name: 'Payment' };
  const targetCounter = (isInspectionStation || activeCounter.id === 3) ? paymentCounter : nextCounter;

  // Match current applicant's body number / ticket number with Information & Records Database
  const matchingFranchiseRecord = useMemo(() => {
    if (!currentTicket) return null;
    const candidateBody = (currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || '').trim();
    if (candidateBody) {
      const rec = getFranchiseRecordByBodyNumber(candidateBody);
      if (rec) return rec;
    }
    // Also check numeric part of ticketNumber e.g. "042" or "118"
    const numericTicket = currentTicket.ticketNumber.replace(/^[A-Z]+-?/i, '').trim();
    if (numericTicket) {
      const recByNumeric = getFranchiseRecordByBodyNumber(numericTicket);
      if (recByNumeric) return recByNumeric;
    }
    const recByTicket = getFranchiseRecordByBodyNumber(currentTicket.ticketNumber);
    if (recByTicket) return recByTicket;

    return null;
  }, [
    currentTicket?.id,
    currentTicket?.bodyNumber,
    currentTicket?.plateOrUnitNumber,
    currentTicket?.ticketNumber,
    franchiseDbVersion,
  ]);

  // Check physical inspection status for the active applicant (Requirement 4)
  // User Requirement 1: If not in the records, do NOT show inspection data passed!
  const activeApplicantInspection = useMemo(() => {
    if (!currentTicket) return null;
    const candidateBody = (currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || matchingFranchiseRecord?.bodyNumber || '').trim();
    if (!candidateBody) return null;

    // If unit is NOT found in the official franchise records, it cannot be passed
    if (!matchingFranchiseRecord) {
      return {
        ...createDefaultInspectionChecklist(candidateBody, 'Carmela Dizon', 'FAILED'),
        status: 'FAILED' as const,
        remarks: 'Unit not found in official MTFRB Franchise Registry records. Cannot pass inspection.'
      };
    }

    return getInspectionChecklist(candidateBody);
  }, [
    currentTicket?.id,
    currentTicket?.bodyNumber,
    currentTicket?.plateOrUnitNumber,
    matchingFranchiseRecord,
    franchiseDbVersion,
  ]);

  // Releasing completion email dispatch states
  const [releasingEmailNotice, setReleasingEmailNotice] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [releasingGlobalNotice, setReleasingGlobalNotice] = useState<string | null>(null);
  const [overrideEmail, setOverrideEmail] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // Sync officer notes and email when current ticket changes
  useEffect(() => {
    if (currentTicket) {
      setOfficerNotes(currentTicket.notes || '');
      const existingEmail = (currentTicket.email || currentTicket.emailAddress || matchingFranchiseRecord?.emailAddress || matchingFranchiseRecord?.email || '').trim();
      setOverrideEmail(existingEmail);
    } else {
      setOfficerNotes('');
      setOverrideEmail('');
    }
  }, [currentTicket?.id, matchingFranchiseRecord?.emailAddress]);

  // Dispatch completion email with official certificate attachment
  const sendReleasingCompletionEmail = async (ticket: Ticket, emailToSend: string) => {
    if (!emailToSend || !emailToSend.includes('@')) return false;
    setIsSendingEmail(true);
    try {
      const cleanBody = (ticket.bodyNumber || ticket.plateOrUnitNumber || matchingFranchiseRecord?.bodyNumber || ticket.ticketNumber).replace(/^#+/, '').trim().toUpperCase();
      const res = await fetch('/api/releasing/send-completion-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: emailToSend.trim(),
          ticketNumber: ticket.ticketNumber,
          applicantName: ticket.applicantName,
          bodyNumber: cleanBody,
          franchiseNumber: ticket.franchiseNumber || matchingFranchiseRecord?.permitNumber,
          permitNumber: matchingFranchiseRecord?.permitNumber || `MTFRB-2026-${cleanBody}`,
          franchiseType: ticket.franchiseType,
          plateNumber: matchingFranchiseRecord?.plateNumber,
          motorNumber: matchingFranchiseRecord?.motorNumber,
          chassisNumber: matchingFranchiseRecord?.chassisNumber,
          zone: ticket.zone || matchingFranchiseRecord?.routeZone,
          todaName: matchingFranchiseRecord?.todaName,
          validUntil: matchingFranchiseRecord?.validUntil,
          releasingOfficer: currentUser?.fullName || activeCounter.officerName || 'Releasing Officer',
        }),
      });
      const data = await res.json();
      setIsSendingEmail(false);
      if (data.success) {
        const msg = `Official Certificate and release completion notification successfully sent to ${emailToSend.trim()}.`;
        setReleasingEmailNotice({ success: true, message: msg });
        setReleasingGlobalNotice(msg);
        setTimeout(() => setReleasingEmailNotice(null), 10000);
        setTimeout(() => setReleasingGlobalNotice(null), 10000);
        return true;
      } else {
        const err = data.error || 'Failed to dispatch email.';
        setReleasingEmailNotice({ success: false, message: err });
        return false;
      }
    } catch (err: any) {
      setIsSendingEmail(false);
      setReleasingEmailNotice({
        success: false,
        message: err.message || 'Error communicating with email service.',
      });
      return false;
    }
  };

  // Service timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTicket && currentTicket.status === 'SERVING') {
      const startTime = currentTicket.servedAt || Date.now();
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [currentTicket?.id, currentTicket?.status]);

  // Strictly filter queue for this counter: only applicants assigned to this counter appear here.
  // Other counters must NOT view clients that are not assigned to them.
  const waitingTickets = tickets
    .filter((t) => t.status === 'WAITING')
    .filter((t) => {
      const assigned = Number(t.assignedCounter || 1);
      return assigned === Number(activeCounter.id);
    })
    .sort((a, b) => {
      // Priority first, then oldest
      if (a.priorityLevel === 'PRIORITY' && b.priorityLevel !== 'PRIORITY') return -1;
      if (b.priorityLevel === 'PRIORITY' && a.priorityLevel !== 'PRIORITY') return 1;
      return a.createdAt - b.createdAt;
    });

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Call next ticket in line (handles desk-specific queue and fallback to general queue)
  const handleCallNext = async (ticketToCall?: Ticket) => {
    // 1. First priority: ticket passed explicitly, or first in this counter's waiting queue
    let target = ticketToCall || waitingTickets[0];

    // 2. If no ticket explicitly routed to this desk yet, pull next waiting applicant from general waiting queue
    if (!target) {
      const anyWaiting = tickets
        .filter((t) => t.status === 'WAITING')
        .sort((a, b) => {
          if (a.priorityLevel === 'PRIORITY' && b.priorityLevel !== 'PRIORITY') return -1;
          if (b.priorityLevel === 'PRIORITY' && a.priorityLevel !== 'PRIORITY') return 1;
          return a.createdAt - b.createdAt;
        });
      target = anyWaiting[0];
    }

    if (!target) {
      alert('There are currently no waiting applicants in the queue.');
      return;
    }

    const now = Date.now();
    const updatedTickets = tickets.map((t) => {
      // If there was an active ticket at this counter, finalize it so it does not remain hanging
      if (currentTicket && t.id === currentTicket.id && t.id !== target.id) {
        return {
          ...t,
          status: 'COMPLETED' as const,
          completedAt: now,
        };
      }
      if (t.id === target.id) {
        return {
          ...t,
          status: 'SERVING' as const,
          calledAt: now,
          servedAt: now,
          assignedCounter: activeCounter.id,
          assignedOfficer: activeCounter.officerName,
          callCount: (t.callCount || 0) + 1,
        };
      }
      return t;
    });

    const updatedCounters = counters.map((c) => {
      if (c.id === activeCounter.id) {
        return { ...c, currentTicketId: target.id, status: 'BUSY' as const };
      }
      return c;
    });

    // Save atomically so both tickets and counters update together without race conditions
    saveQueueState(updatedTickets, updatedCounters);
    onTicketsUpdated(updatedTickets);
    onCountersUpdated(updatedCounters);

    // Broadcast announcement to server (Lobby TVs and other PCs will announce)
    callTicketOnServer({
      ticketId: target.id,
      ticketNumber: target.ticketNumber,
      bodyNumber: target.bodyNumber || target.plateOrUnitNumber,
      counterId: activeCounter.id,
      counterName: activeCounter.name,
      officerName: activeCounter.officerName,
      serviceType: target.franchiseType === 'NEW' ? 'New Franchise' : 'Franchise Renewal',
    }).catch((err) => console.error('Error broadcasting call ticket:', err));

    // Audio chime and voice announcement locally (safely guarded)
    try {
      soundManager.unlockAudio();
      await soundManager.playCallingAlert(
        target.ticketNumber,
        activeCounter.name,
        target.franchiseType === 'NEW' ? 'New Franchise' : 'Franchise Renewal',
        target.bodyNumber || target.plateOrUnitNumber
      );
    } catch (soundErr) {
      console.warn('Audio call announcement note:', soundErr);
    }
  };

  // Recall current ticket
  const handleRecall = async () => {
    if (!currentTicket) return;

    const updatedTickets = tickets.map((t) => {
      if (t.id === currentTicket.id) {
        return {
          ...t,
          status: 'SERVING' as const,
          calledAt: Date.now(),
          callCount: (t.callCount || 0) + 1,
        };
      }
      return t;
    });

    saveTickets(updatedTickets);
    onTicketsUpdated(updatedTickets);

    // Broadcast recall announcement to server for Lobby TV & connected stations
    callTicketOnServer({
      ticketId: currentTicket.id,
      ticketNumber: currentTicket.ticketNumber,
      bodyNumber: currentTicket.bodyNumber || currentTicket.plateOrUnitNumber,
      counterId: activeCounter.id,
      counterName: activeCounter.name,
      officerName: activeCounter.officerName,
      serviceType: currentTicket.franchiseType === 'NEW' ? 'New Franchise' : 'Franchise Renewal',
    }).catch((err) => console.error('Error broadcasting recall ticket:', err));

    await soundManager.playCallingAlert(
      currentTicket.ticketNumber,
      activeCounter.name,
      currentTicket.franchiseType === 'NEW' ? 'New Franchise' : 'Franchise Renewal',
      currentTicket.bodyNumber || currentTicket.plateOrUnitNumber
    );
  };

  // Toggle verified document checklist item
  const handleToggleDocument = (docId: string) => {
    if (!currentTicket) return;

    const currentDocs = currentTicket.verifiedDocuments || [];
    const newDocs = currentDocs.includes(docId)
      ? currentDocs.filter((id) => id !== docId)
      : [...currentDocs, docId];

    const updatedTickets = tickets.map((t) => {
      if (t.id === currentTicket.id) {
        return { ...t, verifiedDocuments: newDocs };
      }
      return t;
    });

    saveTickets(updatedTickets);
    onTicketsUpdated(updatedTickets);
  };

  // Select all documents
  const handleSelectAllDocuments = () => {
    if (!currentTicket) return;
    const allDocs = getDocumentsForType(currentTicket.franchiseType).map((d) => d.id);
    
    const updatedTickets = tickets.map((t) => {
      if (t.id === currentTicket.id) {
        return { ...t, verifiedDocuments: allDocs };
      }
      return t;
    });

    saveTickets(updatedTickets);
    onTicketsUpdated(updatedTickets);
  };

  // Complete ticket (Automatically transfers to next sequential counter except Releasing)
  const handleCompleteTicket = () => {
    if (!currentTicket) return;

    const bodyNum = (currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || matchingFranchiseRecord?.bodyNumber || '').trim();

    // 1. When clicking complete on inspection, ALWAYS save the information to the database
    let isPassed = currentTicket.inspectionPassed;
    let savedChecklist: TricycleInspectionChecklist | null = null;

    if (isInspectionStation || activeCounter.id === 3) {
      const cleanBody = (bodyNum || currentTicket.ticketNumber).replace(/^#+/, '').trim();
      const existingSheet = getInspectionChecklist(cleanBody);

      // Certify vehicle as roadworthy PASSED and compliant upon toggle complete
      const compliantDefaults = createDefaultInspectionChecklist(cleanBody, activeCounter.officerName || 'Carmela Dizon', 'PASSED');

      const certifiedChecklist: TricycleInspectionChecklist = {
        ...compliantDefaults,
        ...existingSheet,
        bodyNumber: cleanBody,
        inspectorName: existingSheet.inspectorName || activeCounter.officerName || 'Carmela Dizon',
        inspectionDate: existingSheet.inspectionDate || new Date().toISOString().slice(0, 10),
        status: 'PASSED',
        verifiedAt: Date.now(),
        remarks: existingSheet.remarks && !existingSheet.remarks.includes('not found') && !existingSheet.remarks.includes('not passed')
          ? existingSheet.remarks
          : 'Officially completed at MTFRB Physical Inspection Station and roadworthy certified.',
        operatorName: currentTicket.applicantName || matchingFranchiseRecord?.operatorName || existingSheet.operatorName,
        driverName: currentTicket.driverName || matchingFranchiseRecord?.driverName || existingSheet.driverName,
        plateNumber: currentTicket.plateOrUnitNumber || matchingFranchiseRecord?.plateNumber || existingSheet.plateNumber,
        makeModel: matchingFranchiseRecord?.makeModel || existingSheet.makeModel,
        motorNumber: matchingFranchiseRecord?.motorNumber || existingSheet.motorNumber,
        chassisNumber: matchingFranchiseRecord?.chassisNumber || existingSheet.chassisNumber,
      };

      // Always save to database (localStorage + disk via /api/inspections/:bodyNumber and update franchise registry)
      saveInspectionChecklist(certifiedChecklist);
      savedChecklist = certifiedChecklist;
      isPassed = true;
    } else if (activeCounter.id > 3) {
      // Requirement: Client cannot be cleared or completed if not passed by inspection
      const sheet = bodyNum ? getInspectionChecklist(bodyNum) : null;
      const isAlreadyPassed = 
        currentTicket.inspectionPassed === true || 
        currentTicket.inspectionChecklist?.status === 'PASSED' || 
        (sheet && sheet.status === 'PASSED');

      if (!isAlreadyPassed) {
        alert(
          `Cannot Complete Transaction: Client Body #${bodyNum || currentTicket.ticketNumber || 'N/A'} has NOT passed the MTFRB Physical Inspection.\n\n` +
          `Current Inspection Status: ${sheet?.status || 'PENDING'}\n\n` +
          `Policy Enforcement: Under MTFRB Ordinance, an applicant cannot be cleared or have their transaction completed if they have not passed the physical vehicle inspection. Please ensure the vehicle is inspected and certified PASSED at Counter 3 (Inspection Station) before completing.`
        );
        return;
      }
      isPassed = true;
      savedChecklist = sheet || currentTicket.inspectionChecklist || null;
    } else {
      const sheet = bodyNum ? getInspectionChecklist(bodyNum) : null;
      if (sheet) {
        isPassed = sheet.status === 'PASSED';
        savedChecklist = sheet;
      }
    }

    // Auto-Transfer for all counters EXCEPT Releasing
    if (!isReleasingCounter && targetCounter) {
      const transferRecord = `[Completed at ${activeCounter.name} ➔ Automatically transferred to ${targetCounter.name}]`;
      const combinedNotes = officerNotes.trim()
        ? (currentTicket.notes ? `${currentTicket.notes} | ${officerNotes.trim()} | ${transferRecord}` : `${officerNotes.trim()} | ${transferRecord}`)
        : (currentTicket.notes ? `${currentTicket.notes} | ${transferRecord}` : transferRecord);

      const updatedTickets = tickets.map((t) => {
        if (t.id === currentTicket.id) {
          return {
            ...t,
            status: 'WAITING' as const,
            assignedCounter: targetCounter.id,
            calledAt: undefined,
            servedAt: undefined,
            notes: combinedNotes,
            inspectionPassed: isPassed,
            inspectionDate: savedChecklist?.inspectionDate || t.inspectionDate,
            inspectorName: savedChecklist?.inspectorName || t.inspectorName,
            inspectionChecklist: savedChecklist || t.inspectionChecklist,
          };
        }
        return t;
      });

      const updatedCounters = counters.map((c) => {
        if (c.id === activeCounter.id) {
          return { ...c, currentTicketId: null, status: 'OPEN' as const };
        }
        return c;
      });

      saveQueueState(updatedTickets, updatedCounters);
      onTicketsUpdated(updatedTickets);
      onCountersUpdated(updatedCounters);

      setAutoTransferNotice({
        ticketNumber: currentTicket.ticketNumber,
        applicantName: currentTicket.applicantName,
        fromCounter: activeCounter.name,
        toCounter: targetCounter.name,
      });
      setTimeout(() => setAutoTransferNotice(null), 6000);

      soundManager.playTransferChime(currentTicket.ticketNumber, targetCounter.name, activeCounter.name);
      setOfficerNotes('');
      return;
    }

    // Final Counter (Releasing): Finalizes the whole ticket as COMPLETED
    if (isReleasingCounter) {
      const emailToSend = (overrideEmail || currentTicket.email || currentTicket.emailAddress || matchingFranchiseRecord?.emailAddress || matchingFranchiseRecord?.email || '').trim();
      if (emailToSend && emailToSend.includes('@')) {
        sendReleasingCompletionEmail(currentTicket, emailToSend);
      }
    }

    const finalNote = officerNotes.trim()
      ? (currentTicket.notes ? `${currentTicket.notes} | ${officerNotes.trim()}` : officerNotes.trim())
      : currentTicket.notes;

    const updatedTickets = tickets.map((t) => {
      if (t.id === currentTicket.id) {
        return {
          ...t,
          status: 'COMPLETED' as const,
          completedAt: Date.now(),
          notes: finalNote,
          inspectionPassed: isPassed,
          inspectionDate: savedChecklist?.inspectionDate || t.inspectionDate,
          inspectorName: savedChecklist?.inspectorName || t.inspectorName,
          inspectionChecklist: savedChecklist || t.inspectionChecklist,
        };
      }
      return t;
    });

    const updatedCounters = counters.map((c) => {
      if (c.id === activeCounter.id) {
        return { ...c, currentTicketId: null, status: 'OPEN' as const };
      }
      return c;
    });

    saveQueueState(updatedTickets, updatedCounters);
    onTicketsUpdated(updatedTickets);
    onCountersUpdated(updatedCounters);
    soundManager.playSuccess();
    setOfficerNotes('');
  };

  // Mark No-Show
  const handleMarkNoShow = () => {
    if (!currentTicket) return;

    const updatedTickets = tickets.map((t) => {
      if (t.id === currentTicket.id) {
        return {
          ...t,
          status: 'NO_SHOW' as const,
          completedAt: Date.now(),
          notes: officerNotes.trim() || 'No-show after calling.',
        };
      }
      return t;
    });

    const updatedCounters = counters.map((c) => {
      if (c.id === activeCounter.id) {
        return { ...c, currentTicketId: null, status: 'OPEN' as const };
      }
      return c;
    });

    saveQueueState(updatedTickets, updatedCounters);
    onTicketsUpdated(updatedTickets);
    onCountersUpdated(updatedCounters);
    setOfficerNotes('');
  };

  // Transfer any ticket (active or in-queue) to any counter
  const handleTransferTicket = (
    ticketToTransfer: Ticket, 
    targetCounterId: number, 
    remarkText?: string
  ) => {
    const targetCounter = counters.find(c => c.id === targetCounterId);
    const targetName = targetCounter?.name || `Station ${targetCounterId}`;

    const updatedTickets = tickets.map((t) => {
      if (t.id === ticketToTransfer.id) {
        const transferNote = remarkText?.trim()
          ? `[Transferred from ${activeCounter.name} to ${targetName}: ${remarkText.trim()}]`
          : `[Transferred from ${activeCounter.name} to ${targetName}]`;
        const existingNotes = t.notes ? `${t.notes} | ${transferNote}` : transferNote;

        return {
          ...t,
          status: 'WAITING' as const,
          assignedCounter: targetCounterId,
          calledAt: undefined,
          servedAt: undefined,
          notes: existingNotes,
        };
      }
      return t;
    });

    // If the transferred ticket was currently being served at this counter, free up this counter
    const updatedCounters = counters.map((c) => {
      if (c.id === activeCounter.id && c.currentTicketId === ticketToTransfer.id) {
        return { ...c, currentTicketId: null, status: 'OPEN' as const };
      }
      return c;
    });

    saveTickets(updatedTickets);
    saveCounters(updatedCounters);
    onTicketsUpdated(updatedTickets);
    onCountersUpdated(updatedCounters);

    setAutoTransferNotice({
      ticketNumber: ticketToTransfer.ticketNumber,
      applicantName: ticketToTransfer.applicantName,
      fromCounter: activeCounter.name,
      toCounter: targetName,
    });
    setTimeout(() => setAutoTransferNotice(null), 6000);

    soundManager.playTransferChime(ticketToTransfer.ticketNumber, targetName, activeCounter.name);

    if (currentTicket && currentTicket.id === ticketToTransfer.id) {
      setOfficerNotes('');
    }
    setTransferModalTicket(null);
    setTransferRemarks('');
  };

  const checklistDocs = currentTicket
    ? getDocumentsForType(currentTicket.franchiseType)
    : [];

  const verifiedCount = currentTicket?.verifiedDocuments?.length || 0;
  const mandatoryCount = checklistDocs.filter((d) => d.mandatory).length;

  // Station-specific icon mapping (User Request 4)
  const getStationIcon = (counter: ServiceCounter) => {
    const name = (counter.name || '').toLowerCase();
    if (name.includes('cashier') || name.includes('payment') || name.includes('fee') || counter.id === 3) {
      return <Receipt className="w-6 h-6 text-emerald-600" />;
    }
    if (name.includes('releas') || name.includes('id') || name.includes('plate') || name.includes('sticker') || counter.id === 4) {
      return <Stamp className="w-6 h-6 text-indigo-600" />;
    }
    if (name.includes('inspect') || name.includes('safety') || name.includes('motor') || counter.id === 2) {
      return <Wrench className="w-6 h-6 text-amber-600" />;
    }
    if (name.includes('assess') || name.includes('eval') || name.includes('desk') || counter.id === 1) {
      return <ClipboardCheck className="w-6 h-6 text-teal-600" />;
    }
    return <Monitor className="w-6 h-6 text-teal-600" />;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Station Selector & Officer Status Banner - Uniform Admin/Profile Gradient Style */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl text-white p-6 sm:p-8 shadow-lg border border-teal-800/60 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-teal-800/80 border-2 border-amber-400/80 text-amber-300 flex items-center justify-center shrink-0 shadow-md transition-transform" 
            title={`${activeCounter.name} Station Terminal Icon`}
          >
            {getStationIcon(activeCounter)}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900">
                Counter Console
              </span>
              <span className="text-xs text-teal-200 font-semibold">
                MTFRB CASTILLEJOS | STATION TERMINAL
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 text-white">
                {activeCounter.name} Station
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                ● Active
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-teal-100">
              <span>Officer on Duty:</span>
              <span className="font-bold text-slate-950 bg-amber-300 px-2.5 py-0.5 rounded-md shadow-xs">
                {activeCounter.officerName}
              </span>

              {/* Take over counter button if logged-in user differs */}
              {currentUser && currentUser.fullName !== activeCounter.officerName && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = counters.map(c => c.id === activeCounter.id ? { ...c, officerName: currentUser.fullName } : c);
                    saveCounters(updated);
                    onCountersUpdated(updated);
                  }}
                  className="text-[11px] font-bold text-teal-900 bg-teal-200 hover:bg-teal-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer shadow-xs"
                  title="Assign yourself as the active officer on duty at this counter"
                >
                  Take Over as {currentUser.fullName}
                </button>
              )}

              {/* Change Officer Button */}
              {onOpenLoginModal && (
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="text-[11px] font-bold text-white hover:text-amber-300 bg-teal-800/80 hover:bg-teal-700/80 border border-teal-600/50 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  title="Switch or login a different officer on duty"
                >
                  <UserCheck className="w-3 h-3 text-amber-400" />
                  <span>Change Officer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Counter Station Switcher & Status Tag */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 w-full md:w-auto">
          {currentUser?.role === 'ADMIN' ? (
            <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-teal-700/50 shadow-inner">
              <span className="text-[11px] font-bold text-teal-200 uppercase tracking-wide flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5 text-amber-400" />
                <span>Switch:</span>
              </span>
              <select
                value={selectedCounterId}
                onChange={(e) => setSelectedCounterId(Number(e.target.value))}
                className="px-2.5 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-2xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden cursor-pointer"
              >
                {counters.map((c) => {
                  const isInspect = c.id === 3 || c.name.toLowerCase().includes('inspection');
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} {isInspect ? '📱 (Tablets & Smartphones Only)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/60 border border-teal-700/50 rounded-xl text-xs font-bold text-teal-100">
              <Monitor className="w-3.5 h-3.5 text-amber-400" />
              <span>Assigned Desk: {activeCounter.name}</span>
            </div>
          )}
          <div className="px-3.5 py-2 bg-amber-400 text-slate-950 rounded-xl text-right shadow-md">
            <span className="text-[10px] uppercase font-black tracking-wider block text-slate-800">Operational Desk</span>
            <span className="text-xs font-black">
              {activeCounter.name} Station
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INSPECTION STATION & COUNTER WORKSPACE (Camera Always Available When Needed) */}
      {/* ========================================================================= */}
      {/* Main Grid: Mobile/Tablet First layout when Inspection Station, or Standard Desktop 3-column layout */}
      <div className={isInspectionStation ? 'space-y-6 max-w-5xl mx-auto w-full' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
        {/* Mobile/Tablet Quick Queue Drawer or Left Column */}
        {isInspectionStation ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-900 rounded-lg">
                <TabletSmartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span>MTFRB Field Inspection Station (Tablet / Mobile First)</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Camera Ready
                  </span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Outdoor lane inspection • Live 4-angle camera capture available • Queue: {waitingTickets.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileQueueOpen(!mobileQueueOpen)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {mobileQueueOpen ? 'Hide Waiting Queue' : `View Waiting Queue (${waitingTickets.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => handleCallNext()}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-black text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Call next waiting applicant"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Call Next</span>
                </button>
              </div>

              {/* Collapsible Mobile Queue Section for Inspection Station */}
              {mobileQueueOpen && (
                <div className="w-full pt-3 mt-2 border-t border-slate-200 animate-in fade-in">
                  <WaitingQueueSection
                    waitingTickets={waitingTickets}
                    activeCounter={activeCounter}
                    counters={counters}
                    onCallNext={handleCallNext}
                    onOpenTransferModal={(ticket) => {
                      setTransferModalTicket(ticket);
                      setTransferDestination(counters.find((c) => c.id !== activeCounter.id)?.id || 4);
                      setTransferRemarks('');
                    }}
                    onViewFranchiseRecord={(record) => setViewingFranchiseRecord(record)}
                    onViewInspectionData={(bodyNumber) => setViewingInspectionBody(bodyNumber)}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Left Column: Waiting Queue List on normal desk stations */
            <div className="w-full lg:col-span-1">
              <WaitingQueueSection
                waitingTickets={waitingTickets}
                activeCounter={activeCounter}
                counters={counters}
                onCallNext={handleCallNext}
                onOpenTransferModal={(ticket) => {
                  setTransferModalTicket(ticket);
                  setTransferDestination(counters.find((c) => c.id !== activeCounter.id)?.id || 4);
                  setTransferRemarks('');
                }}
                onViewFranchiseRecord={(record) => setViewingFranchiseRecord(record)}
                onViewInspectionData={(bodyNumber) => setViewingInspectionBody(bodyNumber)}
              />
            </div>
          )}

          {/* Right Column / Primary Workspace */}
          <div className={isInspectionStation ? 'space-y-6' : 'lg:col-span-2 space-y-6'}>
            {/* Automatic Counter Transfer Notification Banner */}
            {autoTransferNotice && (
              <div 
                id="auto-transfer-notice-banner"
                className="bg-emerald-700 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 border border-emerald-600"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-800 text-emerald-100 shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-white">
                      Auto-Transferred to Next Counter
                    </div>
                    <div className="text-emerald-100 text-[11px] mt-0.5">
                      Ticket <strong className="text-white font-mono">{autoTransferNotice.ticketNumber}</strong> ({autoTransferNotice.applicantName}) completed at {autoTransferNotice.fromCounter} and moved to <strong className="text-amber-300 underline">{autoTransferNotice.toCounter}</strong>.
                    </div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setAutoTransferNotice(null)} 
                  className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-800 cursor-pointer"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Releasing Certificate & Email Sent Notification Banner */}
            {releasingGlobalNotice && (
              <div 
                id="releasing-email-notice-banner"
                className="bg-teal-850 bg-teal-800 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 border border-teal-500"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-teal-900 text-amber-300 shrink-0 border border-teal-600">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-white flex items-center gap-2">
                      <span>Official Certificate Emailed to Client</span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">Sent</span>
                    </div>
                    <div className="text-teal-100 text-[11px] mt-0.5">
                      {releasingGlobalNotice}
                    </div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setReleasingGlobalNotice(null)} 
                  className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-700 cursor-pointer"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {currentTicket ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {/* TOP ACTION CONTROL BAR: Relocated Recall, and Mark No-Show Buttons */}
                <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider text-teal-400 flex items-center gap-1.5 mr-1">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                      Desk Actions:
                    </span>

                    {/* Recall Button */}
                    <button
                      type="button"
                      onClick={handleRecall}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-slate-900 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-lg transition-all shadow-xs cursor-pointer"
                      title="Ring chime and re-announce ticket number on lobby audio speakers"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Recall / Chime</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Mark No-Show Button */}
                    <button
                      type="button"
                      onClick={handleMarkNoShow}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 rounded-lg transition-all cursor-pointer"
                      title="Mark current applicant as no-show"
                    >
                      <UserX className="w-4 h-4 text-rose-400" />
                      <span>Mark No-Show</span>
                    </button>

                    {/* Complete Transaction / Auto-Transfer Button (Quick Access) */}
                    <button
                      id="desk-quick-complete-btn"
                      type="button"
                      onClick={handleCompleteTicket}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-xs cursor-pointer ring-2 ring-emerald-400/30"
                      title={
                        isInspectionStation || activeCounter.id === 3
                          ? 'Complete inspection and forward client to Payments Counter (Counter 4)'
                          : isReleasingCounter
                          ? 'Complete transaction and release documents'
                          : targetCounter
                          ? `Complete at ${activeCounter.name} & automatically transfer client to ${targetCounter.name}`
                          : 'Complete transaction'
                      }
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>
                        {isInspectionStation || activeCounter.id === 3
                          ? 'Complete & Forward to Payments'
                          : isReleasingCounter 
                          ? 'Complete & Release' 
                          : targetCounter 
                          ? `Complete & Forward to ${targetCounter.name}` 
                          : 'Complete'}
                      </span>
                    </button>
                  </div>
                </div>

              {/* Active Ticket Banner */}
              <div className="p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        Current Applicant
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800">
                        ● Now Serving
                      </span>
                    </div>

                    <div className="text-4xl font-extrabold font-ticket text-slate-900 mt-1">
                      {currentTicket.ticketNumber}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                        {getFranchiseTypeLabel(currentTicket.franchiseType)}
                      </span>
                      {currentTicket.priorityLevel === 'PRIORITY' && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          ★ Priority ({currentTicket.priorityReason})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Service Stopwatch */}
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-medium flex items-center justify-end gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Service Duration</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-slate-800 mt-1">
                      {formatTimer(elapsedSeconds)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Called {currentTicket.callCount || 1} time{(currentTicket.callCount || 1) > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Applicant Summary Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-500 block">Applicant Name</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {currentTicket.applicantName}
                    </span>
                  </div>
                  {currentTicket.franchiseNumber && (
                    <div>
                      <span className="text-slate-500 block">Franchise No.</span>
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {currentTicket.franchiseNumber}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block">Body Number</span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                        <Car className="w-3.5 h-3.5 text-slate-400" />
                        {currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || matchingFranchiseRecord?.bodyNumber || 'N/A'}
                      </span>
                      {matchingFranchiseRecord && (
                        <button
                          type="button"
                          onClick={() => setViewingFranchiseRecord(matchingFranchiseRecord)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border ${
                            isVerificationStation
                              ? 'bg-amber-100/90 hover:bg-amber-200 text-amber-950 border-amber-300 ring-1 ring-amber-400/30'
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-300'
                          }`}
                          title={
                            isVerificationStation
                              ? 'Verification Desk: View & Edit Official Franchise Master Registry Data'
                              : 'View Official Franchise Master Record in Database'
                          }
                        >
                          <Eye className="w-3.5 h-3.5 text-teal-700" />
                          <span>View Data</span>
                          {isVerificationStation && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-1 rounded">
                              <Edit3 className="w-2.5 h-2.5" />
                              Verify & Edit
                            </span>
                          )}
                        </button>
                      )}

                      {/* Motorcycle Icon next to Eye icon ONLY if in records AND passed inspection */}
                      {(() => {
                        const candidateBody = (currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || matchingFranchiseRecord?.bodyNumber || '').trim();
                        // User Requirement 1: If not in the records, do NOT show inspection data passed!
                        if (!matchingFranchiseRecord || !candidateBody) return null;

                        const isPassed = Boolean(
                          matchingFranchiseRecord.inspectionPassed &&
                          activeApplicantInspection?.status === 'PASSED' &&
                          isBodyNumberInspectionPassed(candidateBody)
                        );

                        if (!isPassed) return null;

                        return (
                          <button
                            type="button"
                            onClick={() => setViewingInspectionBody(candidateBody)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30"
                            title={`Body #${candidateBody} Passed Physical Inspection: Click to view complete inspection data & photos`}
                          >
                            <Motorbike className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Inspection Data</span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 px-1 rounded">
                              Passed
                            </span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                  {currentTicket.contactNumber && (
                    <div>
                      <span className="text-slate-500 block">Contact Phone</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {currentTicket.contactNumber}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block">Classification</span>
                    <span className="font-semibold text-slate-800 mt-0.5 inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      {currentTicket.classification || 'Operator'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Franchise Zone</span>
                    <span className="font-semibold text-slate-800 mt-0.5 inline-flex items-center px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {currentTicket.zone || 'Zone 1'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Checklist Section: Strictly restricted per Requirement 1 */}
              <div className="p-4 sm:p-6 space-y-4">
                {isInspectionStation ? (
                  /* MTFRB Physical Inspection Checklist: ONLY available on Inspection Station */
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 text-xs font-black rounded-lg bg-teal-700 text-white shadow-xs flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4" />
                          <span>Official MTFRB Physical Inspection Checklist</span>
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-slate-950">
                          Field Tablet Mode
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
                          Connected Body #{currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || matchingFranchiseRecord?.bodyNumber || currentTicket.ticketNumber}
                        </span>
                      </div>
                    </div>

                    <InspectionChecklistSection
                      bodyNumber={currentTicket.bodyNumber || currentTicket.plateOrUnitNumber || matchingFranchiseRecord?.bodyNumber || currentTicket.ticketNumber}
                      inspectorName={activeCounter.officerName || 'Carmela Dizon'}
                      currentTicket={currentTicket}
                      onChecklistSaved={(saved) => {
                        const isPass = saved.status === 'PASSED';
                        const logMsg = `[Inspection ${saved.status}] Verified by ${saved.inspectorName} on ${saved.inspectionDate}. Remarks: ${saved.remarks || 'Standard clearance.'}`;
                        setOfficerNotes((prev) => (prev ? `${prev}\n${logMsg}` : logMsg));

                        // Synchronously update the active ticket in state and persistence
                        const updated = {
                          ...currentTicket,
                          inspectionPassed: isPass,
                          inspectionDate: saved.inspectionDate,
                          inspectorName: saved.inspectorName,
                          inspectionChecklist: saved,
                        };
                        const updatedTickets = tickets.map((t) => (t.id === updated.id ? updated : t));
                        saveTickets(updatedTickets);
                        onTicketsUpdated(updatedTickets);
                      }}
                      onCompleteInspection={(saved) => {
                        const isPass = saved.status === 'PASSED';
                        const paymentCounter = counters.find((c) => c.id === 4 || c.name.toLowerCase().includes('payment')) || counters[3] || { id: 4, name: 'Payment' };
                        const logMsg = isPass
                          ? `[Inspection COMPLETED & SAVED TO DATABASE] Roadworthy certification recorded by ${saved.inspectorName} on ${saved.inspectionDate}. Automatically transferred to ${paymentCounter.name} Counter.`
                          : `[Inspection SAVED TO DATABASE - FAILED] Defects/non-compliance logged by ${saved.inspectorName} on ${saved.inspectionDate}. Transferred to ${paymentCounter.name} Counter.`;
                        
                        const transferRecord = `[Completed at ${activeCounter.name} ➔ Automatically transferred to ${paymentCounter.name}]`;
                        const combinedNotes = currentTicket.notes ? `${currentTicket.notes} | ${transferRecord}` : transferRecord;

                        const updated = {
                          ...currentTicket,
                          status: 'WAITING' as const,
                          assignedCounter: paymentCounter.id,
                          calledAt: undefined,
                          notes: combinedNotes,
                          inspectionPassed: isPass,
                          inspectionDate: saved.inspectionDate,
                          inspectorName: saved.inspectorName,
                          inspectionChecklist: saved,
                        };
                        const updatedTickets = tickets.map((t) => (t.id === updated.id ? updated : t));
                        const updatedCounters = counters.map((c) => (c.id === activeCounter.id ? { ...c, currentTicketId: null, status: 'OPEN' as const } : c));

                        saveTickets(updatedTickets);
                        saveCounters(updatedCounters);
                        onTicketsUpdated(updatedTickets);
                        onCountersUpdated(updatedCounters);

                        setAutoTransferNotice({
                          ticketNumber: currentTicket.ticketNumber,
                          applicantName: currentTicket.applicantName,
                          fromCounter: activeCounter.name,
                          toCounter: paymentCounter.name,
                        });
                        setTimeout(() => setAutoTransferNotice(null), 6000);

                        setOfficerNotes('');
                        soundManager.playTransferChime(currentTicket.ticketNumber, paymentCounter.name, activeCounter.name);
                      }}
                    />
                  </div>
                ) : (
                  /* Other Counter Stations (Assessment, Verification, Payment, Scanning, Encoding, Affixing, Releasing) */
                  <div className="space-y-4">
                    {/* Inspection Clearance Banner (Requirement 4 & User Request 1) */}
                    {(() => {
                      // 1. If not in official records
                      if (!matchingFranchiseRecord) {
                        return (
                          <div className="p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 bg-rose-50 border-rose-300 text-rose-950 shadow-2xs">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-xs uppercase tracking-wide text-rose-900">
                                    Physical Inspection: NOT IN RECORDS (FAILED)
                                  </span>
                                  <span className="px-2 py-0.2 rounded text-[10px] font-black uppercase bg-rose-600 text-white">
                                    Not In Records
                                  </span>
                                </div>
                                <p className="text-[11px] text-rose-800 mt-0.5">
                                  This vehicle body number is not registered in the official MTFRB Franchise Database records. Inspection data cannot be certified or passed until registered.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 2. In records: check passed status
                      const targetBodyNumber = (
                        currentTicket.bodyNumber ||
                        currentTicket.plateOrUnitNumber ||
                        matchingFranchiseRecord?.bodyNumber ||
                        activeApplicantInspection?.bodyNumber ||
                        currentTicket.ticketNumber
                      ).replace(/^#+/, '').trim();

                      const isPassed = (currentTicket.inspectionPassed === true || (matchingFranchiseRecord?.inspectionPassed && currentTicket.inspectionPassed !== false)) && activeApplicantInspection?.status === 'PASSED';

                      return (
                        <div className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                          isPassed
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                            : 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            {isPassed ? (
                              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs uppercase tracking-wide">
                                  {isPassed
                                    ? 'Physical Inspection: PASSED'
                                    : 'Physical Inspection: NOT PASSED / FRESH INSPECTION REQUIRED'}
                                </span>
                                {isPassed ? (
                                  <span className="px-2 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-200 text-emerald-900">
                                    Roadworthy Certified
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.2 rounded text-[10px] font-black uppercase bg-rose-600 text-white">
                                    Action Required
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {isPassed
                                  ? `Passed fresh MTFRB inspection by ${activeApplicantInspection?.inspectorName || 'Carmela Dizon'} on ${activeApplicantInspection?.inspectionDate || 'recent'} (Body #${targetBodyNumber}).`
                                  : 'All applicants in queue must undergo a fresh official MTFRB vehicle inspection before clearance and franchise approval.'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {targetBodyNumber && (
                              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-700 bg-white/90 px-2.5 py-1 rounded-lg border border-slate-200">
                                <span>Body: {targetBodyNumber}</span>
                              </div>
                            )}
                            {isPassed ? (
                              <button
                                type="button"
                                onClick={() => setViewingInspectionBody(targetBodyNumber)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                title="Click to view all physical inspection details, specifications & photos"
                              >
                                <Motorbike className="w-3.5 h-3.5" />
                                <span>View Inspection Data</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setInspectingBody(targetBodyNumber)}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                title="Conduct fresh official MTFRB vehicle inspection for this applicant"
                              >
                                <Motorbike className="w-3.5 h-3.5" />
                                <span>Conduct Fresh Inspection</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Payment Station: Replaces Requirements Checklist with OR number, fee checkboxes, running total, and dot matrix receipt */}
                    {isPaymentStation ? (
                      <PaymentStationSection
                        currentTicket={currentTicket}
                        matchingFranchiseRecord={matchingFranchiseRecord}
                        cashierOfficerName={activeCounter.officerName || 'Cashier Officer'}
                        counterId={activeCounter.id}
                        onPaymentSaved={(payment) => {
                          // Update active ticket with payment info
                          const updatedTickets = tickets.map((t) =>
                            t.id === currentTicket.id
                              ? {
                                  ...t,
                                  orNumber: payment.orNumber,
                                  paymentCompleted: true,
                                  paymentAmount: payment.totalAmount,
                                }
                              : t
                          );
                          saveTickets(updatedTickets);
                          onTicketsUpdated(updatedTickets);
                        }}
                        onNavigateToRecords={() => {
                          if (matchingFranchiseRecord) {
                            setViewingFranchiseRecord(matchingFranchiseRecord);
                          }
                        }}
                      />
                    ) : (
                      <>
                        {/* Document Requirements Checklist (Non-Payment Stations) */}
                        <div className="flex items-center justify-between pt-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">
                              Requirements Checklist — {getFranchiseTypeLabel(currentTicket.franchiseType)}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Required municipal documents for {getFranchiseTypeLabel(currentTicket.franchiseType)}. Check each original document verified during counter evaluation.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                              {verifiedCount} / {checklistDocs.length} Checked
                            </span>
                            <button
                              type="button"
                              onClick={handleSelectAllDocuments}
                              className="text-xs text-teal-700 hover:text-teal-800 font-semibold underline cursor-pointer"
                            >
                              Verify All
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {checklistDocs.map((doc) => {
                            const isChecked = currentTicket.verifiedDocuments?.includes(doc.id);
                            return (
                              <label
                                key={doc.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-teal-50/50 border-teal-300'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleDocument(doc.id)}
                                  className="mt-0.5 h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                                />
                                <div className="flex-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">{doc.name}</span>
                                    {doc.mandatory ? (
                                      <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                        Mandatory
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">Optional</span>
                                    )}
                                  </div>
                                  <p className="text-slate-500 mt-0.5">{doc.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Releasing Station: Official Certificate & Client Email Dispatch Center */}
                    {isReleasingCounter && (
                      <div className="p-4 bg-teal-950 text-white rounded-xl border-2 border-teal-500 shadow-md space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-teal-800 text-teal-200 shrink-0">
                              <Mail className="w-5 h-5 text-amber-300" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-white">
                                  Official Certificate Release & Client Email Notification
                                </h4>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-slate-950">
                                  Automatic Dispatch
                                </span>
                              </div>
                              <p className="text-xs text-teal-200 mt-0.5">
                                When this transaction is completed, an official completion email with their MTFRB Certificate attached is dispatched to the client.
                              </p>
                            </div>
                          </div>
                        </div>

                        {releasingEmailNotice && (
                          <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
                            releasingEmailNotice.success
                              ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-500'
                              : 'bg-rose-900/90 text-rose-200 border border-rose-500'
                          }`}>
                            <div className="flex items-center gap-2">
                              {releasingEmailNotice.success ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                              <span>{releasingEmailNotice.message}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setReleasingEmailNotice(null)}
                              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                          <div className="sm:col-span-8">
                            <label className="block text-xs font-bold text-teal-200 mb-1">
                              Client Email Address (Recipient for Certificate Attachment)
                            </label>
                            <div className="relative">
                              <Mail className="w-4 h-4 text-teal-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="email"
                                value={overrideEmail}
                                onChange={(e) => setOverrideEmail(e.target.value)}
                                placeholder="e.g. client@example.com"
                                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-teal-500 rounded-lg text-white font-medium focus:ring-2 focus:ring-amber-400 outline-hidden placeholder-teal-600"
                              />
                            </div>
                          </div>
                          <div className="sm:col-span-4 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSendingEmail || !overrideEmail.trim() || !overrideEmail.includes('@')}
                              onClick={() => sendReleasingCompletionEmail(currentTicket, overrideEmail.trim())}
                              className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                              title="Send or preview official certificate email to applicant"
                            >
                              <Send className="w-3.5 h-3.5 text-amber-300" />
                              <span>{isSendingEmail ? 'Sending...' : 'Email Certificate Now'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Officer Notes Area */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Evaluation Remarks & Endorsement Notes
                      </label>
                      <textarea
                        rows={2}
                        value={officerNotes}
                        onChange={(e) => setOfficerNotes(e.target.value)}
                        placeholder="Enter document verification findings, clearance remarks, or notes for the cashier..."
                        className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Control Panel */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Recall button */}
                  <button
                    onClick={handleRecall}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors shadow-2xs"
                    title="Ring chime and announce again"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Recall / Chime</span>
                  </button>

                  {/* Transfer to Any Counter Button */}
                  <button
                    onClick={() => {
                      setTransferModalTicket(currentTicket);
                      setTransferDestination(counters.find((c) => c.id !== activeCounter.id)?.id || 4);
                      setTransferRemarks('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                    title="Transfer this ticket to any counter"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-700" />
                    <span>Transfer Counter...</span>
                  </button>

                  {/* Reprint Slip / QR Button */}
                  <button
                    onClick={() => setReprintTicket(currentTicket)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
                    title="Print or view official ticket slip with mobile QR code"
                  >
                    <Printer className="w-3.5 h-3.5 text-teal-700" />
                    <span>Reprint Slip / QR</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* No Show Button */}
                  <button
                    onClick={handleMarkNoShow}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Mark No-Show</span>
                  </button>

                  {/* Complete Transaction Button with Inspection Enforcement & Auto-Transfer Logic */}
                  <button
                    id="desk-evaluation-complete-btn"
                    onClick={handleCompleteTicket}
                    className={`flex items-center gap-1.5 px-5 py-2 text-xs font-black rounded-lg transition-all shadow-sm cursor-pointer ${
                      activeCounter.id > 3 && activeApplicantInspection?.status !== 'PASSED'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : (activeCounter.id === 3 || isInspectionStation)
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/40'
                        : isReleasingCounter
                        ? 'bg-teal-700 hover:bg-teal-800 text-white'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    }`}
                    title={
                      activeCounter.id > 3 && activeApplicantInspection?.status !== 'PASSED'
                        ? 'Inspection must be PASSED before completing'
                        : (activeCounter.id === 3 || isInspectionStation)
                        ? 'Complete vehicle physical inspection and automatically transfer client to Payments Counter (Counter 4)'
                        : isReleasingCounter
                        ? 'Complete transaction and release documents'
                        : targetCounter
                        ? `Complete at ${activeCounter.name} & automatically forward client to ${targetCounter.name}`
                        : 'Complete current counter transaction'
                    }
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {activeCounter.id > 3 && activeApplicantInspection?.status !== 'PASSED'
                        ? 'Complete (Inspection Required)'
                        : (activeCounter.id === 3 || isInspectionStation)
                        ? 'Complete & Forward to Payments'
                        : isReleasingCounter
                        ? 'Complete & Release Transaction'
                        : targetCounter
                        ? `Complete & Forward to ${targetCounter.name}`
                        : 'Complete Transaction'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : isInspectionStation && showIdleInspection ? (
            /* Standalone On-Demand Physical Inspection Form */
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Standalone MTFRB Physical Inspection Station
                    </h3>
                    <p className="text-xs text-slate-500">
                      Walk-in unit inspection connected to main database by body number.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIdleInspection(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Close Inspection Form
                </button>
              </div>

              <InspectionChecklistSection
                bodyNumber={idleInspectionBody || '001'}
                inspectorName={activeCounter.officerName || 'Carmela Dizon'}
                onBodyNumberChange={(newBody) => setIdleInspectionBody(newBody)}
                onCompleteInspection={(saved) => {
                  const paymentCounter = counters.find((c) => c.id === 4 || c.name.toLowerCase().includes('payment')) || counters[3] || { id: 4, name: 'Payment' };
                  const refreshedTickets = loadTickets();
                  const refreshedCounters = loadCounters();
                  onTicketsUpdated(refreshedTickets);
                  onCountersUpdated(refreshedCounters);

                  const matchedTicket = refreshedTickets.find(t => 
                    (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim() === (idleInspectionBody || '001').replace(/^#+/, '').trim()
                  );

                  setAutoTransferNotice({
                    ticketNumber: matchedTicket?.ticketNumber || `Body #${idleInspectionBody || '001'}`,
                    applicantName: matchedTicket?.applicantName || saved.operatorName || 'Applicant',
                    fromCounter: activeCounter.name,
                    toCounter: paymentCounter.name,
                  });
                  setTimeout(() => setAutoTransferNotice(null), 6000);
                  soundManager.playTransferChime(matchedTicket?.ticketNumber || idleInspectionBody || '001', paymentCounter.name, activeCounter.name);
                }}
              />
            </div>
          ) : (
            /* Idle Counter State */
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-10 text-center shadow-xs flex flex-col items-center justify-center min-h-[360px]">
              <div className="p-4 bg-teal-50 rounded-full text-teal-700 mb-3">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{activeCounter.name} Station Ready</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-6">
                There is currently no active applicant at this desk. Select or call the next ticket from the queue management panel on the left.
              </p>

              {isInspectionStation && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowIdleInspection(true)}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Open Inspection Checklist by Body #</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer to Any Counter Modal (Landscape & Fitted) */}
      {transferModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-sm">Transfer Ticket to Counter</h3>
                <span className="text-xs text-slate-400 font-normal hidden sm:inline">• Landscape Station Router</span>
              </div>
              <button
                onClick={() => setTransferModalTicket(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-hidden flex flex-col md:flex-row gap-5 items-stretch">
              {/* Left Column: Ticket Info & Transfer Remarks */}
              <div className="w-full md:w-5/12 flex flex-col justify-between space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-3">
                  <div className="flex items-start justify-between border-b border-slate-200/80 pb-3">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Ticket Number</div>
                      <div className="text-3xl font-black font-ticket text-slate-900">{transferModalTicket.ticketNumber}</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">{transferModalTicket.applicantName}</div>
                      <div className="text-[11px] text-slate-500">
                        Body No: <strong>{transferModalTicket.bodyNumber || transferModalTicket.plateOrUnitNumber || 'N/A'}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200 mb-1">
                        {getFranchiseTypeLabel(transferModalTicket.franchiseType)}
                      </span>
                      <div className="text-[11px] text-slate-600 font-medium">
                        Current: Counter {transferModalTicket.assignedCounter || activeCounter.id}
                      </div>
                    </div>
                  </div>

                  {/* Transfer Reason / Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Transfer Remarks / Instructions (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={transferRemarks}
                      onChange={(e) => setTransferRemarks(e.target.value)}
                      placeholder="e.g. For physical inspection, payment cashiering, or final release..."
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-hidden resize-none"
                    />
                  </div>
                </div>

                {/* Left Bottom Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTransferModalTicket(null)}
                    className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTransferTicket(transferModalTicket, transferDestination, transferRemarks)}
                    className="flex-2 py-2 px-3 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to {counters.find(c => c.id === transferDestination)?.name || 'Selected Station'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Destination Counter Grid (2x4 Landscape Grid) */}
              <div className="w-full md:w-7/12 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Select Destination Desk:
                    </label>
                    <span className="text-[11px] text-teal-700 font-bold">
                      Destination: {counters.find(c => c.id === transferDestination)?.name || 'Desk'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {counters.map((c) => {
                      const isSelected = transferDestination === c.id;
                      const isCurrent = c.id === activeCounter.id;

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setTransferDestination(c.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-600/20'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-xs text-slate-900">{c.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-700">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                              {c.officerName}
                            </div>
                          </div>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-slate-500 text-right">
                  Ticket will immediately appear on the recipient counter's queue desk.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Slip / QR Modal */}
      {reprintTicket && (
        <TicketSlipModal
          ticket={reprintTicket}
          queuePosition={calculateWaitEstimates(tickets, reprintTicket.id).position}
          estimatedMinutes={calculateWaitEstimates(tickets, reprintTicket.id).estimatedMinutes}
          onClose={() => setReprintTicket(null)}
        />
      )}

      {/* Franchise Master Record Modal (View on all stations, Edit & Verify on Verification Station) */}
      {viewingFranchiseRecord && (
        <FranchiseRecordModal
          record={viewingFranchiseRecord}
          onClose={() => setViewingFranchiseRecord(null)}
          allowEdit={isVerificationStation}
          stationName={activeCounter ? `${activeCounter.name} Desk` : undefined}
          onRecordUpdated={(updated) => {
            setViewingFranchiseRecord(updated);
            setFranchiseDbVersion((v) => v + 1);

            // Synchronize current queue ticket if operator or contact info was updated during verification
            if (currentTicket) {
              const updatedTickets = tickets.map((t) =>
                t.id === currentTicket.id
                  ? {
                      ...t,
                      applicantName: updated.operatorName || t.applicantName,
                      contactNumber: updated.contactNumber || t.contactNumber,
                      bodyNumber: updated.bodyNumber || t.bodyNumber,
                    }
                  : t
              );
              saveTickets(updatedTickets);
              onTicketsUpdated(updatedTickets);
            }
          }}
        />
      )}

      {/* Physical Inspection Data Modal */}
      {viewingInspectionBody && (
        <PhysicalInspectionDataModal
          bodyNumber={viewingInspectionBody}
          isOpen={Boolean(viewingInspectionBody)}
          onClose={() => setViewingInspectionBody(null)}
        />
      )}

      {/* Interactive Fresh Inspection Modal */}
      {inspectingBody && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setInspectingBody(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ClipboardCheck className="w-5 h-5 text-teal-300" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold tracking-tight">
                    Conduct Official MTFRB Vehicle Inspection — Body #{inspectingBody}
                  </h3>
                  <p className="text-[11px] text-teal-200/80">
                    Saves to database and replaces client records upon certification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingBody(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-50/50">
              <InspectionChecklistSection
                bodyNumber={inspectingBody}
                inspectorName={activeCounter.officerName || 'Carmela Dizon'}
                currentTicket={currentTicket || undefined}
                onChecklistSaved={(saved) => {
                  const isPass = saved.status === 'PASSED';
                  if (currentTicket) {
                    const updated = {
                      ...currentTicket,
                      inspectionPassed: isPass,
                      inspectionDate: saved.inspectionDate,
                      inspectorName: saved.inspectorName,
                      inspectionChecklist: saved,
                    };
                    const updatedTickets = tickets.map((t) => (t.id === updated.id ? updated : t));
                    saveTickets(updatedTickets);
                    onTicketsUpdated(updatedTickets);
                  }
                  setInspectingBody(null);
                  soundManager.playSuccess();
                }}
                onCompleteInspection={(saved) => {
                  if (currentTicket) {
                    const isPass = saved.status === 'PASSED';
                    const paymentCounter = counters.find((c) => c.id === 4 || c.name.toLowerCase().includes('payment')) || counters[3] || { id: 4, name: 'Payment' };
                    const transferRecord = `[Completed at ${activeCounter.name} ➔ Automatically transferred to ${paymentCounter.name}]`;
                    const combinedNotes = currentTicket.notes ? `${currentTicket.notes} | ${transferRecord}` : transferRecord;

                    const updated = {
                      ...currentTicket,
                      status: (activeCounter.id === 3 || isInspectionStation ? 'WAITING' : currentTicket.status) as any,
                      assignedCounter: (activeCounter.id === 3 || isInspectionStation ? paymentCounter.id : currentTicket.assignedCounter),
                      calledAt: (activeCounter.id === 3 || isInspectionStation ? undefined : currentTicket.calledAt),
                      notes: combinedNotes,
                      inspectionPassed: isPass,
                      inspectionDate: saved.inspectionDate,
                      inspectorName: saved.inspectorName,
                      inspectionChecklist: saved,
                    };
                    const updatedTickets = tickets.map((t) => (t.id === updated.id ? updated : t));
                    const updatedCounters = (activeCounter.id === 3 || isInspectionStation)
                      ? counters.map((c) => (c.id === activeCounter.id ? { ...c, currentTicketId: null, status: 'OPEN' as const } : c))
                      : counters;

                    saveTickets(updatedTickets);
                    saveCounters(updatedCounters);
                    onTicketsUpdated(updatedTickets);
                    onCountersUpdated(updatedCounters);

                    if (activeCounter.id === 3 || isInspectionStation) {
                      soundManager.playTransferChime(currentTicket.ticketNumber, paymentCounter.name, activeCounter.name);
                      setAutoTransferNotice({
                        ticketNumber: currentTicket.ticketNumber,
                        applicantName: currentTicket.applicantName,
                        fromCounter: activeCounter.name,
                        toCounter: paymentCounter.name,
                      });
                      setTimeout(() => setAutoTransferNotice(null), 6000);
                      setOfficerNotes('');
                    } else {
                      soundManager.playSuccess();
                    }
                  }
                  setInspectingBody(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
