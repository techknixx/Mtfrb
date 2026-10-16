import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Camera,
  ZoomIn,
  Eye,
  Trash2,
  UserCheck,
  Car,
  MapPin,
  Calendar,
  Layers,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Motorbike,
  Clock,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { TricycleInspectionChecklist, TricycleFranchiseRecord } from '../types';

interface InspectionDatabaseSectionProps {
  inspectionsList: TricycleInspectionChecklist[];
  franchiseRecords: TricycleFranchiseRecord[];
  todasList: string[];
  onViewInspection: (bodyNumber: string) => void;
  onNavigateToCounter?: (counterId: number) => void;
  onDeleteInspection: (bodyNumber: string) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onSyncServer: () => Promise<void> | void;
  isSyncing: boolean;
  onShowToast: (type: 'success' | 'error', text: string) => void;
}

export const InspectionDatabaseSection: React.FC<InspectionDatabaseSectionProps> = ({
  inspectionsList,
  franchiseRecords,
  todasList,
  onViewInspection,
  onNavigateToCounter,
  onDeleteInspection,
  onExportJson,
  onExportCsv,
  onSyncServer,
  isSyncing,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'WITH_PHOTOS'>('ALL');
  const [todaFilter, setTodaFilter] = useState<string>('ALL');
  const [deleteConfirmBody, setDeleteConfirmBody] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    title: string;
    bodyNumber: string;
    slotName: string;
  } | null>(null);

  // Quick lookup map of franchise records by body number
  const franchiseMap = useMemo(() => {
    const map = new Map<string, TricycleFranchiseRecord>();
    franchiseRecords.forEach(r => {
      const clean = r.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
      map.set(clean, r);
    });
    return map;
  }, [franchiseRecords]);

  // Filtered inspection records
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inspectionsList.filter(item => {
      const cleanBody = item.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
      const f = item.connectedFranchise || franchiseMap.get(cleanBody);

      const matchQuery =
        !q ||
        item.bodyNumber.toLowerCase().includes(q) ||
        (item.operatorName && item.operatorName.toLowerCase().includes(q)) ||
        (f?.operatorName && f.operatorName.toLowerCase().includes(q)) ||
        (item.driverName && item.driverName.toLowerCase().includes(q)) ||
        (f?.driverName && f.driverName.toLowerCase().includes(q)) ||
        (item.inspectorName && item.inspectorName.toLowerCase().includes(q)) ||
        (item.plateNumber && item.plateNumber.toLowerCase().includes(q)) ||
        (f?.plateNumber && f.plateNumber.toLowerCase().includes(q)) ||
        (f?.todaName && f.todaName.toLowerCase().includes(q)) ||
        (item.remarks && item.remarks.toLowerCase().includes(q));

      const hasPhotos = Boolean(
        item.frontImage || item.oppositeSideImage || item.backImage || item.motorSideImage
      );

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PASSED' && item.status === 'PASSED') ||
        (statusFilter === 'FAILED' && item.status === 'FAILED') ||
        (statusFilter === 'WITH_PHOTOS' && hasPhotos);

      const todaName = f?.todaName || f?.todaAssociation || '';
      const matchToda = todaFilter === 'ALL' || todaName === todaFilter;

      return matchQuery && matchStatus && matchToda;
    });
  }, [inspectionsList, searchQuery, statusFilter, todaFilter, franchiseMap]);

  // Statistical calculations
  const stats = useMemo(() => {
    const total = inspectionsList.length;
    const passed = inspectionsList.filter(i => i.status === 'PASSED').length;
    const failed = inspectionsList.filter(i => i.status === 'FAILED').length;
    const withPhotos = inspectionsList.filter(
      i => i.frontImage || i.oppositeSideImage || i.backImage || i.motorSideImage
    ).length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { total, passed, failed, withPhotos, passRate };
  }, [inspectionsList]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Inspected
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {stats.total}
            </div>
            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
              Checklists on Record
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <ClipboardCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Roadworthy Passed
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {stats.passed}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              Approved for Permit
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Defects / Failed
            </div>
            <div className="text-2xl font-black text-rose-700 mt-1">
              {stats.failed}
            </div>
            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
              Saved for Re-inspection
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Photo Verified
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-1">
              {stats.withPhotos}
            </div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
              4-Angle Stored
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
            <Camera className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pass Rate
            </div>
            <div className="text-2xl font-black text-teal-800 mt-1">
              {stats.passRate}%
            </div>
            <div className="text-[10px] text-teal-600 font-semibold mt-0.5">
              Municipal Compliance
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, and Database Action Buttons */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Body #, Operator, Driver, Inspector, Plate..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons: New Inspection, Sync, Export JSON, Export CSV */}
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateToCounter && (
              <button
                type="button"
                onClick={() => onNavigateToCounter(3)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Open Counter 3 / Physical Inspection Station"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Conduct Inspection</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSyncServer()}
              disabled={isSyncing}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Synchronize inspection records with backend server database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Server'}</span>
            </button>

            <button
              type="button"
              onClick={onExportJson}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Download dedicated inspection checklists database as JSON"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Export DB (JSON)</span>
            </button>

            <button
              type="button"
              onClick={onExportCsv}
              className="px-3 py-2 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Export physical inspection checklist records as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Status Filter Chips & TODA Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Filter:</span>

            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({inspectionsList.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PASSED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'PASSED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Passed ({stats.passed})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('FAILED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'FAILED'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>Failed / Defects ({stats.failed})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('WITH_PHOTOS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'WITH_PHOTOS'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>With Photos ({stats.withPhotos})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
              <span className="font-semibold text-slate-600">TODA:</span>
              <select
                value={todaFilter}
                onChange={e => setTodaFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer"
              >
                <option value="ALL">All Associations</option>
                {todasList.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || statusFilter !== 'ALL' || todaFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setTodaFilter('ALL');
                }}
                className="text-xs text-amber-700 hover:text-amber-900 font-bold px-1.5 py-1 underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Inspection Records Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            No inspection records found
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {searchQuery || statusFilter !== 'ALL' || todaFilter !== 'ALL'
              ? 'No inspection checklists match your active filter settings. Try resetting your search or filter.'
              : 'There are no inspection records saved in the dedicated database yet. You can conduct a physical inspection at Counter 3.'}
          </p>
          {onNavigateToCounter && (
            <button
              type="button"
              onClick={() => onNavigateToCounter(3)}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Go to Counter 3 / Physical Inspection Station</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map(chk => {
            const cleanBody = chk.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
            const f = chk.connectedFranchise || franchiseMap.get(cleanBody);
            const isPassed = chk.status === 'PASSED';

            const photoSlots = [
              { key: 'frontImage', name: 'Front View', url: chk.frontImage },
              { key: 'oppositeSideImage', name: 'Opposite Side (Sidecar)', url: chk.oppositeSideImage },
              { key: 'backImage', name: 'Back (Plate & Tail)', url: chk.backImage },
              { key: 'motorSideImage', name: 'Motor Side (Muffler)', url: chk.motorSideImage },
            ];

            const photoCount = photoSlots.filter(s => Boolean(s.url)).length;

            // Collect non-compliant components
            const defects: string[] = [];
            if (chk.headlight && chk.headlight !== 'STANDARD' && chk.headlight !== 'PASS') defects.push('Headlight defective');
            if (chk.signalLights && chk.signalLights !== 'STANDARD' && chk.signalLights !== 'PASS') defects.push('Signal lights defective');
            if (chk.tailLight && chk.tailLight !== 'STANDARD' && chk.tailLight !== 'PASS') defects.push('Tail light defective');
            if (chk.horn && chk.horn !== 'STANDARD' && chk.horn !== 'PASS') defects.push('Horn non-functional');
            if (chk.muffler && (chk.muffler.includes('MODIFIED') || chk.muffler.includes('FAIL'))) defects.push('Muffler modified/loud');
            if (chk.fareMatrix && (chk.fareMatrix.includes('NONE') || chk.fareMatrix.includes('FAIL'))) defects.push('Fare matrix missing');

            return (
              <div
                key={chk.bodyNumber}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top Header */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-900 to-slate-900 text-amber-300 font-mono font-black text-lg flex items-center justify-center shadow-xs border border-teal-700 shrink-0">
                      {chk.bodyNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-900">
                          Body #{chk.bodyNumber}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-200">
                          {chk.plateNumber || f?.plateNumber || 'No Plate'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {f?.todaName || f?.todaAssociation || 'Castillejos TODA'}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPassed ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Roadworthy Passed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Failed / Defects</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3.5 flex-1">
                  {/* Connected Main Franchise Registry Link Info */}
                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black uppercase tracking-wider text-teal-900 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                        <span>Connected to Main Franchise DB</span>
                      </div>
                      <span className="text-[10px] font-mono text-teal-800 font-bold">
                        PK: {chk.bodyNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Operator (Owner):</span>
                        <span className="font-bold text-slate-900 truncate block">
                          {chk.operatorName || f?.operatorName || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Authorized Driver:</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {chk.driverName || f?.driverName || 'Same as Operator'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Make & Model:</span>
                        <span className="text-slate-800 truncate block font-medium">
                          {chk.makeModel || f?.make || f?.makeModel || 'Kawasaki Barako II'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Route & Zone:</span>
                        <span className="text-slate-800 truncate block font-medium">
                          {f?.routeZone || f?.zone || 'Zone 1'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Inspector and Date */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                      <span>Inspector: <strong className="text-slate-800">{chk.inspectorName || 'Carmela Dizon'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{chk.inspectionDate || 'Recent'}</span>
                    </div>
                  </div>

                  {/* 4-Angle Photographs Gallery */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                      <span className="flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>Inspection Photographs</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {photoCount} of 4 angles stored
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {photoSlots.map((slot, sIdx) => (
                        <div
                          key={sIdx}
                          className="relative aspect-4/3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group"
                        >
                          {slot.url ? (
                            <>
                              <img
                                src={slot.url}
                                alt={`${chk.bodyNumber} ${slot.name}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxPhoto({
                                    url: slot.url!,
                                    title: slot.name,
                                    bodyNumber: chk.bodyNumber,
                                    slotName: slot.name,
                                  })
                                }
                                className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                                title="Click to view full resolution"
                              >
                                <ZoomIn className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                              <Camera className="w-3.5 h-3.5 opacity-40 mb-0.5" />
                              <span className="text-[8px] leading-tight font-medium opacity-60">
                                None
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[8px] font-semibold px-1 py-0.5 truncate text-center pointer-events-none">
                            {slot.name.split(' ')[0]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Defects & Compliance Breakdown */}
                  {defects.length > 0 ? (
                    <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-xs">
                      <div className="font-bold text-rose-800 flex items-center gap-1 text-[11px] mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Defects / Non-Compliance Flagged:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {defects.map((def, dIdx) => (
                          <span
                            key={dIdx}
                            className="px-2 py-0.5 bg-rose-100 text-rose-900 font-semibold rounded-md text-[10px] border border-rose-300"
                          >
                            {def}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>All electrical components, muffler, and fare matrix compliant.</span>
                    </div>
                  )}

                  {/* Inspector Remarks */}
                  {chk.remarks && (
                    <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      "{chk.remarks}"
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onViewInspection(chk.bodyNumber)}
                    className="flex-1 py-2 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Inspection Sheet</span>
                  </button>

                  {onNavigateToCounter && (
                    <button
                      type="button"
                      onClick={() => onNavigateToCounter(3)}
                      className="py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Re-inspect at Counter 3"
                    >
                      <Motorbike className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline">Re-Inspect</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmBody(chk.bodyNumber)}
                    className="p-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                    title="Delete this inspection checklist from database"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBody && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Delete Inspection Checklist?
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Are you sure you want to permanently delete the physical inspection record for{' '}
              <strong className="font-mono text-slate-900">Body #{deleteConfirmBody}</strong>?
              This will remove all stored photos and reset the vehicle's inspection status in the connected Franchise Registry.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmBody(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteInspection(deleteConfirmBody);
                  setDeleteConfirmBody(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-3xl w-full p-4 border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
              <div>
                <h4 className="text-sm font-bold text-amber-300">
                  Body #{lightboxPhoto.bodyNumber} • {lightboxPhoto.slotName}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Castillejos MTFRB Physical Safety Inspection Photograph
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Verified MTFRB Unit Stencil & Visual Record</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
