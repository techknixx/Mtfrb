import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  CheckCircle,
  XCircle, 
  Printer, 
  Save, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  ClipboardCheck, 
  Search, 
  FileText, 
  Check, 
  X,
  ExternalLink,
  Car,
  Camera,
  Upload,
  Eye,
  Trash2,
  Zap,
  ArrowRight
} from 'lucide-react';
import { 
  TricycleInspectionChecklist, 
  createDefaultInspectionChecklist, 
  TricycleFranchiseRecord,
  Ticket 
} from '../types';
import { 
  getInspectionChecklist, 
  saveInspectionChecklist, 
  getFranchiseRecordByBodyNumber,
  saveInspectionPhotosToServer,
  transferTicketToPaymentCounter
} from '../utils/storage';
import { soundManager } from '../utils/audio';
import { MTFRB_LOGO } from '../assets/logo';
import { 
  InspectionPhotoCaptureModal, 
  InspectionPhotoSlot, 
  INSPECTION_PHOTO_SLOTS 
} from './InspectionPhotoCaptureModal';

interface InspectionChecklistSectionProps {
  bodyNumber: string;
  inspectorName?: string;
  currentTicket?: Ticket | null;
  onChecklistSaved?: (checklist: TricycleInspectionChecklist) => void;
  onCompleteInspection?: (checklist: TricycleInspectionChecklist) => void;
  onBodyNumberChange?: (newBody: string) => void;
  readOnly?: boolean;
}

