import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  ArrowRightLeft, 
  Eye, 
  Car, 
  Motorbike, 
  PhoneCall, 
  Search, 
  AlertTriangle,
  Clock,
  User,
  Filter
} from 'lucide-react';
import { Ticket, ServiceCounter, getFranchiseTypeLabel, TricycleFranchiseRecord } from '../types';
import { getFranchiseRecordByBodyNumber, isBodyNumberInspectionPassed } from '../utils/storage';

interface WaitingQueueSectionProps {
  waitingTickets: Ticket[];
  activeCounter: ServiceCounter;
  counters: ServiceCounter[];
  onCallNext: (ticket?: Ticket) => void;
  onOpenTransferModal: (ticket: Ticket) => void;
  onViewFranchiseRecord?: (record: TricycleFranchiseRecord) => void;
  onViewInspectionData?: (bodyNumber: string) => void;
}

export const WaitingQueueSection: React.FC<WaitingQueueSectionProps> = ({
  waitingTickets,
  activeCounter,
  counters,
  onCallNext,
  onOpenTransferModal,
  onViewFranchiseRecord,
  onViewInspectionData,
}) => {
  const [searchFilter, setSearchFilter] = useState('');

  // Helper to find matching database record by body number or ticket number
  const findMatchingRecord = (ticket: Ticket): TricycleFranchiseRecord | null => {
    const candidateBody = (ticket.bodyNumber || ticket.plateOrUnitNumber || '').replace(/^#+/, '').trim();
    if (candidateBody) {
      const rec = getFranchiseRecordByBodyNumber(candidateBody);
      if (rec) return rec;
    }
    const numericTicket = ticket.ticketNumber.replace(/^[A-Z]+-?/i, '').trim();
    if (numericTicket) {
      const recByNumeric = getFranchiseRecordByBodyNumber(numericTicket);
      if (recByNumeric) return recByNumeric;
    }
    const recByTicket = getFranchiseRecordByBodyNumber(ticket.ticketNumber);
    if (recByTicket) return recByTicket;
    return null;
  };

  // Filter tickets by user search (Ticket number, applicant name, or body number)
  const filteredTickets = useMemo(() => {
    if (!searchFilter.trim()) return waitingTickets;
    const q = searchFilter.trim().toLowerCase();
    return waitingTickets.filter((t) => {
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.applicantName.toLowerCase().includes(q) ||
        (t.bodyNumber && t.bodyNumber.toLowerCase().includes(q)) ||
        (t.plateOrUnitNumber && t.plateOrUnitNumber.toLowerCase().includes(q))
      );
    });
  }, [waitingTickets, searchFilter]);

  return (
    <div className="w-full space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 sm:p-4">
        {/* Header & Controls: Responsive layout across all screen sizes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Waiting Applicants
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {waitingTickets.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Assigned queue for <strong className="text-slate-700">{activeCounter.name}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
              Station #{activeCounter.id}
            </span>
            <button
              type="button"
              onClick={() => onCallNext()}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[36px] active:scale-95"
              title="Call the next applicant in line"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Next</span>
            </button>
          </div>
        </div>

        {/* Informational Guidance Banner */}
        <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-teal-50/70 px-3 py-2 rounded-lg border border-teal-200/80 my-3">
          <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="leading-tight">
            <strong>Desk Isolation:</strong> Routing strictly displays clients awaiting service at {activeCounter.name}.
          </span>
        </div>

        {/* Search / Filter Input for Waiting Queue */}
        {waitingTickets.length > 3 && (
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by ticket #, name, body #..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-hidden transition-all"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Ticket List / Empty State */}
        {waitingTickets.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
            <User className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
            <p className="font-semibold text-slate-600">No applicants waiting</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              New applicants routed to {activeCounter.name} will appear here in real time.
            </p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No applicants match &ldquo;{searchFilter}&rdquo;.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 overscroll-contain">
            {filteredTickets.map((t) => {
              const matchedRecord = findMatchingRecord(t);
              const bodyDisplay = (t.bodyNumber || t.plateOrUnitNumber || matchedRecord?.bodyNumber || '').replace(/^#+/, '').trim();
              
              // Requirement 3: Fresh official MTFRB inspection status
              // Must be passed on the ticket itself to be considered passed for this queue transaction
              const hasPassedFreshInspection = t.inspectionPassed === true;

              return (
                <div
                  key={t.id}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all space-y-2.5 ${
                    t.priorityLevel === 'PRIORITY'
                      ? 'bg-amber-50/80 border-amber-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  {/* Top Tier: Ticket Badges & Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {t.ticketNumber}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                        {getFranchiseTypeLabel(t.franchiseType)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        {t.zone || 'Zone 1'}
                      </span>
                      {bodyDisplay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-0.5">
                          <Car className="w-2.5 h-2.5 text-blue-600" />
                          #{bodyDisplay}
                        </span>
                      )}
                      {t.priorityLevel === 'PRIORITY' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-amber-200 text-amber-900">
                          ★ Priority
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{Math.max(1, Math.floor((Date.now() - t.createdAt) / 60000))}m ago</span>
                    </div>
                  </div>

                  {/* Middle Tier: Applicant Name & Fresh Inspection Status Indicator */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {t.applicantName}
                      </div>
                      {t.contactNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {t.contactNumber}
                        </div>
                      )}
                    </div>

                    {/* Fresh Inspection Status Badge (Requirement 3) */}
                    <div>
                      {hasPassedFreshInspection ? (
                        <button
                          type="button"
                          onClick={() => bodyDisplay && onViewInspectionData?.(bodyDisplay)}
                          className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Passed fresh official MTFRB vehicle inspection - Click to view inspection records"
                        >
                          <Motorbike className="w-3 h-3 text-emerald-700" />
                          <span>Passed Fresh Inspection</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => bodyDisplay && onViewInspectionData?.(bodyDisplay)}
                          className="px-2 py-0.5 text-[10px] font-black rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Must undergo fresh official MTFRB vehicle inspection for this transaction"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Fresh Inspection Req.</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bottom Tier: Responsive Action Buttons Bar */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* View Data from Information & Records Database */}
                      {matchedRecord && onViewFranchiseRecord && (
                        <button
                          type="button"
                          onClick={() => onViewFranchiseRecord(matchedRecord)}
                          className="px-2.5 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-300 shadow-2xs cursor-pointer flex items-center gap-1 min-h-[32px]"
                          title="View Data in Information & Records Database"
                        >
                          <Eye className="w-3.5 h-3.5 text-teal-700" />
                          <span>View Data</span>
                        </button>
                      )}

                      {/* Transfer Ticket to Another Counter */}
                      <button
                        type="button"
                        onClick={() => onOpenTransferModal(t)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-slate-300 hover:border-blue-300 cursor-pointer flex items-center gap-1 min-h-[32px]"
                        title="Transfer this ticket to another counter"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                        <span>Transfer</span>
                      </button>
                    </div>

                    {/* Call Now Button (Primary Touch-Friendly) */}
                    <button
                      type="button"
                      onClick={() => onCallNext(t)}
                      className="flex-1 sm:flex-initial px-3.5 py-1 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1 min-h-[32px]"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>Call Now</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
