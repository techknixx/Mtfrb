import React, { useState, useEffect, useMemo } from 'react';
import { 
  FranchiseType, 
  Ticket, 
  FranchiseZone, 
  FRANCHISE_ZONES, 
  ApplicantClassification, 
  CLASSIFICATIONS, 
  getDocumentsForType,
  getFranchiseTypeLabel
} from '../types';
import { 
  generateNextTicketNumber, 
  saveTickets, 
  calculateWaitEstimates, 
  syncTicketToFranchiseDatabase,
  getFranchiseRecordByBodyNumber 
} from '../utils/storage';
import { TicketSlipModal } from './TicketSlipModal';
import { MTFRB_LOGO } from '../assets/logo';
import { 
  FilePlus2, 
  RefreshCw, 
  Wrench,
  FileMinus,
  Accessibility, 
  CheckCircle2, 
  User, 
  Hash, 
  Phone, 
  Mail,
  FileText, 
  ChevronRight, 
  Info,
  Clock,
  Lock,
  X,
  Printer,
  Minimize2,
  AlertTriangle
} from 'lucide-react';

interface KioskViewProps {
  tickets: Ticket[];
  onTicketGenerated: (newTicket: Ticket) => void;
  isKioskLocked?: boolean;
  onExit?: () => void;
}

