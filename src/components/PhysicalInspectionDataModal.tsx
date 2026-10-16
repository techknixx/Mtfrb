import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Camera, 
  Calendar, 
  UserCheck, 
  FileText, 
  Check, 
  AlertTriangle,
  ZoomIn,
  ExternalLink,
  Car,
  Motorbike,
  Shield,
  Layers,
  Sparkles,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { TricycleInspectionChecklist, TricycleFranchiseRecord } from '../types';
import { getInspectionChecklist, saveInspectionChecklist, getFranchiseRecordByBodyNumber, fetchInspectionsFromServer } from '../utils/storage';
import { MTFRB_LOGO } from '../assets/logo';
import { INSPECTION_PHOTO_SLOTS } from './InspectionPhotoCaptureModal';

interface PhysicalInspectionDataModalProps {
  bodyNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenPhotoCapture?: () => void;
  onDeleteInspection?: (bodyNumber: string) => void;
  onSyncServer?: () => Promise<void> | void;
}

export const PhysicalInspectionDataModal: React.FC<PhysicalInspectionDataModalProps> = ({
  bodyNumber,
  isOpen,
  onClose,
  onOpenPhotoCapture,
  onDeleteInspection,
  onSyncServer,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'electrical' | 'sidecar' | 'dimensions' | 'certificate'>('overview');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string; slotName: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const cleanBody = String(bodyNumber || '').trim();

  // Load physical inspection checklist data into active state
  const [checklist, setChecklist] = useState<TricycleInspectionChecklist>(() => getInspectionChecklist(cleanBody));

  useEffect(() => {
    setChecklist(getInspectionChecklist(cleanBody));
  }, [cleanBody, isOpen]);

  // Sync listener to automatically refresh when global database is updated
  useEffect(() => {
    const handleDbSynced = () => {
      setChecklist(getInspectionChecklist(cleanBody));
    };
    window.addEventListener('mtfrb_inspections_db_synced', handleDbSynced);
    window.addEventListener('mtfrb_inspection_updated', handleDbSynced);
    return () => {
      window.removeEventListener('mtfrb_inspections_db_synced', handleDbSynced);
      window.removeEventListener('mtfrb_inspection_updated', handleDbSynced);
    };
  }, [cleanBody]);

  // Load matching franchise record for complete vehicle context
  const franchiseRecord = useMemo<TricycleFranchiseRecord | null>(() => {
    return getFranchiseRecordByBodyNumber(cleanBody);
  }, [cleanBody, isOpen]);

  // Re-sync database record function (same function as Sync Server in Inspection Checklist Database)
  const handleSyncDatabaseRecord = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      // 1. Post current inspection to server backend
      try {
        await fetch(`/api/inspections/${encodeURIComponent(cleanBody)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checklist),
        });
      } catch (err) {
        console.warn('Inspection push error:', err);
      }

      // 2. Fetch all inspections from server (same as Sync Server)
      await fetchInspectionsFromServer();

      // 3. If parent provided onSyncServer callback (e.g. from Inspection Database section), call it to refresh parent list
      if (onSyncServer) {
        await onSyncServer();
      }

      // 4. Refresh local checklist state
      const freshChecklist = getInspectionChecklist(cleanBody);
      setChecklist(freshChecklist);

      setSyncFeedback({
        type: 'success',
        message: `Database record for Body #${cleanBody} synchronized with server backend.`,
      });

      setTimeout(() => {
        setSyncFeedback(null);
      }, 4000);
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: 'Sync failed: ' + (err.message || 'Error communicating with server'),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const isPassed = checklist.status === 'PASSED';
  const inspectionDateDisplay = checklist.inspectionDate
    ? new Date(checklist.inspectionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Not Recorded';

  // Count photos captured
  const photosCount = [
    checklist.frontImage,
    checklist.oppositeSideImage,
    checklist.backImage,
    checklist.motorSideImage,
  ].filter(Boolean).length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-white/20 shrink-0">
              <Motorbike className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Physical Inspection Record
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Body #{cleanBody}
                </span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isPassed 
                    ? 'bg-emerald-500 text-slate-950' 
                    : 'bg-rose-500 text-white'
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  {isPassed ? 'PASSED & ROADWORTHY' : 'FAILED / RE-INSPECTION'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/70">
                Verified Roadworthiness, Mechanical Clearance & Stencil Certification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onDeleteInspection && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Delete this physical inspection checklist from database"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                <span className="hidden sm:inline">Delete Record</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('certificate')}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-emerald-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="View Printable Official Inspection Certificate"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Certificate</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Permanently Delete Inspection Checklist?
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Are you sure you want to permanently delete the physical inspection record for{' '}
                <strong className="font-mono text-slate-900">Body #{cleanBody}</strong>?
                This will remove all stored 4-angle inspection photos and reset the vehicle's inspection status.
              </p>
              <div className="flex items-center justify-end gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDeleteInspection?.(cleanBody);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 bg-slate-50 border-b border-slate-200 flex items-center gap-1 sm:gap-2 overflow-x-auto text-xs shrink-0 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Inspection Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'photos'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>4 Angle Photos ({photosCount}/4)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('electrical')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'electrical'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Motor & Electrical</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sidecar')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sidecar'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Sidecar & Stencils</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dimensions')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'dimensions'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dimensions & Clearance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('certificate')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'certificate'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Official Certificate</span>
          </button>
        </div>

        {/* Sync Feedback Notification */}
        {syncFeedback && (
          <div className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between border-b shrink-0 transition-all ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {syncFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{syncFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50 space-y-5">
          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW & VEHICLE IDENTIFICATION */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Certification Banner */}
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                      Municipal Regulatory Clearance
                    </span>
                    <h4 className="text-base font-black text-emerald-950">
                      Physical Inspection Certified Roadworthy
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Inspected & Approved by <strong>{checklist.inspectorName || 'Carmela Dizon'}</strong> on {inspectionDateDisplay}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-emerald-900 shadow-2xs">
                    STATUS: {checklist.status || 'PASSED'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSyncDatabaseRecord}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-950 border border-emerald-300 hover:border-emerald-400 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    title="Synchronize inspection database record with backend server"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Re-Sync Database Record'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Vehicle Profile Grid */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-slate-600" />
                  Vehicle & Master Registry Linkage
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Tricycle Body #</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{cleanBody}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Franchise No.</span>
                    <span className="font-mono font-bold text-slate-800">{franchiseRecord?.franchiseNumber || 'MTFRB-2024-' + cleanBody}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Plate / Unit No.</span>
                    <span className="font-bold text-slate-800">{franchiseRecord?.plateNumber || '1234-AB'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Make / Model</span>
                    <span className="font-bold text-slate-800 truncate block">{franchiseRecord?.makeModel || 'Honda TMX 125 Alpha'}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Registered Operator</span>
                    <span className="font-bold text-slate-800 truncate block">{franchiseRecord?.operatorName || 'Juan Dela Cruz'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">TODA Association</span>
                    <span className="font-bold text-slate-800 truncate block">{franchiseRecord?.todaAssociation || 'DELPTODA'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Route Zone</span>
                    <span className="font-bold text-slate-800">{franchiseRecord?.zone || 'Zone 1'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Sidecar Color Code</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                      {checklist.sidecarColor || franchiseRecord?.color || 'Blue'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Photos Mini Preview */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-600" />
                    4 Mandatory Municipal Angles
                  </h5>
                  <button
                    type="button"
                    onClick={() => setActiveTab('photos')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Large Photos</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {INSPECTION_PHOTO_SLOTS.map((slot) => {
                    const imgUrl = checklist[slot.id];
                    return (
                      <div 
                        key={slot.id} 
                        className="group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer"
                        onClick={() => {
                          if (imgUrl) {
                            setLightboxPhoto({ url: imgUrl, title: slot.label, slotName: slot.shortName });
                          } else {
                            setActiveTab('photos');
                          }
                        }}
                      >
                        <div className="aspect-4/3 overflow-hidden flex items-center justify-center bg-slate-900">
                          {imgUrl ? (
                            <img 
                              src={imgUrl} 
                              alt={slot.label} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            />
                          ) : (
                            <div className="p-3 text-center text-slate-400 flex flex-col items-center gap-1">
                              <Camera className="w-5 h-5 opacity-40" />
                              <span className="text-[10px]">Photo Required</span>
                            </div>
                          )}
                        </div>
                        <div className="p-1.5 bg-slate-900/90 text-center flex items-center justify-between px-2 text-white">
                          <span className="text-[11px] font-bold truncate">{slot.shortName}</span>
                          {imgUrl ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Captured" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-amber-400" title="Pending" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inspection Findings & Remarks */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  Inspector Roadworthiness Findings & Remarks
                </h5>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
                  {checklist.remarks || franchiseRecord?.notes || 'Unit passed all mechanical and safety standards. Engine and chassis stencils match official registration documents.'}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: 4 MANDATORY ANGLE PHOTOGRAPHS */}
          {/* ========================================================================= */}
          {activeTab === 'photos' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-xs text-teal-900">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>
                    Official Municipal Ordinance requires 4 photographic angles proving stencil authenticity and road safety compliance.
                  </span>
                </div>
                {onOpenPhotoCapture && (
                  <button
                    type="button"
                    onClick={onOpenPhotoCapture}
                    className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shrink-0 cursor-pointer shadow-2xs"
                  >
                    Open Camera
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {INSPECTION_PHOTO_SLOTS.map((slot) => {
                  const imgUrl = checklist[slot.id];

                  return (
                    <div 
                      key={slot.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col"
                    >
                      <div className="px-3 py-2 bg-slate-900 text-white flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-amber-400 font-bold">#{slot.index}</span>
                          <span className="font-bold truncate">{slot.label}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          imgUrl ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {imgUrl ? 'Captured' : 'Empty'}
                        </span>
                      </div>

                      <div className="relative aspect-16/10 bg-slate-950 flex items-center justify-center overflow-hidden">
                        {imgUrl ? (
                          <div 
                            className="relative w-full h-full cursor-zoom-in group"
                            onClick={() => setLightboxPhoto({ url: imgUrl, title: slot.label, slotName: slot.shortName })}
                          >
                            <img 
                              src={imgUrl} 
                              alt={slot.label} 
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                              <ZoomIn className="w-4 h-4" />
                              <span>Click to Enlarge</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-6 text-slate-500 space-y-1">
                            <Camera className="w-8 h-8 mx-auto opacity-30" />
                            <p className="text-xs font-semibold">{slot.shortName} Photo Pending</p>
                            <p className="text-[10px] text-slate-400 max-w-xs">{slot.tip}</p>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                        <p className="font-medium">{slot.guideText}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MOTOR & ELECTRICAL SYSTEMS */}
          {/* ========================================================================= */}
          {activeTab === 'electrical' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                  Motorcycle Mechanical & Electrical Checklist
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Headlight */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Headlight</span>
                      <span className="text-[11px] text-slate-500">High & Low Beams</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.headlight === 'Functional'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.headlight === 'Functional' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.headlight}
                    </span>
                  </div>

                  {/* Signal Lights */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Signal Lights</span>
                      <span className="text-[11px] text-slate-500">Left & Right Turn</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.signalLights === 'Functional'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.signalLights === 'Functional' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.signalLights}
                    </span>
                  </div>

                  {/* Tail Light */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Tail Light & Stop</span>
                      <span className="text-[11px] text-slate-500">Brake Signal</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.tailLight === 'Functional'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.tailLight === 'Functional' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.tailLight}
                    </span>
                  </div>

                  {/* Horn */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Electric Horn</span>
                      <span className="text-[11px] text-slate-500">Audible Standard</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.horn === 'Functional'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.horn === 'Functional' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.horn}
                    </span>
                  </div>

                  {/* Battery */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Battery & Charging</span>
                      <span className="text-[11px] text-slate-500">12V Functional</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.battery === 'Functional'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.battery === 'Functional' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.battery}
                    </span>
                  </div>

                  {/* Back Ride Guard */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Back Ride Guard</span>
                      <span className="text-[11px] text-slate-500">Passenger Safety Bar</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.backRideGuard === 'With'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.backRideGuard === 'With' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.backRideGuard} Guard
                    </span>
                  </div>

                  {/* Side Mirrors */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Dual Side Mirrors</span>
                      <span className="text-[11px] text-slate-500">Left & Right Views</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.sideMirrors === 'With'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.sideMirrors === 'With' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.sideMirrors} Mirrors
                    </span>
                  </div>

                  {/* Muffler Silencer */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Exhaust Muffler</span>
                      <span className="text-[11px] text-slate-500">Noise / Decibel Check</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.muffler === 'Standard'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.muffler === 'Standard' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.muffler}
                    </span>
                  </div>

                  {/* Handlebar */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Steering Handlebar</span>
                      <span className="text-[11px] text-slate-500">Factory Ergonomics</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                      checklist.handle === 'Standard'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {checklist.handle === 'Standard' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {checklist.handle}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tire Specs */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-slate-600" />
                  Tire Condition & Wheel Covers
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Front Motorcycle Tire</span>
                    <span className="font-bold text-emerald-800 flex items-center gap-1 mt-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {checklist.frontTire}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Rear Motorcycle Tire</span>
                    <span className="font-bold text-emerald-800 flex items-center gap-1 mt-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {checklist.backTire}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Sidecar Wheel Tire</span>
                    <span className="font-bold text-emerald-800 flex items-center gap-1 mt-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {checklist.sidecarTire}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Wheel Cover Guard</span>
                    <span className="font-bold text-emerald-800 flex items-center gap-1 mt-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {checklist.wheelCover} Guard
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: SIDECAR & STENCILS */}
          {/* ========================================================================= */}
          {activeTab === 'sidecar' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Stencil Authentications */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                  Official Municipal Stencil Authentication
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Front Body Number Stencil</span>
                      <span className="text-[11px] text-slate-500">Windshield / Apron</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Verified Present
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Rear Body Number Stencil</span>
                      <span className="text-[11px] text-slate-500">Back Cover / Tailgate</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Verified Present
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Top Roof Body Number Stencil</span>
                      <span className="text-[11px] text-slate-500">Aerial / Canopy Identification</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Verified Present
                    </span>
                  </div>
                </div>
              </div>

              {/* Sidecar Safety Specifications */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-slate-600" />
                  Sidecar Passenger Accessories & Safety
                </h5>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Sidecar Reflector</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.sidecarReflector}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Sidecar Light</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.sidecarLight}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Back Carrier</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.backCarrier}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Back Weather Cover</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.backCover}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Trash Can Inside</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.trashCan}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Official Fare Matrix</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.fareMatrix}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Sidecar Fabrication</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.sidecarType || 'Standard'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Municipal Color</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{checklist.sidecarColor || 'Blue'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: DIMENSIONS & CLEARANCE */}
          {/* ========================================================================= */}
          {activeTab === 'dimensions' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  Municipal Standard Dimensions & Clearance Compliance
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Height */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm">Sidecar Height</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                        COMPLIANT
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-900">
                      114 <span className="text-sm font-semibold text-emerald-700">cm</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Maximum standard height from road surface to top rail.
                    </p>
                  </div>

                  {/* Width */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm">Sidecar Width</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                        COMPLIANT
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-900">
                      73.60 <span className="text-sm font-semibold text-emerald-700">cm</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard passenger sidecar cabin body width.
                    </p>
                  </div>

                  {/* Ground Clearance */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm">Ground Clearance</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                        COMPLIANT
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-900">
                      10.5 <span className="text-sm font-semibold text-emerald-700">cm</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Minimum safe road clearance under full passenger load.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: OFFICIAL PRINTABLE CERTIFICATE PREVIEW */}
          {/* ========================================================================= */}
          {activeTab === 'certificate' && (
            <div className="bg-white rounded-xl border-2 border-slate-800 p-6 shadow-md space-y-4 font-sans text-slate-900 print:border-none print:shadow-none animate-in fade-in duration-150">
              <div className="text-center border-b pb-4 space-y-1">
                <p className="text-xs tracking-wider uppercase text-slate-500 font-semibold">
                  Republic of the Philippines • Province of Zambales
                </p>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase">
                  MUNICIPAL TRICYCLE FRANCHISING & REGULATORY BOARD
                </h2>
                <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wide">
                  Official Tricycle Physical Inspection & Roadworthiness Certificate
                </h3>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Body Number:</span>
                  <span className="font-mono text-base font-black text-slate-900">#{cleanBody}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Inspection Date:</span>
                  <span className="font-bold text-slate-900">{inspectionDateDisplay}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Franchise No:</span>
                  <span className="font-mono font-bold text-slate-900">{franchiseRecord?.franchiseNumber || 'MTFRB-2024-' + cleanBody}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Evaluation:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black">
                    PASSED / CERTIFIED
                  </span>
                </div>
              </div>

              {/* Printable Summary Table */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                <div className="border border-slate-200 rounded-lg p-3 space-y-1.5 bg-white">
                  <h6 className="font-black text-slate-800 border-b pb-1">Mechanical & Electrical Standards</h6>
                  <div className="flex justify-between"><span>Headlight:</span><strong>{checklist.headlight}</strong></div>
                  <div className="flex justify-between"><span>Signal Lights:</span><strong>{checklist.signalLights}</strong></div>
                  <div className="flex justify-between"><span>Tail & Stop Light:</span><strong>{checklist.tailLight}</strong></div>
                  <div className="flex justify-between"><span>Horn:</span><strong>{checklist.horn}</strong></div>
                  <div className="flex justify-between"><span>Muffler Silencer:</span><strong>{checklist.muffler}</strong></div>
                  <div className="flex justify-between"><span>Side Mirrors:</span><strong>{checklist.sideMirrors}</strong></div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 space-y-1.5 bg-white">
                  <h6 className="font-black text-slate-800 border-b pb-1">Sidecar & Safety Accessories</h6>
                  <div className="flex justify-between"><span>Sidecar Reflector:</span><strong>{checklist.sidecarReflector}</strong></div>
                  <div className="flex justify-between"><span>Sidecar Light:</span><strong>{checklist.sidecarLight}</strong></div>
                  <div className="flex justify-between"><span>Back Ride Guard:</span><strong>{checklist.backRideGuard}</strong></div>
                  <div className="flex justify-between"><span>Wheel Cover:</span><strong>{checklist.wheelCover}</strong></div>
                  <div className="flex justify-between"><span>Body Number Stencils:</span><strong>Verified Complete</strong></div>
                  <div className="flex justify-between"><span>Fare Matrix:</span><strong>{checklist.fareMatrix}</strong></div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <span className="font-bold text-slate-700 block">Inspection Findings & Notes:</span>
                <p className="text-slate-600">
                  {checklist.remarks || 'This tricycle unit has successfully passed all mandatory mechanical, lighting, and dimensional standards set forth by the MTFRB.'}
                </p>
              </div>

              {/* Signature Block */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-b-2 border-slate-800 pb-1 font-bold text-slate-900 uppercase">
                    {checklist.inspectorName || 'Carmela Dizon'}
                  </div>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Authorized MTFRB Physical Inspector
                  </span>
                </div>
                <div>
                  <div className="border-b-2 border-slate-800 pb-1 font-bold text-slate-900 uppercase">
                    Engr. Roberto M. Castillo
                  </div>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Municipal Transportation & Franchising Officer
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Official Certificate Copy</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Database Status: Roadworthy & Certified for Franchise Processing</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncDatabaseRecord}
              disabled={isSyncing}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-60"
              title="Synchronize inspection database record with backend server"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Re-Sync Database Record'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* High-Resolution Photo Lightbox */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-2xl overflow-hidden border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white text-xs">
              <span className="font-bold">{lightboxPhoto.title} — Body #{cleanBody}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black">
              <img 
                src={lightboxPhoto.url} 
                alt={lightboxPhoto.title} 
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
