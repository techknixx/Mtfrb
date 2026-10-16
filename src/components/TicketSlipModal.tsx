import React, { useMemo } from 'react';
import { Ticket, getFranchiseTypeLabel } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { MTFRB_LOGO } from '../assets/logo';
import { Printer, X, Smartphone } from 'lucide-react';

interface TicketSlipModalProps {
  ticket: Ticket;
  queuePosition: number;
  estimatedMinutes: number;
  onClose: () => void;
}

export const TicketSlipModal: React.FC<TicketSlipModalProps> = ({
  ticket,
  queuePosition,
  estimatedMinutes,
  onClose,
}) => {
  const typeLabel = getFranchiseTypeLabel(ticket.franchiseType);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(ticket.createdAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(ticket.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Ensure clean, verified ticket number
  const cleanTicketNumber = ticket.ticketNumber.trim().toUpperCase();
  const bodyNumber = ticket.bodyNumber || ticket.plateOrUnitNumber;

  // Construct mobile tracking URL for QR Code with exact verified ticket number
  const trackerUrl = useMemo(() => {
    if (typeof window === 'undefined') return `?ticket=${encodeURIComponent(cleanTicketNumber)}`;
    try {
      const baseOrigin = window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : '';
      const url = new URL(baseOrigin + window.location.pathname);
      url.searchParams.set('ticket', cleanTicketNumber);
      url.searchParams.set('id', ticket.id);
      url.searchParams.set('name', ticket.applicantName);
      url.searchParams.set('type', ticket.franchiseType);
      url.searchParams.set('prio', ticket.priorityLevel);
      if (ticket.priorityReason) url.searchParams.set('reason', ticket.priorityReason);
      if (ticket.franchiseNumber) url.searchParams.set('frn', ticket.franchiseNumber);
      if (bodyNumber) url.searchParams.set('body', bodyNumber);
      if (ticket.zone) url.searchParams.set('zone', ticket.zone);
      if (ticket.classification) url.searchParams.set('class', ticket.classification);
      return url.toString();
    } catch {
      return `${window.location.origin || ''}/?ticket=${encodeURIComponent(cleanTicketNumber)}`;
    }
  }, [ticket, cleanTicketNumber, bodyNumber]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="font-bold text-sm">Official Queue Ticket</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Ticket Receipt Area - Logo Part, Ticket Number, QR Code ONLY */}
        <div id="printable-ticket" className="p-5 bg-white text-slate-900 font-sans overflow-y-auto flex flex-col items-center text-center">
          {/* 1. Logo Part */}
          <div className="w-full pb-3 mb-3 border-b-2 border-dashed border-slate-300 flex flex-col items-center">
            <img 
              src={MTFRB_LOGO} 
              alt="MTFRB Official Seal" 
              className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-xs mb-1.5" 
            />
            <div className="text-xs font-black tracking-wider uppercase text-slate-900 leading-tight">
              MTFRB CASTILLEJOS | PORTAL
            </div>
            <div className="text-[10px] font-bold text-slate-700 leading-tight">
              Municipal Tricycle Franchising & Regulatory Board
            </div>
            <div className="text-[9px] text-slate-500 leading-tight">
              Castillejos, Zambales
            </div>
          </div>

          {/* 2. Ticket Number Part */}
          <div className="w-full py-2 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs mb-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
              Queue Ticket Number
            </div>
            <div className="text-5xl sm:text-6xl font-black tracking-tight font-ticket text-slate-950 leading-none py-1">
              {ticket.ticketNumber}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-200">
                {typeLabel}
              </span>
              {ticket.priorityLevel === 'PRIORITY' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  ★ Priority ({ticket.priorityReason || 'Special Lane'})
                </span>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200/80 px-3 text-xs text-slate-700 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Applicant:</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">{ticket.applicantName}</span>
              </div>
              {bodyNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Body No:</span>
                  <span className="font-mono font-bold text-teal-800">{bodyNumber}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Issued:</span>
                <span>{formattedDate} {formattedTime}</span>
              </div>
            </div>
          </div>

          {/* 3. QR Code Part */}
          <div className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2">
            <div className="p-2 bg-white rounded-lg border-2 border-slate-300 shadow-2xs">
              <QRCodeSVG
                value={trackerUrl}
                size={140}
                level="H"
                includeMargin={true}
                className="w-32 h-32 sm:w-36 sm:h-36"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-black text-teal-950 uppercase tracking-wide">
              <Smartphone className="w-4 h-4 text-teal-600" />
              <span>Mobile Live Tracker QR</span>
            </div>
            <p className="text-[10px] text-slate-500 max-w-[240px] leading-tight">
              Scan with phone camera to track live line position and receive vibration & audio alerts.
            </p>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