export const KioskView: React.FC<KioskViewProps> = ({ 
  tickets, 
  onTicketGenerated,
  isKioskLocked = true,
  onExit,
}) => {
  const [selectedType, setSelectedType] = useState<FranchiseType>('NEW');
  const [isPriority, setIsPriority] = useState<boolean>(false);
  const [priorityReason, setPriorityReason] = useState<'Senior Citizen' | 'Person with Disability (PWD)' | 'Pregnant' | 'Solo Parent with Infant'>('Senior Citizen');
  const [showChecklistModal, setShowChecklistModal] = useState<boolean>(false);
  const [checklistTab, setChecklistTab] = useState<FranchiseType>('NEW');
  
  // Form fields
  const [applicantName, setApplicantName] = useState('');
  const [franchiseNumber, setFranchiseNumber] = useState('');
  const [bodyNumber, setBodyNumber] = useState('');
  const [classification, setClassification] = useState<ApplicantClassification>('Operator');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [zone, setZone] = useState<FranchiseZone>('Zone 1');
  
  // Modal for generated ticket
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [estimatedData, setEstimatedData] = useState<{ position: number; estimatedMinutes: number }>({ position: 1, estimatedMinutes: 5 });
  const [bodyNumberError, setBodyNumberError] = useState<string>('');

  // Prompt modal for missing database record during Renewal, Change Motor, and Dropping
  const [recordPromptModal, setRecordPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    bodyNumber: string;
    type: FranchiseType;
  }>({
    isOpen: false,
    title: '',
    message: '',
    bodyNumber: '',
    type: 'RENEWAL',
  });

  // Renewal, Change Motor, and Dropping transactions require an existing record in the database
  const isExistingRequired = selectedType === 'RENEWAL' || selectedType === 'CHANGE_MOTOR' || selectedType === 'DROPPING';

  // Check if entered body number exists in database
  const matchedFranchise = useMemo(() => {
    if (!bodyNumber.trim()) return null;
    return getFranchiseRecordByBodyNumber(bodyNumber.trim());
  }, [bodyNumber]);

  // Handle body number change with real-time lookup & smart auto-population
  const handleBodyNumberChange = (val: string) => {
    setBodyNumber(val);
    setBodyNumberError('');

    const clean = val.trim();
    if (isExistingRequired) {
      if (clean) {
        const record = getFranchiseRecordByBodyNumber(clean);
        if (record) {
          setApplicantName(record.operatorName || record.driverName || '');
          setFranchiseNumber(record.franchiseNumber || '');
          if (record.routeZone || record.zone) {
            setZone((record.routeZone || record.zone) as FranchiseZone);
          }
          if (record.classification) {
            setClassification(record.classification as ApplicantClassification);
          }
          setContactNumber(record.contactNumber || '');
          setEmail(record.emailAddress || record.email || '');
        } else {
          setApplicantName('');
          setFranchiseNumber('');
          setContactNumber('');
          setEmail('');
        }
      } else {
        setApplicantName('');
        setFranchiseNumber('');
        setContactNumber('');
        setEmail('');
      }
    }
  };

  // Synchronize field values when switching between NEW and Existing record transaction types
  useEffect(() => {
    if (isExistingRequired) {
      const clean = bodyNumber.trim();
      if (clean) {
        const record = getFranchiseRecordByBodyNumber(clean);
        if (record) {
          setApplicantName(record.operatorName || record.driverName || '');
          setFranchiseNumber(record.franchiseNumber || '');
          if (record.routeZone || record.zone) {
            setZone((record.routeZone || record.zone) as FranchiseZone);
          }
          if (record.classification) {
            setClassification(record.classification as ApplicantClassification);
          }
          setContactNumber(record.contactNumber || '');
          setEmail(record.emailAddress || record.email || '');
        } else {
          setApplicantName('');
          setFranchiseNumber('');
          setContactNumber('');
          setEmail('');
        }
      } else {
        setApplicantName('');
        setFranchiseNumber('');
        setContactNumber('');
        setEmail('');
      }
    }
  }, [selectedType, isExistingRequired]);

  // Check if body number is already used in active queue tickets
  const isBodyNumberUsed = (bn: string): boolean => {
    const clean = bn.trim().toLowerCase();
    if (!clean) return false;
    return tickets.some(t => {
      if (t.status !== 'WAITING' && t.status !== 'SERVING') return false;
      const existingBody = (t.bodyNumber || t.plateOrUnitNumber || '').trim().toLowerCase();
      const existingTicketNum = (t.ticketNumber || '').trim().toLowerCase();
      return existingBody === clean || existingTicketNum === clean;
    });
  };

  const isCurrentBodyUsed = bodyNumber.trim() ? isBodyNumberUsed(bodyNumber) : false;

  // Counts of currently waiting applicants
  const waitingNew = tickets.filter((t) => t.status === 'WAITING' && t.franchiseType === 'NEW').length;
  const waitingRenewal = tickets.filter((t) => t.status === 'WAITING' && t.franchiseType === 'RENEWAL').length;
  const waitingChangeMotor = tickets.filter((t) => t.status === 'WAITING' && t.franchiseType === 'CHANGE_MOTOR').length;
  const waitingDropping = tickets.filter((t) => t.status === 'WAITING' && t.franchiseType === 'DROPPING').length;
  const totalWaiting = waitingNew + waitingRenewal + waitingChangeMotor + waitingDropping;

  // Listen for F12 to exit kiosk mode, explicitly disable Esc to avoid accidental closure
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || e.code === 'F12') {
        e.preventDefault();
        onExit?.();
      } else if (e.key === 'Escape' || e.code === 'Escape') {
        // Disable Esc to avoid accidental closure of kiosk
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setBodyNumberError('');

    const cleanBodyNumber = bodyNumber.trim();

    // Verification for Renewal, Change Motor, and Order for Dropping:
    // Body number MUST be provided and MUST exist in the database!
    if (isExistingRequired) {
      if (!cleanBodyNumber) {
        setBodyNumberError(`Body Number is required for ${getFranchiseTypeLabel(selectedType)}.`);
        setRecordPromptModal({
          isOpen: true,
          title: 'Body Number Required',
          message: `Please enter your registered Body Number to proceed with ${getFranchiseTypeLabel(selectedType)}.\n\nIn MTFRB Castillejos, your Body Number is your official Queue Ticket Number.`,
          bodyNumber: '',
          type: selectedType,
        });
        return;
      }

      const existingRecord = getFranchiseRecordByBodyNumber(cleanBodyNumber);
      if (!existingRecord) {
        setBodyNumberError(`No existing record found for Body Number "${cleanBodyNumber}".`);
        setRecordPromptModal({
          isOpen: true,
          title: 'No Existing Record Found',
          message: `No franchise record was found for Body Number "${cleanBodyNumber}" in the MTFRB Castillejos database.\n\nTransactions for ${getFranchiseTypeLabel(selectedType)} require an existing registered franchise record on file.\n\nPlease verify your body number, or switch to "New Franchise" if this is a first-time franchise application.`,
          bodyNumber: cleanBodyNumber,
          type: selectedType,
        });
        return;
      }
    }

    const finalApplicantName = isExistingRequired
      ? (matchedFranchise?.operatorName || matchedFranchise?.driverName || applicantName.trim())
      : applicantName.trim();

    if (!finalApplicantName) {
      return;
    }

    if (cleanBodyNumber && isBodyNumberUsed(cleanBodyNumber)) {
      setBodyNumberError(`Body Number "${cleanBodyNumber}" is currently in the active queue.`);
      return;
    }

    // Ticket Number is the body number of the client if entered, or fallback to generated sequence
    const ticketNumber = cleanBodyNumber ? cleanBodyNumber : generateNextTicketNumber(selectedType, isPriority, bodyNumber);
    const newTicket: Ticket = {
      id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ticketNumber,
      franchiseType: selectedType,
      priorityLevel: isPriority ? 'PRIORITY' : 'REGULAR',
      priorityReason: isPriority ? priorityReason : undefined,
      applicantName: finalApplicantName,
      franchiseNumber: selectedType !== 'NEW' ? (franchiseNumber.trim() || undefined) : undefined,
      bodyNumber: cleanBodyNumber || undefined,
      plateOrUnitNumber: cleanBodyNumber || undefined, // alias for backwards compatibility
      classification: isExistingRequired && matchedFranchise?.classification 
        ? (matchedFranchise.classification as ApplicantClassification) 
        : classification,
      contactNumber: contactNumber.trim() || undefined,
      email: email.trim() || undefined,
      emailAddress: email.trim() || undefined,
      zone: isExistingRequired && (matchedFranchise?.routeZone || matchedFranchise?.zone)
        ? ((matchedFranchise.routeZone || matchedFranchise.zone) as FranchiseZone)
        : zone,
      status: 'WAITING',
      assignedCounter: 1, // Directly routed to Counter 1 (Assessment)
      createdAt: Date.now(),
      verifiedDocuments: [],
      callCount: 0,
    };

    const updatedTickets = [...tickets, newTicket];
    saveTickets(updatedTickets);
    onTicketGenerated(newTicket);

    // Sync to Information Database immediately so email & applicant data are persisted
    if (newTicket.bodyNumber) {
      syncTicketToFranchiseDatabase(newTicket);
    }

    const est = calculateWaitEstimates(updatedTickets, newTicket.id);
    setEstimatedData(est);
    setActiveTicket(newTicket);

    // Send confirmation SMS if mobile number was provided
    if (contactNumber.trim()) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const trackingUrl = `${baseUrl}/?ticket=${ticketNumber}&id=${newTicket.id}`;

      fetch('/api/sms/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketNumber,
          applicantName: newTicket.applicantName,
          contactNumber: contactNumber.trim(),
          franchiseType: selectedType,
          bodyNumber: newTicket.bodyNumber,
          zone,
          estimatedWaitMinutes: est.estimatedMinutes,
          queuePosition: est.position,
          trackingUrl,
        }),
      }).catch((err) => console.warn('SMS dispatch failed:', err));
    }

    // Reset form fields
    setApplicantName('');
    setFranchiseNumber('');
    setBodyNumber('');
    setClassification('Operator');
    setContactNumber('');
    setEmail('');
    setZone('Zone 1');
    setIsPriority(false);
  };

  const openChecklistForCurrent = () => {
    setChecklistTab(selectedType);
    setShowChecklistModal(true);
  };

  const activeDocuments = getDocumentsForType(checklistTab);

  return (
    <div className="h-full w-full max-w-[1920px] mx-auto flex flex-col justify-between overflow-hidden gap-2.5 sm:gap-3 bg-slate-950 text-slate-100 select-none p-2 sm:p-3 font-sans">
      {/* Top Kiosk Header / Status Strip (Enlarged & Prominent matching Lobby TV) */}
      <div className="bg-slate-900/90 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 shadow-xl border border-slate-800 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <img 
            src={MTFRB_LOGO} 
            alt="MTFRB Castillejos Seal" 
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 sm:border-3 border-amber-400 shadow-md shrink-0" 
          />
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <span className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
                MTFRB CASTILLEJOS | PORTAL
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-black bg-teal-950 text-teal-300 border border-teal-500/60">
                Self-Service Kiosk
              </span>
              {isKioskLocked && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Terminal Locked</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5 leading-tight">
              Select franchise transaction, enter your details, and dispense your official queue slip.
            </p>
          </div>
        </div>

        {/* Live Wait & Checklist Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-3 text-sm text-slate-300 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 font-medium">
            <Clock className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Est. Wait: <strong className="text-white font-black">~7–15 mins</strong></span>
            <span className="text-slate-600">|</span>
            <span>Active Queue: <strong className="text-teal-400 font-black">{totalWaiting}</strong></span>
          </div>

          <button
            type="button"
            onClick={openChecklistForCurrent}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            title="View required documents checklist"
          >
            <Info className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">Requirements</span>
          </button>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              title="Exit Kiosk Mode (or press F12)"
            >
              <Minimize2 className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Exit Kiosk</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-teal-300 font-mono text-xs border border-slate-600 font-bold">
                F12
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Workspace (Maximized Large Touch Matrix) */}
      <form onSubmit={handleSubmitTicket} className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-hidden">
        {/* Left Column (5 Cols): Large Touch Transaction Type & Priority Selection */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3 overflow-hidden">
          {/* Step 1: Select Franchise Transaction Type */}
          <div className="flex-1 flex flex-col justify-between gap-2.5 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-200">
                Step 1: Select Transaction Type
              </span>
              <span className="text-xs sm:text-sm text-teal-400 font-bold">
                Tap card to select
              </span>
            </div>

            {/* 4 Large Transaction Cards Grid matching Lobby TV Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
              {/* 1. New Franchise Card */}
              <button
                type="button"
                onClick={() => setSelectedType('NEW')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between relative cursor-pointer ${
                  selectedType === 'NEW'
                    ? 'border-teal-400 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 shadow-xl ring-2 ring-teal-500/40 text-white'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2.5 rounded-xl ${selectedType === 'NEW' ? 'bg-teal-500 text-slate-950 shadow-sm font-black' : 'bg-slate-800 text-teal-400'}`}>
                      <FilePlus2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    New Franchise
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-1 line-clamp-2 leading-tight">
                    First-time tricycle permit & motorized unit.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <span className="font-bold text-slate-400">{waitingNew} in queue</span>
                  <span className={`font-bold ${selectedType === 'NEW' ? 'text-teal-300' : 'text-slate-500'}`}>
                    {selectedType === 'NEW' ? 'Selected ✓' : 'Select'}
                  </span>
                </div>
              </button>

              {/* 2. Franchise Renewal Card */}
              <button
                type="button"
                onClick={() => setSelectedType('RENEWAL')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between relative cursor-pointer ${
                  selectedType === 'RENEWAL'
                    ? 'border-teal-400 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 shadow-xl ring-2 ring-teal-500/40 text-white'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2.5 rounded-xl ${selectedType === 'RENEWAL' ? 'bg-teal-500 text-slate-950 shadow-sm font-black' : 'bg-slate-800 text-teal-400'}`}>
                      <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    Renewal
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-1 line-clamp-2 leading-tight">
                    Annual franchise certificate validation.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <span className="font-bold text-slate-400">{waitingRenewal} in queue</span>
                  <span className={`font-bold ${selectedType === 'RENEWAL' ? 'text-teal-300' : 'text-slate-500'}`}>
                    {selectedType === 'RENEWAL' ? 'Selected ✓' : 'Select'}
                  </span>
                </div>
              </button>

              {/* 3. Change Motor Card */}
              <button
                type="button"
                onClick={() => setSelectedType('CHANGE_MOTOR')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between relative cursor-pointer ${
                  selectedType === 'CHANGE_MOTOR'
                    ? 'border-teal-400 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 shadow-xl ring-2 ring-teal-500/40 text-white'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2.5 rounded-xl ${selectedType === 'CHANGE_MOTOR' ? 'bg-teal-500 text-slate-950 shadow-sm font-black' : 'bg-slate-800 text-teal-400'}`}>
                      <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    Change Motor
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-1 line-clamp-2 leading-tight">
                    Engine replacement or motorcycle unit swap.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <span className="font-bold text-slate-400">{waitingChangeMotor} in queue</span>
                  <span className={`font-bold ${selectedType === 'CHANGE_MOTOR' ? 'text-teal-300' : 'text-slate-500'}`}>
                    {selectedType === 'CHANGE_MOTOR' ? 'Selected ✓' : 'Select'}
                  </span>
                </div>
              </button>

              {/* 4. Order for Dropping Card */}
              <button
                type="button"
                onClick={() => setSelectedType('DROPPING')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between relative cursor-pointer ${
                  selectedType === 'DROPPING'
                    ? 'border-teal-400 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 shadow-xl ring-2 ring-teal-500/40 text-white'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2.5 rounded-xl ${selectedType === 'DROPPING' ? 'bg-teal-500 text-slate-950 shadow-sm font-black' : 'bg-slate-800 text-teal-400'}`}>
                      <FileMinus className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    Order for Dropping
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-1 line-clamp-2 leading-tight">
                    Franchise cancellation or unit retirement.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <span className="font-bold text-slate-400">{waitingDropping} in queue</span>
                  <span className={`font-bold ${selectedType === 'DROPPING' ? 'text-teal-300' : 'text-slate-500'}`}>
                    {selectedType === 'DROPPING' ? 'Selected ✓' : 'Select'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Priority Lane Assistance Card */}
          <div className="bg-amber-950/40 border-2 border-amber-600/60 rounded-2xl p-3 sm:p-4 shrink-0 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                  <Accessibility className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-300 leading-tight">
                    Priority Lane (RA 9994 & 7277)
                  </h4>
                  <p className="text-[11px] sm:text-xs text-amber-200/80 font-medium leading-tight">
                    Senior Citizens, PWDs, Pregnant, Solo Parents
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isPriority}
                  onChange={(e) => setIsPriority(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                <span className="ml-2.5 text-xs sm:text-sm font-black text-amber-300">
                  {isPriority ? 'Active' : 'Off'}
                </span>
              </label>
            </div>

            {isPriority && (
              <div className="mt-2.5 pt-2.5 border-t border-amber-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-150">
                {(['Senior Citizen', 'Person with Disability (PWD)', 'Pregnant', 'Solo Parent with Infant'] as const).map((reason) => (
                  <button
                    type="button"
                    key={reason}
                    onClick={() => setPriorityReason(reason)}
                    className={`py-2 px-2.5 text-xs font-bold rounded-xl border text-center transition-all truncate cursor-pointer ${
                      priorityReason === reason
                        ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                        : 'bg-slate-900 text-amber-200 border-amber-700/80 hover:bg-slate-800'
                    }`}
                  >
                    {reason.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Municipal Advisory */}
          <div className="bg-slate-900 text-slate-300 rounded-2xl px-4 py-2.5 border border-slate-800 flex items-center gap-3 text-xs sm:text-sm shrink-0">
            <Printer className="w-5 h-5 text-teal-400 shrink-0" />
            <span className="text-xs sm:text-sm text-slate-300 leading-tight font-medium">
              Take your printed ticket and wait in the lobby. Your ticket number will be announced on the speakers and displayed on the Lobby TV.
            </span>
          </div>
        </div>

        {/* Right Column (7 Cols): Applicant Details Form & Large Dispense Button */}
        <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl flex flex-col justify-between overflow-hidden h-full">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div>
              <span className="text-sm sm:text-base font-black uppercase tracking-wider text-white block">
                Step 2: Enter Applicant Information
              </span>
              <span className="text-xs font-bold text-teal-400">
                Transaction: {getFranchiseTypeLabel(selectedType)}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              * marked fields are required
            </span>
          </div>

          {/* Input Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1 content-start py-3 overflow-y-auto">
            {/* Contextual notice when existing record is required */}
            {isExistingRequired && (
              <div className="sm:col-span-2 p-2.5 rounded-xl bg-slate-900/90 border border-teal-500/40 text-teal-200 text-xs flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-teal-400 shrink-0" />
                <span>
                  For <strong>{getFranchiseTypeLabel(selectedType)}</strong>, only the <strong>Body Number</strong> is enabled. Applicant and franchise details are locked and auto-loaded from the official MTFRB registry.
                </span>
              </div>
            )}

            {/* 1. Body Number / Ticket Number - FIRST FIELD (Always Enabled) */}
            <div className={isExistingRequired ? "sm:col-span-2" : "sm:col-span-1"}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-black text-amber-300">
                  Body Number (Queue Ticket Number) {isExistingRequired && <span className="text-rose-400">*</span>}
                </label>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  isExistingRequired 
                    ? matchedFranchise 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/60'
                      : bodyNumber.trim()
                      ? 'bg-rose-950 text-rose-300 border border-rose-600/60'
                      : 'bg-amber-950 text-amber-300 border border-amber-600/60'
                    : 'bg-teal-950 text-teal-300 border border-teal-600/60'
                }`}>
                  {isExistingRequired 
                    ? matchedFranchise
                      ? '✓ Database Verified'
                      : bodyNumber.trim()
                      ? 'Record Not Found'
                      : 'Database Verification Required'
                    : 'Official Ticket #'}
                </span>
              </div>
              <div className="relative">
                <Hash className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isCurrentBodyUsed 
                    ? 'text-rose-400' 
                    : isExistingRequired && bodyNumber.trim() && !matchedFranchise
                    ? 'text-rose-400'
                    : matchedFranchise
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`} />
                <input
                  type="text"
                  required={isExistingRequired}
                  value={bodyNumber}
                  onChange={(e) => handleBodyNumberChange(e.target.value)}
                  placeholder={
                    isExistingRequired
                      ? "Enter registered Body Number (e.g. 001, 014, 042...)"
                      : "e.g. 042 or leave blank for auto-generated ticket #"
                  }
                  className={`w-full pl-11 pr-3.5 py-3 sm:py-3.5 text-sm sm:text-base bg-slate-950 border-2 rounded-xl focus:ring-2 outline-hidden uppercase font-black placeholder:text-slate-600 ${
                    isCurrentBodyUsed || (isExistingRequired && bodyNumber.trim() && !matchedFranchise)
                      ? 'border-rose-500 text-rose-300 focus:ring-rose-400 focus:border-rose-400' 
                      : matchedFranchise
                      ? 'border-emerald-500 text-emerald-200 focus:ring-emerald-400 focus:border-emerald-400'
                      : 'border-amber-500/60 text-amber-300 focus:ring-amber-400 focus:border-amber-400'
                  }`}
                />
              </div>

              {/* Status and Feedback below Body Number */}
              {isCurrentBodyUsed ? (
                <div className="mt-1.5 p-2.5 rounded-lg bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 animate-ping"></span>
                  <span>⚠️ Body Number <strong>"{bodyNumber.trim()}"</strong> is currently in the queue and cannot be added again.</span>
                </div>
              ) : isExistingRequired && bodyNumber.trim() && !matchedFranchise ? (
                <div className="mt-1.5 p-2.5 rounded-lg bg-rose-950/90 border border-rose-600 text-rose-200 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span>⚠️ No existing franchise record found for Body Number <strong>"{bodyNumber.trim()}"</strong> in the database.</span>
                    <p className="text-[11px] text-rose-300/90 font-normal mt-0.5">
                      For {getFranchiseTypeLabel(selectedType)}, the tricycle must already be registered in the MTFRB registry.
                    </p>
                  </div>
                </div>
              ) : isExistingRequired && matchedFranchise ? (
                <div className="mt-1.5 p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-600 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>✓ Verified: <strong className="text-white">{matchedFranchise.operatorName || matchedFranchise.driverName || 'Operator'}</strong> ({matchedFranchise.routeZone || matchedFranchise.zone || 'Zone 1'})</span>
                  </div>
                  <span className="text-[10px] text-emerald-300 bg-emerald-900/80 px-2 py-0.5 rounded font-mono font-bold">
                    {matchedFranchise.franchiseNumber || 'Active Permit'}
                  </span>
                </div>
              ) : bodyNumberError ? (
                <div className="mt-1.5 p-2 rounded-lg bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                  <span>{bodyNumberError}</span>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">
                  {isExistingRequired 
                    ? "In MTFRB Castillejos, your registered Body Number is your official Queue Ticket Number on the Lobby TV."
                    : "Your body number will be your official Queue Ticket Number. Leave blank to auto-generate."}
                </p>
              )}
            </div>

            {/* 2. Applicant Full Name (Disabled for Renewal, Change Motor, Dropping) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-200">
                  Applicant Full Name {isExistingRequired ? <span className="text-slate-500 font-normal text-[11px]">(Auto-loaded)</span> : <span className="text-rose-400">*</span>}
                </label>
                {isExistingRequired && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </div>
              <div className="relative">
                <User className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  disabled={isExistingRequired}
                  required={!isExistingRequired}
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder={isExistingRequired ? "Auto-filled from registry once body # is entered" : "e.g. Juan C. Dela Cruz"}
                  className={`w-full pl-11 pr-3.5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl outline-hidden font-medium ${
                    isExistingRequired
                      ? 'bg-slate-950/60 border-2 border-slate-800/80 text-slate-300 cursor-not-allowed select-none placeholder:text-slate-600'
                      : 'bg-slate-950 border-2 border-slate-700 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-400 focus:border-teal-400'
                  }`}
                />
              </div>
            </div>

            {/* 3. Franchise Zone (Disabled for Renewal, Change Motor, Dropping) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-200">
                  Zone / Route {isExistingRequired ? <span className="text-slate-500 font-normal text-[11px]">(Auto-loaded)</span> : <span className="text-rose-400">*</span>}
                </label>
                {isExistingRequired && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </div>
              <select
                disabled={isExistingRequired}
                value={zone}
                onChange={(e) => setZone(e.target.value as FranchiseZone)}
                className={`w-full px-3.5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl outline-hidden font-bold ${
                  isExistingRequired
                    ? 'bg-slate-950/60 border-2 border-slate-800/80 text-slate-300 cursor-not-allowed select-none'
                    : 'bg-slate-950 border-2 border-slate-700 text-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 cursor-pointer'
                }`}
              >
                {FRANCHISE_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Classification (Disabled for Renewal, Change Motor, Dropping) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-200">
                  Classification {isExistingRequired ? <span className="text-slate-500 font-normal text-[11px]">(Auto-loaded)</span> : <span className="text-rose-400">*</span>}
                </label>
                {isExistingRequired && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </div>
              <select
                disabled={isExistingRequired}
                value={classification}
                onChange={(e) => setClassification(e.target.value as ApplicantClassification)}
                className={`w-full px-3.5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl outline-hidden font-bold ${
                  isExistingRequired
                    ? 'bg-slate-950/60 border-2 border-slate-800/80 text-slate-300 cursor-not-allowed select-none'
                    : 'bg-slate-950 border-2 border-slate-700 text-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 cursor-pointer'
                }`}
              >
                {CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Existing Franchise No. (Disabled for Renewal, Change Motor, and Dropping) */}
            {selectedType !== 'NEW' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-slate-200">
                    Existing Franchise No. <span className="text-slate-500 font-normal text-[11px]">(Auto-loaded)</span>
                  </label>
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </div>
                <div className="relative">
                  <FileText className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled={true}
                    value={franchiseNumber}
                    onChange={(e) => setFranchiseNumber(e.target.value)}
                    placeholder="Auto-filled from registry"
                    className="w-full pl-11 pr-3.5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl outline-hidden font-mono uppercase font-bold bg-slate-950/60 border-2 border-slate-800/80 text-slate-300 cursor-not-allowed select-none placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* 6. Contact Mobile Number (Disabled for Renewal, Change Motor, Dropping) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-200">
                  Contact Mobile No. {isExistingRequired && <span className="text-slate-500 font-normal text-[11px]">(Auto-loaded)</span>}
                </label>
                {isExistingRequired && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </div>
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  disabled={isExistingRequired}
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder={isExistingRequired ? "Registered phone number" : "e.g. 09171234567"}
                  className={`w-full pl-11 pr-3.5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl outline-hidden font-medium ${
                    isExistingRequired
                      ? 'bg-slate-950/60 border-2 border-slate-800/80 text-slate-300 cursor-not-allowed select-none placeholder:text-slate-600'
                      : 'bg-slate-950 border-2 border-slate-700 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-400 focus:border-teal-400'
                  }`}
                />
              </div>
            </div>

            {/* 7. Email Address (Disabled for Renewal, Change Motor, Dropping) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-200">
                  Email Address {isExistingRequired && <span className="text-slate-500 font-normal text-[11px]">(Auto-loaded)</span>}
                </label>
                {isExistingRequired && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </div>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  disabled={isExistingRequired}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isExistingRequired ? "Registered email address" : "e.g. applicant@email.com"}
                  className={`w-full pl-11 pr-3.5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl outline-hidden font-medium ${
                    isExistingRequired
                      ? 'bg-slate-950/60 border-2 border-slate-800/80 text-slate-300 cursor-not-allowed select-none placeholder:text-slate-600'
                      : 'bg-slate-950 border-2 border-slate-700 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-400 focus:border-teal-400'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar with Big Touch Dispense Button */}
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2 shrink-0">
            <button
              type="submit"
              disabled={
                isCurrentBodyUsed ||
                (isExistingRequired 
                  ? (!bodyNumber.trim() || !matchedFranchise) 
                  : !applicantName.trim())
              }
              className="w-full py-3.5 sm:py-4 px-8 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-base sm:text-lg md:text-xl rounded-2xl shadow-xl shadow-teal-950/80 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99]"
            >
              <span>Dispense Official Queue Ticket</span>
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="text-center text-xs text-slate-400 font-medium">
              {isExistingRequired && !matchedFranchise
                ? "⚠️ Enter a registered Body Number above to verify database record and dispense your queue ticket."
                : "Ticket slip with QR code will be generated with your queue position and date stamp."
              }
            </div>
          </div>
        </div>
      </form>

      {/* Ticket Slip Modal */}
      {activeTicket && (
        <TicketSlipModal
          ticket={activeTicket}
          queuePosition={estimatedData.position}
          estimatedMinutes={estimatedData.estimatedMinutes}
          onClose={() => setActiveTicket(null)}
        />
      )}

      {/* Requirements Checklist Modal (Centered overlay matching Lobby TV theme) */}
      {showChecklistModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-800 flex flex-col max-h-[90vh] text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-950 text-teal-400 border border-teal-700/60 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Official Document Checklist
                  </h3>
                  <p className="text-xs text-slate-400">
                    Prepare original and photocopies before proceeding to Counter stations
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

            {/* Checklist Tabs for all 4 types */}
            <div className="flex flex-wrap gap-1.5 pt-3 pb-2 border-b border-slate-800">
              {(['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'] as FranchiseType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChecklistTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    checklistTab === t
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {getFranchiseTypeLabel(t)}
                </button>
              ))}
            </div>

            <div className="py-3 space-y-2.5 overflow-y-auto flex-1 text-xs">
              {activeDocuments.map((doc, idx) => (
                <div key={doc.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-white text-sm">{doc.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{doc.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Total: <strong className="text-teal-400">{activeDocuments.length} required items</strong> for {getFranchiseTypeLabel(checklistTab)}
              </span>
              <button
                type="button"
                onClick={() => setShowChecklistModal(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Record Verification Prompt Modal */}
      {recordPromptModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border-2 border-amber-500/70 flex flex-col text-white space-y-4">
            <div className="flex items-start gap-3.5 pb-3 border-b border-slate-800">
              <div className="p-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-white">
                  {recordPromptModal.title}
                </h3>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {getFranchiseTypeLabel(recordPromptModal.type)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRecordPromptModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-xs">
                <div className="text-slate-400 text-[11px] uppercase font-bold">Entered Body / Ticket Number:</div>
                <div className="text-amber-300 font-black text-base mt-0.5">
                  {recordPromptModal.bodyNumber ? `#${recordPromptModal.bodyNumber}` : '(Empty / Not Provided)'}
                </div>
              </div>

              <p className="whitespace-pre-line text-xs sm:text-sm text-slate-200">
                {recordPromptModal.message}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('NEW');
                  setRecordPromptModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Switch to New Franchise
              </button>
              <button
                type="button"
                onClick={() => setRecordPromptModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black transition-all shadow-md cursor-pointer"
              >
                Check / Re-enter Body Number
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