export const InspectionChecklistSection: React.FC<InspectionChecklistSectionProps> = ({
  bodyNumber,
  inspectorName = 'Carmela Dizon',
  currentTicket,
  onChecklistSaved,
  onCompleteInspection,
  onBodyNumberChange,
  readOnly = false,
}) => {
  const [activeBody, setActiveBody] = useState<string>(bodyNumber || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [checklist, setChecklist] = useState<TricycleInspectionChecklist>(() =>
    getInspectionChecklist(bodyNumber || '001')
  );
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [activePhotoSlot, setActivePhotoSlot] = useState<InspectionPhotoSlot>('frontImage');
  const [selectedViewingPhoto, setSelectedViewingPhoto] = useState<{ url: string; title: string } | null>(null);

  // Sync when bodyNumber prop changes
  useEffect(() => {
    if (bodyNumber && bodyNumber !== activeBody) {
      setActiveBody(bodyNumber);
      const loaded = getInspectionChecklist(bodyNumber);
      setChecklist(loaded);
    }
  }, [bodyNumber]);

  // Load franchise record for additional metadata
  const franchiseRecord = useMemo(() => {
    if (!activeBody) return null;
    return getFranchiseRecordByBodyNumber(activeBody);
  }, [activeBody]);

  // Compute non-compliant/failed items count
  const failReasons = useMemo(() => {
    const issues: string[] = [];
    if (checklist.headlight === 'Non-Functional') issues.push('Non-functional Headlight');
    if (checklist.signalLights === 'Non-Functional') issues.push('Non-functional Signal Lights');
    if (checklist.tailLight === 'Non-Functional') issues.push('Non-functional Tail Light');
    if (checklist.horn === 'Non-Functional') issues.push('Non-functional Horn');
    if (checklist.battery === 'Non-Functional') issues.push('Non-functional Battery');
    if (checklist.backRideGuard === 'Without') issues.push('Missing Back Ride Guard');
    if (checklist.sideMirrors === 'Without') issues.push('Missing Side Mirrors');
    if (checklist.muffler === 'Modified') issues.push('Modified Muffler (Noise/Emission Violation)');
    if (checklist.handle === 'Modified') issues.push('Modified Handle');
    if (checklist.frontTire === 'Sub-Standard') issues.push('Sub-Standard Front Tire');
    if (checklist.backTire === 'Sub-Standard') issues.push('Sub-Standard Back Tire');
    if (checklist.sidecarTire === 'Sub-Standard') issues.push('Sub-Standard Sidecar Tire');
    if (checklist.wheelCover === 'Without') issues.push('Missing Wheel Cover');
    if (checklist.sidecarReflector === 'Without') issues.push('Missing Sidecar Reflector');
    if (checklist.sidecarLight === 'Non-Functional') issues.push('Non-functional Sidecar Light');
    if (!checklist.bodyNumberFront || !checklist.bodyNumberBack || !checklist.bodyNumberTop) {
      issues.push('Body number stencil incomplete (Must be on Front, Back & Top)');
    }
    if (checklist.fareMatrix === 'Without') issues.push('Missing Official Fare Matrix');
    if (!checklist.sizeHeightCompliant) issues.push('Height non-compliant (Must be 114 cm)');
    if (!checklist.sizeWidthCompliant) issues.push('Width non-compliant (Must be 73.60 cm)');
    if (!checklist.clearanceCompliant) issues.push('Ground clearance non-compliant (Must be 10.5 cm)');
    return issues;
  }, [checklist]);

  const hasDefects = failReasons.length > 0;

  const handleUpdateField = <K extends keyof TricycleInspectionChecklist>(
    key: K,
    val: TricycleInspectionChecklist[K]
  ) => {
    if (readOnly) return;
    if (key === 'status' && val === 'PASSED' && hasDefects) {
      alert(`Cannot set status to PASSED: Tricycle has ${failReasons.length} unresolved defect(s). Resolve all defects before certifying as PASSED.`);
      return;
    }
    setChecklist((prev) => ({
      ...prev,
      [key]: val,
      // Auto adjust status if critical violations occur
      status: key === 'status' ? (val as 'PASSED' | 'FAILED') : prev.status,
    }));
  };

  const handleSetAllStandard = () => {
    if (readOnly) return;
    setChecklist((prev) => ({
      ...createDefaultInspectionChecklist(activeBody, inspectorName),
      inspectorName: prev.inspectorName || inspectorName,
      inspectionDate: prev.inspectionDate || new Date().toISOString().slice(0, 10),
      sidecarColor: prev.sidecarColor || 'Blue',
      frontImage: prev.frontImage,
      oppositeSideImage: prev.oppositeSideImage,
      backImage: prev.backImage,
      motorSideImage: prev.motorSideImage,
      remarks: 'All parts inspected & verified standard. Compliant with MTFRB Roadworthiness Ordinance.',
      status: 'PASSED',
    }));
  };

  const handleOpenPhotoModal = (slot: InspectionPhotoSlot = 'frontImage') => {
    setActivePhotoSlot(slot);
    setShowPhotoModal(true);
  };

  const handleSavePhotos = (newPhotos: {
    frontImage?: string;
    oppositeSideImage?: string;
    backImage?: string;
    motorSideImage?: string;
  }) => {
    const updatedChecklist: TricycleInspectionChecklist = {
      ...checklist,
      ...newPhotos,
      bodyNumber: activeBody,
      operatorName: currentTicket?.applicantName || franchiseRecord?.operatorName || checklist.operatorName,
      driverName: currentTicket?.driverName || franchiseRecord?.driverName || checklist.driverName,
      plateNumber: currentTicket?.plateOrUnitNumber || franchiseRecord?.plateNumber || checklist.plateNumber,
      makeModel: franchiseRecord?.makeModel || checklist.makeModel,
      motorNumber: franchiseRecord?.motorNumber || checklist.motorNumber,
      chassisNumber: franchiseRecord?.chassisNumber || checklist.chassisNumber,
      verifiedAt: Date.now(),
    };
    setChecklist(updatedChecklist);
    // Requirement 1: Always save photo into the database immediately
    saveInspectionChecklist(updatedChecklist);
    if (activeBody) {
      saveInspectionPhotosToServer(activeBody, newPhotos);
    }
    onChecklistSaved?.(updatedChecklist);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearPhoto = (slot: InspectionPhotoSlot) => {
    if (readOnly) return;
    const updatedChecklist: TricycleInspectionChecklist = {
      ...checklist,
      [slot]: undefined,
      bodyNumber: activeBody,
      verifiedAt: Date.now(),
    };
    setChecklist(updatedChecklist);
    // Always save photo update into the database
    saveInspectionChecklist(updatedChecklist);
    onChecklistSaved?.(updatedChecklist);
  };

  // Requirement 2 & 3: Single Unified Save to Database & Complete Inspection Handler
  // Even if there are detected defects or Non-compliance, data is saved to database but marked as FAILED
  const handleSaveAndComplete = () => {
    if (!activeBody) return;

    const finalStatus: 'PASSED' | 'FAILED' = hasDefects ? 'FAILED' : (checklist.status === 'FAILED' ? 'FAILED' : 'PASSED');

    const remarksText = hasDefects
      ? (checklist.remarks && checklist.remarks.includes('Defects')
          ? checklist.remarks
          : `Defects/Non-compliance recorded (${failReasons.length}): ${failReasons.join(', ')}. ${checklist.remarks || ''}`.trim())
      : (checklist.remarks || 'Officially inspected and certified roadworthy compliant by MTFRB Vehicle Inspector.');

    const finalChecklist: TricycleInspectionChecklist = {
      ...checklist,
      bodyNumber: activeBody,
      inspectorName: checklist.inspectorName || inspectorName,
      status: finalStatus,
      inspectionDate: checklist.inspectionDate || new Date().toISOString().slice(0, 10),
      verifiedAt: Date.now(),
      remarks: remarksText,
      operatorName: currentTicket?.applicantName || franchiseRecord?.operatorName || checklist.operatorName,
      driverName: currentTicket?.driverName || franchiseRecord?.driverName || checklist.driverName,
      plateNumber: currentTicket?.plateOrUnitNumber || franchiseRecord?.plateNumber || checklist.plateNumber,
      makeModel: franchiseRecord?.makeModel || checklist.makeModel,
      motorNumber: franchiseRecord?.motorNumber || checklist.motorNumber,
      chassisNumber: franchiseRecord?.chassisNumber || checklist.chassisNumber,
    };

    // Always save all inspection information & photos to database
    saveInspectionChecklist(finalChecklist);
    setChecklist(finalChecklist);

    // Transfer client to Payments Counter (Counter 4)
    const targetIdentifier = currentTicket?.id || activeBody;
    const transferResult = transferTicketToPaymentCounter(targetIdentifier, finalChecklist);

    soundManager.playTransferChime(
      currentTicket?.ticketNumber || activeBody,
      'Payment Counter',
      'Inspection Station'
    );

    if (onCompleteInspection) {
      onCompleteInspection(finalChecklist);
    } else {
      onChecklistSaved?.(finalChecklist);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 5000);
  };

  const handleLoadBody = (targetBody: string) => {
    const clean = targetBody.trim();
    if (!clean) return;
    setActiveBody(clean);
    onBodyNumberChange?.(clean);
    const loaded = getInspectionChecklist(clean);
    setChecklist(loaded);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base tracking-tight text-white">
                Official MTFRB Physical Inspection Checklist
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-teal-400/20 text-teal-300 border border-teal-400/30">
                Roadworthiness
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Connected to Main Database via Body Number: <strong className="text-amber-300 font-mono text-sm">{activeBody || 'Unassigned'}</strong>
              {franchiseRecord && ` • ${franchiseRecord.operatorName} (${franchiseRecord.makeModel || 'Tricycle'})`}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setActivePhotoSlot('frontImage');
                setShowPhotoModal(true);
              }}
              className="px-3.5 py-1.5 text-xs font-black rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md transition-all flex items-center gap-1.5 cursor-pointer ring-2 ring-amber-400/40 active:scale-95"
              title="Open Inspection Camera immediately to photograph vehicle from all 4 mandatory angles"
            >
              <Zap className="w-3.5 h-3.5 text-slate-950" />
              <span>Inspection Camera</span>
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={handleSetAllStandard}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Quick-fill all components as Functional / Standard / Compliant"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Pass All Standard</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Print official municipal inspection checklist sheet"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>

          {!readOnly && (
            <button
              id="header-save-complete-btn"
              type="button"
              onClick={handleSaveAndComplete}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                hasDefects
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={
                hasDefects
                  ? `Save inspection report to database marked as FAILED (${failReasons.length} defect(s) detected)`
                  : 'Save roadworthy certification to database marked as PASSED'
              }
            >
              {hasDefects ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>{hasDefects ? `Save Inspection (Failed - ${failReasons.length})` : 'Save & Complete Inspection'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Success / Status Banner */}
      {saveSuccess && (
        <div className={`p-3 border-b text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 ${
          checklist.status === 'FAILED'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {checklist.status === 'FAILED' ? (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>
              Inspection Checklist for Body Number <strong>{activeBody}</strong> saved to Database (Status: <strong>{checklist.status}</strong>). Client automatically transferred to <strong>Payments Counter (Counter 4)</strong>.
            </span>
          </div>
          <button onClick={() => setSaveSuccess(false)} className={checklist.status === 'FAILED' ? 'text-rose-700 hover:text-rose-900' : 'text-emerald-700 hover:text-emerald-900'}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Body Number Switcher & Inspector Metadata Bar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Inspecting Body #:</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeBody || 'Enter Body #'}
              className="w-28 px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLoadBody(searchQuery);
                  setSearchQuery('');
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim()) {
                  handleLoadBody(searchQuery);
                  setSearchQuery('');
                }
              }}
              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
            >
              Load
            </button>
          </div>
          {currentTicket && currentTicket.bodyNumber && currentTicket.bodyNumber !== activeBody && (
            <button
              type="button"
              onClick={() => handleLoadBody(currentTicket.bodyNumber!)}
              className="text-teal-700 underline hover:text-teal-900 font-medium"
            >
              Load Current Ticket Body ({currentTicket.bodyNumber})
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Inspector:</span>
            <input
              type="text"
              disabled={readOnly}
              value={checklist.inspectorName || inspectorName}
              onChange={(e) => handleUpdateField('inspectorName', e.target.value)}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-semibold w-36"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Date:</span>
            <input
              type="date"
              disabled={readOnly}
              value={checklist.inspectionDate || new Date().toISOString().slice(0, 10)}
              onChange={(e) => handleUpdateField('inspectionDate', e.target.value)}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-medium"
            />
          </div>

          {/* Compliance Status Badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Result:</span>
            <select
              disabled={readOnly}
              value={checklist.status}
              onChange={(e) => handleUpdateField('status', e.target.value as 'PASSED' | 'FAILED')}
              className={`px-2 py-0.5 rounded font-black text-xs uppercase border ${
                checklist.status === 'PASSED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
            >
              <option value="PASSED">PASSED</option>
              <option value="FAILED">FAILED / CONDITIONAL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Defect Alert if issues detected */}
      {hasDefects && (
        <div className="p-3 bg-amber-50/80 border-b border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Detected Defects/Non-Compliances ({failReasons.length}):</span>
            <span className="ml-1 text-amber-800">{failReasons.join(' • ')}</span>
            <p className="text-[11px] text-rose-700 font-bold mt-1">
              Notice: Under MTFRB policy, tricycles cannot be marked PASSED until all defect items are resolved.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 MANDATORY INSPECTION PHOTOGRAPHS (Requirement 5 & 6) */}
      {/* ========================================================================= */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                <span>Official MTFRB Vehicle Inspection Photographs</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                  4 Angles Required
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Front View • Opposite Sidecar • Rear/Plate • Motor & Engine Side
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                [checklist.frontImage, checklist.oppositeSideImage, checklist.backImage, checklist.motorSideImage].filter(Boolean).length === 4
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {[checklist.frontImage, checklist.oppositeSideImage, checklist.backImage, checklist.motorSideImage].filter(Boolean).length}/4 Captured
            </span>

            {!readOnly && (
              <button
                type="button"
                onClick={() => handleOpenPhotoModal('frontImage')}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
              >
                <Zap className="w-3.5 h-3.5 text-slate-950" />
                <span>
                  {[checklist.frontImage, checklist.oppositeSideImage, checklist.backImage, checklist.motorSideImage].filter(Boolean).length === 4
                    ? 'Review / Retake Photos'
                    : 'Open Vehicle Camera'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Photo Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {INSPECTION_PHOTO_SLOTS.map((slot) => {
            const photoUrl = checklist[slot.id];
            const hasPhoto = Boolean(photoUrl);

            return (
              <div
                key={slot.id}
                className={`rounded-xl border overflow-hidden transition-all bg-white flex flex-col ${
                  hasPhoto ? 'border-teal-300 shadow-xs' : 'border-slate-300 border-dashed bg-slate-50/50'
                }`}
              >
                {/* Photo Preview or Placeholder */}
                <div className="relative aspect-4/3 bg-slate-900 flex items-center justify-center overflow-hidden group">
                  {hasPhoto ? (
                    <>
                      <img
                        src={photoUrl}
                        alt={slot.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {/* Hover Overlay with Quick Actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        <button
                          type="button"
                          onClick={() => setSelectedViewingPhoto({ url: photoUrl!, title: `${slot.label} - Body #${activeBody}` })}
                          className="p-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer"
                          title="Zoom photo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleOpenPhotoModal(slot.id)}
                            className="p-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer"
                            title="Retake this photo"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white shadow-xs">
                        Captured
                      </span>
                    </>
                  ) : (
                    <div className="text-center p-3">
                      <Camera className="w-8 h-8 text-slate-400 mx-auto mb-1 opacity-60" />
                      <span className="text-[11px] font-bold text-slate-500 block">No Photo</span>
                      <span className="text-[9px] text-slate-400 block truncate">{slot.tip}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Info & Buttons */}
                <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2 bg-white">
                  <div>
                    <span className="text-xs font-black text-slate-900 block truncate">
                      {slot.label}
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                      {slot.guideText}
                    </span>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenPhotoModal(slot.id)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          hasPhoto
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs'
                        }`}
                      >
                        <Camera className="w-3 h-3" />
                        <span>{hasPhoto ? 'Retake' : 'Take Photo'}</span>
                      </button>

                      {hasPhoto && (
                        <button
                          type="button"
                          onClick={() => handleClearPhoto(slot.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Physical Checklist Content (Matching Photo Layout) */}
      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECTION 1: MOTOR */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                1. MOTOR
              </span>
              <span className="text-[11px] font-bold text-slate-500 uppercase">REMARKS</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {/* Headlight */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Headlight</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="headlight"
                      disabled={readOnly}
                      checked={checklist.headlight === 'Functional'}
                      onChange={() => handleUpdateField('headlight', 'Functional')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.headlight === 'Functional' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Functional
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="headlight"
                      disabled={readOnly}
                      checked={checklist.headlight === 'Non-Functional'}
                      onChange={() => handleUpdateField('headlight', 'Non-Functional')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.headlight === 'Non-Functional' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Non-Functional
                    </span>
                  </label>
                </div>
              </div>

              {/* Signal Lights */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Signal Lights</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="signalLights"
                      disabled={readOnly}
                      checked={checklist.signalLights === 'Functional'}
                      onChange={() => handleUpdateField('signalLights', 'Functional')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.signalLights === 'Functional' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Functional
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="signalLights"
                      disabled={readOnly}
                      checked={checklist.signalLights === 'Non-Functional'}
                      onChange={() => handleUpdateField('signalLights', 'Non-Functional')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.signalLights === 'Non-Functional' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Non-Functional
                    </span>
                  </label>
                </div>
              </div>

              {/* Tail Light */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Tail Light</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tailLight"
                      disabled={readOnly}
                      checked={checklist.tailLight === 'Functional'}
                      onChange={() => handleUpdateField('tailLight', 'Functional')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.tailLight === 'Functional' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Functional
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tailLight"
                      disabled={readOnly}
                      checked={checklist.tailLight === 'Non-Functional'}
                      onChange={() => handleUpdateField('tailLight', 'Non-Functional')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.tailLight === 'Non-Functional' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Non-Functional
                    </span>
                  </label>
                </div>
              </div>

              {/* Horn */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Horn</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="horn"
                      disabled={readOnly}
                      checked={checklist.horn === 'Functional'}
                      onChange={() => handleUpdateField('horn', 'Functional')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.horn === 'Functional' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Functional
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="horn"
                      disabled={readOnly}
                      checked={checklist.horn === 'Non-Functional'}
                      onChange={() => handleUpdateField('horn', 'Non-Functional')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.horn === 'Non-Functional' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Non-Functional
                    </span>
                  </label>
                </div>
              </div>

              {/* Battery */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Battery</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="battery"
                      disabled={readOnly}
                      checked={checklist.battery === 'Functional'}
                      onChange={() => handleUpdateField('battery', 'Functional')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.battery === 'Functional' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Functional
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="battery"
                      disabled={readOnly}
                      checked={checklist.battery === 'Non-Functional'}
                      onChange={() => handleUpdateField('battery', 'Non-Functional')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.battery === 'Non-Functional' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Non-Functional
                    </span>
                  </label>
                </div>
              </div>

              {/* Back Ride Guard */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Back Ride Guard</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="backRideGuard"
                      disabled={readOnly}
                      checked={checklist.backRideGuard === 'With'}
                      onChange={() => handleUpdateField('backRideGuard', 'With')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.backRideGuard === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      With
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="backRideGuard"
                      disabled={readOnly}
                      checked={checklist.backRideGuard === 'Without'}
                      onChange={() => handleUpdateField('backRideGuard', 'Without')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.backRideGuard === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Without
                    </span>
                  </label>
                </div>
              </div>

              {/* Side Mirrors */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Side Mirrors</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sideMirrors"
                      disabled={readOnly}
                      checked={checklist.sideMirrors === 'With'}
                      onChange={() => handleUpdateField('sideMirrors', 'With')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.sideMirrors === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      With
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sideMirrors"
                      disabled={readOnly}
                      checked={checklist.sideMirrors === 'Without'}
                      onChange={() => handleUpdateField('sideMirrors', 'Without')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.sideMirrors === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Without
                    </span>
                  </label>
                </div>
              </div>

              {/* Muffler */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Muffler</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="muffler"
                      disabled={readOnly}
                      checked={checklist.muffler === 'Standard'}
                      onChange={() => handleUpdateField('muffler', 'Standard')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.muffler === 'Standard' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Standard
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="muffler"
                      disabled={readOnly}
                      checked={checklist.muffler === 'Modified'}
                      onChange={() => handleUpdateField('muffler', 'Modified')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.muffler === 'Modified' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Modified
                    </span>
                  </label>
                </div>
              </div>

              {/* Handle */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Handle</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="handle"
                      disabled={readOnly}
                      checked={checklist.handle === 'Standard'}
                      onChange={() => handleUpdateField('handle', 'Standard')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.handle === 'Standard' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Standard
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="handle"
                      disabled={readOnly}
                      checked={checklist.handle === 'Modified'}
                      onChange={() => handleUpdateField('handle', 'Modified')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.handle === 'Modified' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Modified
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION 2: TIRE SIZE / TYPE */}
            <div className="px-4 py-2.5 bg-slate-100 border-t border-b border-slate-200 flex items-center justify-between">
              <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                2. TIRE SIZE / TYPE
              </span>
              <span className="text-[11px] font-bold text-slate-500 uppercase">REMARKS</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {/* Front Tire */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Front</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="frontTire"
                      disabled={readOnly}
                      checked={checklist.frontTire === 'Standard'}
                      onChange={() => handleUpdateField('frontTire', 'Standard')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.frontTire === 'Standard' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Standard
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="frontTire"
                      disabled={readOnly}
                      checked={checklist.frontTire === 'Sub-Standard'}
                      onChange={() => handleUpdateField('frontTire', 'Sub-Standard')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.frontTire === 'Sub-Standard' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Sub-Standard
                    </span>
                  </label>
                </div>
              </div>

              {/* Back Tire */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Back</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="backTire"
                      disabled={readOnly}
                      checked={checklist.backTire === 'Standard'}
                      onChange={() => handleUpdateField('backTire', 'Standard')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.backTire === 'Standard' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Standard
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="backTire"
                      disabled={readOnly}
                      checked={checklist.backTire === 'Sub-Standard'}
                      onChange={() => handleUpdateField('backTire', 'Sub-Standard')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.backTire === 'Sub-Standard' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Sub-Standard
                    </span>
                  </label>
                </div>
              </div>

              {/* Sidecar Tire */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Sidecar</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sidecarTire"
                      disabled={readOnly}
                      checked={checklist.sidecarTire === 'Standard'}
                      onChange={() => handleUpdateField('sidecarTire', 'Standard')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.sidecarTire === 'Standard' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      Standard
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sidecarTire"
                      disabled={readOnly}
                      checked={checklist.sidecarTire === 'Sub-Standard'}
                      onChange={() => handleUpdateField('sidecarTire', 'Sub-Standard')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.sidecarTire === 'Sub-Standard' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Sub-Standard
                    </span>
                  </label>
                </div>
              </div>

              {/* Wheel Cover */}
              <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <span className="font-medium text-slate-800">Wheel Cover</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="wheelCover"
                      disabled={readOnly}
                      checked={checklist.wheelCover === 'With'}
                      onChange={() => handleUpdateField('wheelCover', 'With')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className={checklist.wheelCover === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                      With
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="wheelCover"
                      disabled={readOnly}
                      checked={checklist.wheelCover === 'Without'}
                      onChange={() => handleUpdateField('wheelCover', 'Without')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className={checklist.wheelCover === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                      Without
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: SIDE CAR & SECTION 4: SIZE */}
          <div className="space-y-6">
            {/* SIDE CAR */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                  3. SIDE CAR
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase">REMARKS</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {/* Sidecar Reflector */}
                <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Sidecar Reflector</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sidecarReflector"
                        disabled={readOnly}
                        checked={checklist.sidecarReflector === 'With'}
                        onChange={() => handleUpdateField('sidecarReflector', 'With')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className={checklist.sidecarReflector === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                        With
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sidecarReflector"
                        disabled={readOnly}
                        checked={checklist.sidecarReflector === 'Without'}
                        onChange={() => handleUpdateField('sidecarReflector', 'Without')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className={checklist.sidecarReflector === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                        Without
                      </span>
                    </label>
                  </div>
                </div>

                {/* Back Carrier */}
                <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Back Carrier</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="backCarrier"
                        disabled={readOnly}
                        checked={checklist.backCarrier === 'With'}
                        onChange={() => handleUpdateField('backCarrier', 'With')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className={checklist.backCarrier === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                        With
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="backCarrier"
                        disabled={readOnly}
                        checked={checklist.backCarrier === 'Without'}
                        onChange={() => handleUpdateField('backCarrier', 'Without')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className={checklist.backCarrier === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                        Without
                      </span>
                    </label>
                  </div>
                </div>

                {/* Back Cover */}
                <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Back Cover</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="backCover"
                        disabled={readOnly}
                        checked={checklist.backCover === 'With'}
                        onChange={() => handleUpdateField('backCover', 'With')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className={checklist.backCover === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                        With
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="backCover"
                        disabled={readOnly}
                        checked={checklist.backCover === 'Without'}
                        onChange={() => handleUpdateField('backCover', 'Without')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className={checklist.backCover === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                        Without
                      </span>
                    </label>
                  </div>
                </div>

                {/* Trash Can */}
                <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Trash Can</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="trashCan"
                        disabled={readOnly}
                        checked={checklist.trashCan === 'With'}
                        onChange={() => handleUpdateField('trashCan', 'With')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className={checklist.trashCan === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                        With
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="trashCan"
                        disabled={readOnly}
                        checked={checklist.trashCan === 'Without'}
                        onChange={() => handleUpdateField('trashCan', 'Without')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className={checklist.trashCan === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                        Without
                      </span>
                    </label>
                  </div>
                </div>

                {/* Sidecar Light */}
                <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Sidecar Light</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sidecarLight"
                        disabled={readOnly}
                        checked={checklist.sidecarLight === 'Functional'}
                        onChange={() => handleUpdateField('sidecarLight', 'Functional')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className={checklist.sidecarLight === 'Functional' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                        Functional
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sidecarLight"
                        disabled={readOnly}
                        checked={checklist.sidecarLight === 'Non-Functional'}
                        onChange={() => handleUpdateField('sidecarLight', 'Non-Functional')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className={checklist.sidecarLight === 'Non-Functional' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                        Non-Functional
                      </span>
                    </label>
                  </div>
                </div>

                {/* Type of Sidecar */}
                <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Type of Sidecar</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sidecarType"
                        disabled={readOnly}
                        checked={checklist.sidecarType === 'Standard'}
                        onChange={() => handleUpdateField('sidecarType', 'Standard')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className={checklist.sidecarType === 'Standard' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                        Standard
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sidecarType"
                        disabled={readOnly}
                        checked={checklist.sidecarType === 'Sub-Standard'}
                        onChange={() => handleUpdateField('sidecarType', 'Sub-Standard')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className={checklist.sidecarType === 'Sub-Standard' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                        Sub-Standard
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sidecarType"
                        disabled={readOnly}
                        checked={checklist.sidecarType === 'Volvo'}
                        onChange={() => handleUpdateField('sidecarType', 'Volvo')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={checklist.sidecarType === 'Volvo' ? 'font-bold text-indigo-700' : 'text-slate-600'}>
                        Volvo
                      </span>
                    </label>
                  </div>
                </div>

                {/* Body Number Locations Verified */}
                <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors bg-teal-50/30">
                  <div>
                    <span className="font-bold text-slate-900 block">Body Number Stencil Locations</span>
                    <span className="text-[10px] text-slate-500">Must be painted/stenciled clearly</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-slate-200">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={checklist.bodyNumberFront}
                        onChange={(e) => handleUpdateField('bodyNumberFront', e.target.checked)}
                        className="text-teal-600 rounded focus:ring-teal-500"
                      />
                      <span className="font-bold text-slate-800">Front</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-slate-200">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={checklist.bodyNumberBack}
                        onChange={(e) => handleUpdateField('bodyNumberBack', e.target.checked)}
                        className="text-teal-600 rounded focus:ring-teal-500"
                      />
                      <span className="font-bold text-slate-800">Back</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-slate-200">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={checklist.bodyNumberTop}
                        onChange={(e) => handleUpdateField('bodyNumberTop', e.target.checked)}
                        className="text-teal-600 rounded focus:ring-teal-500"
                      />
                      <span className="font-bold text-slate-800">Top</span>
                    </label>
                  </div>
                </div>

                {/* Fare Matrix */}
                <div className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Fare Matrix</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fareMatrix"
                        disabled={readOnly}
                        checked={checklist.fareMatrix === 'With'}
                        onChange={() => handleUpdateField('fareMatrix', 'With')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className={checklist.fareMatrix === 'With' ? 'font-bold text-teal-800' : 'text-slate-600'}>
                        With
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fareMatrix"
                        disabled={readOnly}
                        checked={checklist.fareMatrix === 'Without'}
                        onChange={() => handleUpdateField('fareMatrix', 'Without')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className={checklist.fareMatrix === 'Without' ? 'font-bold text-rose-700' : 'text-slate-600'}>
                        Without
                      </span>
                    </label>
                  </div>
                </div>

                {/* Side Car Color */}
                <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors">
                  <span className="font-medium text-slate-800">Side Car Color</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {['Blue', 'Red', 'Yellow', 'White', 'Green', 'Orange'].map((color) => {
                      const isSelected = checklist.sidecarColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleUpdateField('sidecarColor', color)}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-slate-900 text-white ring-2 ring-teal-500 shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: SIZE */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                  4. SIZE & CLEARANCE MEASUREMENTS
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase">COMPLIANCE</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {/* Height */}
                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div>
                    <span className="font-bold text-slate-800">Height</span>
                    <span className="text-slate-500 text-[11px] ml-1.5">(114 cm)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={checklist.sizeHeightCompliant}
                      onChange={(e) => handleUpdateField('sizeHeightCompliant', e.target.checked)}
                      className="text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className={checklist.sizeHeightCompliant ? 'font-bold text-teal-800' : 'text-slate-500'}>
                      {checklist.sizeHeightCompliant ? 'Compliant (114 cm)' : 'Non-compliant'}
                    </span>
                  </label>
                </div>

                {/* Width */}
                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div>
                    <span className="font-bold text-slate-800">Width</span>
                    <span className="text-slate-500 text-[11px] ml-1.5">(73.60 cm)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={checklist.sizeWidthCompliant}
                      onChange={(e) => handleUpdateField('sizeWidthCompliant', e.target.checked)}
                      className="text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className={checklist.sizeWidthCompliant ? 'font-bold text-teal-800' : 'text-slate-500'}>
                      {checklist.sizeWidthCompliant ? 'Compliant (73.60 cm)' : 'Non-compliant'}
                    </span>
                  </label>
                </div>

                {/* Clearance */}
                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div>
                    <span className="font-bold text-slate-800">Clearance between ground & spring</span>
                    <span className="text-slate-500 text-[11px] ml-1.5">(10.5 cm)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={checklist.clearanceCompliant}
                      onChange={(e) => handleUpdateField('clearanceCompliant', e.target.checked)}
                      className="text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className={checklist.clearanceCompliant ? 'font-bold text-teal-800' : 'text-slate-500'}>
                      {checklist.clearanceCompliant ? 'Compliant (10.5 cm)' : 'Non-compliant'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inspector Remarks & Notes */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Inspector Findings & Official Recommendations
          </label>
          <textarea
            disabled={readOnly}
            rows={2}
            value={checklist.remarks || ''}
            onChange={(e) => handleUpdateField('remarks', e.target.value)}
            placeholder="Enter notes regarding roadworthiness, stencil verification, or required corrections before franchise approval..."
            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Official Print Modal (Matches Physical Paper Sheet) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
            {/* Action buttons (hidden when printing) */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-700" />
                <span className="font-bold text-sm text-slate-900">
                  Print Official MTFRB Physical Inspection Sheet
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Official Municipal Sheet */}
            <div className="p-6 border-2 border-slate-800 rounded-lg text-slate-900 font-serif space-y-5 print:border-none print:p-0">
              {/* Header */}
              <div className="text-center space-y-1 border-b-2 border-slate-800 pb-3">
                <div className="flex items-center justify-center gap-3">
                  <img src={MTFRB_LOGO} alt="Seal" className="w-12 h-12 object-contain" />
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-slate-600 font-sans font-bold">
                      Republic of the Philippines • Province of Zambales
                    </h4>
                    <h2 className="text-base font-extrabold uppercase text-slate-950">
                      MUNICIPALITY OF CASTILLEJOS
                    </h2>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900">
                      Municipal Tricycle Franchising & Regulatory Board (MTFRB)
                    </h3>
                  </div>
                </div>
                <h1 className="text-sm font-black uppercase tracking-widest mt-2 pt-1 border-t border-slate-400">
                  MOTOR TRICYCLE ROADWORTHINESS & PHYSICAL INSPECTION REPORT
                </h1>
              </div>

              {/* Identification details */}
              <div className="grid grid-cols-3 gap-2 text-xs font-sans pb-2 border-b border-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">BODY NUMBER:</span>
                  <strong className="text-sm font-mono text-slate-900 font-extrabold">{activeBody}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">OPERATOR / OWNER:</span>
                  <strong className="text-xs text-slate-900">{franchiseRecord?.operatorName || 'Registered Applicant'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">INSPECTION DATE:</span>
                  <strong className="text-xs text-slate-900">{checklist.inspectionDate}</strong>
                </div>
              </div>

              {/* Table matching the exact photo */}
              <div className="grid grid-cols-2 gap-4 text-[11px] font-sans">
                {/* Left Column: MOTOR & TIRE */}
                <div className="space-y-3">
                  <table className="w-full border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="border border-slate-800 px-2 py-1 text-left uppercase">MOTOR</th>
                        <th className="border border-slate-800 px-2 py-1 text-center uppercase">REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Headlight', opt1: 'Functional', opt2: 'Non-Functional', val: checklist.headlight },
                        { label: 'Signal Lights', opt1: 'Functional', opt2: 'Non-Functional', val: checklist.signalLights },
                        { label: 'Tail Light', opt1: 'Functional', opt2: 'Non-Functional', val: checklist.tailLight },
                        { label: 'Horn', opt1: 'Functional', opt2: 'Non-Functional', val: checklist.horn },
                        { label: 'Battery', opt1: 'Functional', opt2: 'Non-Functional', val: checklist.battery },
                        { label: 'Back Ride Guard', opt1: 'With', opt2: 'Without', val: checklist.backRideGuard },
                        { label: 'Side Mirrors', opt1: 'With', opt2: 'Without', val: checklist.sideMirrors },
                        { label: 'Muffler', opt1: 'Standard', opt2: 'Modified', val: checklist.muffler },
                        { label: 'Handle', opt1: 'Standard', opt2: 'Modified', val: checklist.handle },
                      ].map((r, i) => (
                        <tr key={i}>
                          <td className="border border-slate-800 px-2 py-0.5 font-medium">{r.label}</td>
                          <td className="border border-slate-800 px-2 py-0.5 text-center">
                            <span className="mr-3">[{r.val === r.opt1 ? '✔' : ' '}] {r.opt1}</span>
                            <span>[{r.val === r.opt2 ? '✔' : ' '}] {r.opt2}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="border border-slate-800 px-2 py-1 text-left uppercase">TIRE SIZE / TYPE</th>
                        <th className="border border-slate-800 px-2 py-1 text-center uppercase">REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Front', opt1: 'Standard', opt2: 'Sub-Standard', val: checklist.frontTire },
                        { label: 'Back', opt1: 'Standard', opt2: 'Sub-Standard', val: checklist.backTire },
                        { label: 'Sidecar', opt1: 'Standard', opt2: 'Sub-Standard', val: checklist.sidecarTire },
                        { label: 'Wheel Cover', opt1: 'With', opt2: 'Without', val: checklist.wheelCover },
                      ].map((r, i) => (
                        <tr key={i}>
                          <td className="border border-slate-800 px-2 py-0.5 font-medium">{r.label}</td>
                          <td className="border border-slate-800 px-2 py-0.5 text-center">
                            <span className="mr-3">[{r.val === r.opt1 ? '✔' : ' '}] {r.opt1}</span>
                            <span>[{r.val === r.opt2 ? '✔' : ' '}] {r.opt2}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Right Column: SIDE CAR & SIZE */}
                <div className="space-y-3">
                  <table className="w-full border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="border border-slate-800 px-2 py-1 text-left uppercase">SIDE CAR</th>
                        <th className="border border-slate-800 px-2 py-1 text-center uppercase">REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Sidecar Reflector', opt1: 'With', opt2: 'Without', val: checklist.sidecarReflector },
                        { label: 'Back Carrier', opt1: 'With', opt2: 'Without', val: checklist.backCarrier },
                        { label: 'Back Cover', opt1: 'With', opt2: 'Without', val: checklist.backCover },
                        { label: 'Trash Can', opt1: 'With', opt2: 'Without', val: checklist.trashCan },
                        { label: 'Sidecar Light', opt1: 'Functional', opt2: 'Non-Functional', val: checklist.sidecarLight },
                      ].map((r, i) => (
                        <tr key={i}>
                          <td className="border border-slate-800 px-2 py-0.5 font-medium">{r.label}</td>
                          <td className="border border-slate-800 px-2 py-0.5 text-center">
                            <span className="mr-3">[{r.val === r.opt1 ? '✔' : ' '}] {r.opt1}</span>
                            <span>[{r.val === r.opt2 ? '✔' : ' '}] {r.opt2}</span>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="border border-slate-800 px-2 py-0.5 font-medium">Type of Sidecar</td>
                        <td className="border border-slate-800 px-2 py-0.5 text-center">
                          <span className="mr-2">[{checklist.sidecarType === 'Standard' ? '✔' : ' '}] Standard</span>
                          <span className="mr-2">[{checklist.sidecarType === 'Sub-Standard' ? '✔' : ' '}] Sub-Std</span>
                          <span>[{checklist.sidecarType === 'Volvo' ? '✔' : ' '}] Volvo</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-800 px-2 py-0.5 font-medium">Body Number</td>
                        <td className="border border-slate-800 px-2 py-0.5 text-center">
                          <span className="mr-2">[{checklist.bodyNumberFront ? '✔' : ' '}] Front</span>
                          <span className="mr-2">[{checklist.bodyNumberBack ? '✔' : ' '}] Back</span>
                          <span>[{checklist.bodyNumberTop ? '✔' : ' '}] Top</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-800 px-2 py-0.5 font-medium">Fare Matrix</td>
                        <td className="border border-slate-800 px-2 py-0.5 text-center">
                          <span className="mr-3">[{checklist.fareMatrix === 'With' ? '✔' : ' '}] With</span>
                          <span>[{checklist.fareMatrix === 'Without' ? '✔' : ' '}] Without</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-800 px-2 py-0.5 font-medium">Side Car Color</td>
                        <td className="border border-slate-800 px-2 py-0.5 text-center font-bold">
                          {checklist.sidecarColor}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="border border-slate-800 px-2 py-1 text-left uppercase">SIZE</th>
                        <th className="border border-slate-800 px-2 py-1 text-center uppercase">MEASUREMENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-800 px-2 py-0.5 font-medium">Height</td>
                        <td className="border border-slate-800 px-2 py-0.5 text-center">
                          [{checklist.sizeHeightCompliant ? '✔' : ' '}] (114 cm)
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-800 px-2 py-0.5 font-medium">Width</td>
                        <td className="border border-slate-800 px-2 py-0.5 text-center">
                          [{checklist.sizeWidthCompliant ? '✔' : ' '}] (73.60 cm)
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-800 px-2 py-0.5 font-medium">Clearance ground/spring</td>
                        <td className="border border-slate-800 px-2 py-0.5 text-center">
                          [{checklist.clearanceCompliant ? '✔' : ' '}] (10.5 cm)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attached Official Vehicle Inspection Photographs (4 Angles) */}
              <div className="pt-3 border-t border-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  OFFICIAL VEHICLE INSPECTION PHOTOGRAPHS (4 ANGLES)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '1. FRONT VIEW', url: checklist.frontImage },
                    { label: '2. OPPOSITE SIDECAR', url: checklist.oppositeSideImage },
                    { label: '3. REAR & PLATE', url: checklist.backImage },
                    { label: '4. MOTOR & ENGINE', url: checklist.motorSideImage },
                  ].map((p, idx) => (
                    <div key={idx} className="border border-slate-400 p-1 text-center bg-slate-50">
                      <div className="w-full h-20 bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                        {p.url ? (
                          <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-slate-500 italic">No Photo Attached</span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-slate-800 block mt-1 uppercase">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signatures & Certification */}
              <div className="pt-4 border-t-2 border-slate-800 flex items-center justify-between text-xs font-sans">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 block">FINAL INSPECTION VERDICT:</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 font-black rounded uppercase text-sm border ${
                      checklist.status === 'PASSED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                        : 'bg-rose-100 text-rose-900 border-rose-400'
                    }`}>
                      {checklist.status === 'PASSED' ? 'PASSED / ROADWORTHY' : 'FAILED / NON-COMPLIANT'}
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className="w-48 border-b border-slate-800 pb-1">
                    <span className="font-bold text-slate-900 block">{checklist.inspectorName || 'Carmela Dizon'}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                    MTFRB Certified Vehicle Inspector
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VEHICLE INSPECTION CAMERA MODAL (Requirements 5 & 6) */}
      {/* ========================================================================= */}
      <InspectionPhotoCaptureModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        currentPhotos={{
          frontImage: checklist.frontImage,
          oppositeSideImage: checklist.oppositeSideImage,
          backImage: checklist.backImage,
          motorSideImage: checklist.motorSideImage,
        }}
        onSavePhotos={(photos) => {
          handleSavePhotos(photos);
        }}
        onCompleteAndTransferToPayment={(photos) => {
          handleSavePhotos(photos);
          setTimeout(() => {
            handleSaveAndComplete();
          }, 100);
        }}
        initialSlot={activePhotoSlot}
        bodyNumber={activeBody}
      />

      {/* ========================================================================= */}
      {/* FULLSCREEN PHOTO LIGHTBOX / VIEWER */}
      {/* ========================================================================= */}
      {selectedViewingPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedViewingPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-slate-800 text-white">
              <span className="text-sm font-bold">{selectedViewingPhoto.title}</span>
              <button
                type="button"
                onClick={() => setSelectedViewingPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center">
              <img
                src={selectedViewingPhoto.url}
                alt={selectedViewingPhoto.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
