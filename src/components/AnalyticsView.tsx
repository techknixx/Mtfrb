import React, { useState, useMemo } from 'react';
import { Ticket, ServiceCounter, getFranchiseTypeLabel } from '../types';
import { resetQueueData, saveTickets, saveCounters } from '../utils/storage';
import { MTFRB_LOGO } from '../assets/logo';
import { 
  BarChart3, 
  Users, 
  CheckCircle, 
  Clock, 
  Search, 
  Filter, 
  RotateCcw, 
  Download, 
  FileSpreadsheet, 
  Eye, 
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Check,
  Calendar,
  Layers,
  FileText,
  ListFilter,
  X,
  ChevronRight,
  Hash
} from 'lucide-react';

interface AnalyticsViewProps {
  tickets: Ticket[];
  counters: ServiceCounter[];
  onReset: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ tickets, counters, onReset }) => {
  const [activeTab, setActiveTab] = useState<'filter_data' | 'monthly_audit'>('filter_data');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [selectedDetailTicket, setSelectedDetailTicket] = useState<Ticket | null>(null);
  const [showAllTicketNumbers, setShowAllTicketNumbers] = useState<boolean>(false);
  const [selectedAuditMonth, setSelectedAuditMonth] = useState<string>('ALL');
  const [auditBodySearch, setAuditBodySearch] = useState<string>('');
  const [auditPeriodType, setAuditPeriodType] = useState<'monthly' | 'weekly'>('monthly');

  // Distinct months present in tickets or default current/recent months
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    // Ensure current month is always present
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    set.add(currentMonthKey);

    tickets.forEach((t) => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(key);
    });

    return Array.from(set).sort().reverse();
  }, [tickets]);

  const formatMonthLabel = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Filtered tickets list dependent on all active filters
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.bodyNumber && t.bodyNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.classification && t.classification.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.zone && t.zone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.franchiseNumber && t.franchiseNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.plateOrUnitNumber && t.plateOrUnitNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || t.franchiseType === typeFilter;
      const matchesZone = zoneFilter === 'ALL' || t.zone === zoneFilter;
      const matchesClassification = classificationFilter === 'ALL' || t.classification === classificationFilter;
      const matchesPriority = priorityFilter === 'ALL' || (priorityFilter === 'PRIORITY' ? t.priorityLevel === 'PRIORITY' : t.priorityLevel !== 'PRIORITY');

      let matchesMonth = true;
      if (monthFilter !== 'ALL') {
        const d = new Date(t.createdAt);
        const ticketMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        matchesMonth = ticketMonth === monthFilter;
      }

      return matchesSearch && matchesStatus && matchesType && matchesZone && matchesClassification && matchesPriority && matchesMonth;
    });
  }, [tickets, searchTerm, statusFilter, typeFilter, zoneFilter, classificationFilter, priorityFilter, monthFilter]);

  // Dynamic filter-dependent metrics calculated strictly from filteredTickets
  const filterSummary = useMemo(() => {
    const total = filteredTickets.length;
    const waiting = filteredTickets.filter((t) => t.status === 'WAITING').length;
    const calling = filteredTickets.filter((t) => t.status === 'CALLING').length;
    const serving = filteredTickets.filter((t) => t.status === 'SERVING').length;
    const completed = filteredTickets.filter((t) => t.status === 'COMPLETED').length;
    const noShow = filteredTickets.filter((t) => t.status === 'NO_SHOW').length;
    const newType = filteredTickets.filter((t) => t.franchiseType === 'NEW').length;
    const renewal = filteredTickets.filter((t) => t.franchiseType === 'RENEWAL').length;
    const changeMotor = filteredTickets.filter((t) => t.franchiseType === 'CHANGE_MOTOR').length;
    const dropping = filteredTickets.filter((t) => t.franchiseType === 'DROPPING').length;
    const priority = filteredTickets.filter((t) => t.priorityLevel === 'PRIORITY').length;
    const regular = total - priority;

    const completedWithTime = filteredTickets.filter((t) => t.status === 'COMPLETED' && t.servedAt);
    const avgWaitMin = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((acc, t) => acc + ((t.servedAt || t.createdAt) - t.createdAt), 0) / completedWithTime.length / 60000)
      : 8;

    const ticketNumbers = filteredTickets.map((t) => t.ticketNumber);

    return {
      total,
      waiting,
      calling,
      serving,
      activeService: calling + serving,
      completed,
      noShow,
      newType,
      renewal,
      changeMotor,
      dropping,
      priority,
      regular,
      avgWaitMin,
      ticketNumbers,
    };
  }, [filteredTickets]);

  // Monthly aggregated records for Audit Records
  const monthlyRecords = useMemo(() => {
    const groups: { [key: string]: Ticket[] } = {};

    tickets.forEach((t) => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const monthKeys = Object.keys(groups).sort().reverse();

    return monthKeys.map((key) => {
      const monthTickets = groups[key];
      const total = monthTickets.length;
      const completed = monthTickets.filter((t) => t.status === 'COMPLETED').length;
      const noShow = monthTickets.filter((t) => t.status === 'NO_SHOW').length;
      const newFranchise = monthTickets.filter((t) => t.franchiseType === 'NEW').length;
      const renewal = monthTickets.filter((t) => t.franchiseType === 'RENEWAL').length;
      const changeMotor = monthTickets.filter((t) => t.franchiseType === 'CHANGE_MOTOR').length;
      const dropping = monthTickets.filter((t) => t.franchiseType === 'DROPPING').length;
      const priority = monthTickets.filter((t) => t.priorityLevel === 'PRIORITY').length;

      const compWithTime = monthTickets.filter((t) => t.status === 'COMPLETED' && t.servedAt);
      const avgMinutes = compWithTime.length > 0
        ? Math.round(compWithTime.reduce((acc, t) => acc + ((t.servedAt || t.createdAt) - t.createdAt), 0) / compWithTime.length / 60000)
        : 8;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        monthKey: key,
        monthName: formatMonthLabel(key),
        total,
        completed,
        noShow,
        newFranchise,
        renewal,
        changeMotor,
        dropping,
        priority,
        avgMinutes,
        completionRate,
        tickets: monthTickets,
      };
    });
  }, [tickets]);

  // Weekly aggregated records for Audit Records
  const weeklyRecords = useMemo(() => {
    const groups: { [key: string]: { label: string; tickets: Ticket[] } } = {};

    tickets.forEach((t) => {
      const d = new Date(t.createdAt);
      const dayOfWeek = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const label = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      if (!groups[key]) groups[key] = { label, tickets: [] };
      groups[key].tickets.push(t);
    });

    const weekKeys = Object.keys(groups).sort().reverse();
    return weekKeys.map((key) => {
      const weekData = groups[key];
      const weekTickets = weekData.tickets;
      const total = weekTickets.length;
      const completed = weekTickets.filter((t) => t.status === 'COMPLETED').length;
      const noShow = weekTickets.filter((t) => t.status === 'NO_SHOW').length;
      const newFranchise = weekTickets.filter((t) => t.franchiseType === 'NEW').length;
      const renewal = weekTickets.filter((t) => t.franchiseType === 'RENEWAL').length;
      const changeMotor = weekTickets.filter((t) => t.franchiseType === 'CHANGE_MOTOR').length;
      const dropping = weekTickets.filter((t) => t.franchiseType === 'DROPPING').length;
      const priority = weekTickets.filter((t) => t.priorityLevel === 'PRIORITY').length;

      const compWithTime = weekTickets.filter((t) => t.status === 'COMPLETED' && t.servedAt);
      const avgMinutes = compWithTime.length > 0
        ? Math.round(compWithTime.reduce((acc, t) => acc + ((t.servedAt || t.createdAt) - t.createdAt), 0) / compWithTime.length / 60000)
        : 8;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        weekKey: key,
        weekName: weekData.label,
        total,
        completed,
        noShow,
        newFranchise,
        renewal,
        changeMotor,
        dropping,
        priority,
        avgMinutes,
        completionRate,
        tickets: weekTickets,
      };
    });
  }, [tickets]);

  // Search filtered tickets specifically for Audit Records (search by bodyNumber, ticket, name)
  const auditSearchTickets = useMemo(() => {
    let list = tickets;
    if (selectedAuditMonth !== 'ALL') {
      list = list.filter((t) => {
        const d = new Date(t.createdAt);
        const ticketMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ticketMonth === selectedAuditMonth;
      });
    }
    if (auditBodySearch.trim()) {
      const q = auditBodySearch.toLowerCase().trim();
      list = list.filter((t) =>
        (t.bodyNumber && t.bodyNumber.toLowerCase().includes(q)) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.applicantName.toLowerCase().includes(q) ||
        (t.plateOrUnitNumber && t.plateOrUnitNumber.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tickets, selectedAuditMonth, auditBodySearch]);

  const hasActiveFilters = 
    searchTerm.trim() !== '' || 
    statusFilter !== 'ALL' || 
    typeFilter !== 'ALL' || 
    zoneFilter !== 'ALL' || 
    classificationFilter !== 'ALL' || 
    priorityFilter !== 'ALL' || 
    monthFilter !== 'ALL';

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setZoneFilter('ALL');
    setClassificationFilter('ALL');
    setPriorityFilter('ALL');
    setMonthFilter('ALL');
  };

  const handleExportFilteredCSV = () => {
    const headers = ['Ticket Number', 'Type', 'Priority', 'Classification', 'Zone', 'Applicant Name', 'Franchise No', 'Body Number', 'Status', 'Counter', 'Created Time', 'Notes'];
    const rows = filteredTickets.map((t) => [
      t.ticketNumber,
      getFranchiseTypeLabel(t.franchiseType),
      t.priorityLevel,
      `"${t.classification || 'Operator'}"`,
      `"${t.zone || 'Zone 1'}"`,
      `"${t.applicantName}"`,
      t.franchiseNumber || '',
      t.bodyNumber || t.plateOrUnitNumber || '',
      t.status,
      t.assignedCounter || '',
      new Date(t.createdAt).toLocaleString(),
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mtfrb_filtered_tickets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMonthlyAuditCSV = (monthKey: string) => {
    const targetMonth = monthlyRecords.find((m) => m.monthKey === monthKey);
    const targetTickets = targetMonth ? targetMonth.tickets : tickets;

    const headers = ['Audit ID', 'Period', 'Ticket Number', 'Type', 'Priority', 'Applicant', 'Body Number', 'Classification', 'Zone', 'Status', 'Assigned Counter', 'Time Created', 'Time Served'];
    const rows = targetTickets.map((t) => [
      t.id,
      monthKey,
      t.ticketNumber,
      getFranchiseTypeLabel(t.franchiseType),
      t.priorityLevel,
      `"${t.applicantName}"`,
      t.bodyNumber || t.plateOrUnitNumber || '',
      `"${t.classification || 'Operator'}"`,
      `"${t.zone || 'Zone 1'}"`,
      t.status,
      t.assignedCounter || '—',
      new Date(t.createdAt).toLocaleString(),
      t.servedAt ? new Date(t.servedAt).toLocaleString() : '—'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mtfrb_audit_records_${monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top Header & Tab Controls - Uniform Admin/Profile Gradient Style */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl text-white p-6 sm:p-8 shadow-lg border border-teal-800/60 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-teal-800/80 border-2 border-amber-400/80 text-amber-300 flex items-center justify-center shrink-0 shadow-md">
            <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900">
                Reports & Audit Records
              </span>
              <span className="text-xs text-teal-200 font-semibold">
                MTFRB CASTILLEJOS | PORTAL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-white">
              Queue Performance & Monthly Audit Records
            </h1>
            <p className="text-xs sm:text-sm text-teal-100 max-w-xl mt-1">
              Comprehensive municipal franchise queue analytics, filter-dependent ticket summaries, and monthly audit reports.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10 w-full md:w-auto">
          {/* View Tab Switcher */}
          <div className="bg-slate-950/60 p-1 rounded-xl flex items-center border border-teal-700/50 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('filter_data')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'filter_data'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-teal-200 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Filter & Ticket Data</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('monthly_audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'monthly_audit'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-teal-200 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Monthly Audit Records</span>
            </button>
          </div>

          <button
            onClick={activeTab === 'filter_data' ? handleExportFilteredCSV : () => handleExportMonthlyAuditCSV(availableMonths[0] || 'all')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-800/90 hover:bg-teal-700 border border-teal-600/60 rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
            title="Reset queue and reload sample test tickets"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Sample</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Filter & Ticket Data with Dynamic Ticket Number Summary */}
      {activeTab === 'filter_data' && (
        <div className="space-y-4">
          {/* Search & Filter Control Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search ticket number, applicant, plate/body, franchise number..."
                  className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Selectors */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {/* Month Filter */}
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="text-xs py-2 px-2.5 border border-slate-300 rounded-xl bg-white outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                >
                  <option value="ALL">All Months</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs py-2 px-2.5 border border-slate-300 rounded-xl bg-white outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="WAITING">Waiting</option>
                  <option value="CALLING">Calling</option>
                  <option value="SERVING">Serving</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NO_SHOW">No-Show</option>
                </select>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs py-2 px-2.5 border border-slate-300 rounded-xl bg-white outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                >
                  <option value="ALL">All Types</option>
                  <option value="NEW">New Franchise (N-)</option>
                  <option value="RENEWAL">Renewal (R-)</option>
                  <option value="CHANGE_MOTOR">Change Motor (CM-)</option>
                  <option value="DROPPING">Order for Dropping (OD-)</option>
                </select>

                {/* Zone Filter */}
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="text-xs py-2 px-2.5 border border-slate-300 rounded-xl bg-white outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                >
                  <option value="ALL">All Zones</option>
                  <option value="Zone 1">Zone 1</option>
                  <option value="Zone 2">Zone 2</option>
                  <option value="Zone 3">Zone 3</option>
                  <option value="Zone 4">Zone 4</option>
                  <option value="Zone 5">Zone 5</option>
                  <option value="Zone 6">Zone 6</option>
                </select>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="text-xs py-2 px-2.5 border border-slate-300 rounded-xl bg-white outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="PRIORITY">Priority Only</option>
                  <option value="REGULAR">Regular Only</option>
                </select>

                {/* Classification Filter */}
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="text-xs py-2 px-2.5 border border-slate-300 rounded-xl bg-white outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                >
                  <option value="ALL">Classifications</option>
                  <option value="Operator">Operator</option>
                  <option value="Driver">Driver</option>
                </select>
              </div>
            </div>

            {/* Active Filter Badges Strip */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-semibold text-[11px] mr-1">Active Filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                    Search: "{searchTerm}"
                  </span>
                )}
                {monthFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 font-medium">
                    Month: {formatMonthLabel(monthFilter)}
                  </span>
                )}
                {statusFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 font-medium">
                    Status: {statusFilter}
                  </span>
                )}
                {typeFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 font-medium">
                    Type: {typeFilter}
                  </span>
                )}
                {zoneFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 font-medium">
                    Zone: {zoneFilter}
                  </span>
                )}
                {priorityFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                    Priority: {priorityFilter}
                  </span>
                )}
                {classificationFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 font-medium">
                    Class: {classificationFilter}
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-auto text-[11px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* DYNAMIC TOTAL SUMMARY OF TICKET NUMBER & DEPENDENT TO ACTIVE FILTERS */}
          <div className="bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-teal-800/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-600/30 border border-teal-500/40 text-teal-400">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-wide text-white">
                    Filter-Dependent Ticket Summary
                  </h3>
                  <p className="text-xs text-teal-300/80">
                    Live dynamic aggregation recalculating strictly based on your active filters.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Total Matching Tickets</div>
                  <div className="text-2xl sm:text-3xl font-black font-ticket text-amber-400">
                    {filterSummary.total} <span className="text-xs font-normal text-slate-400">/ {tickets.length} total</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metric Counters dependent on active filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2 text-xs">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">Waiting</div>
                <div className="text-lg font-bold text-white mt-0.5">{filterSummary.waiting}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">Serving / Calling</div>
                <div className="text-lg font-bold text-teal-400 mt-0.5">{filterSummary.activeService}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">Completed</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{filterSummary.completed}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">No-Show</div>
                <div className="text-lg font-bold text-rose-400 mt-0.5">{filterSummary.noShow}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">New (N-)</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">{filterSummary.newType}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">Renewal (R-)</div>
                <div className="text-lg font-bold text-indigo-400 mt-0.5">{filterSummary.renewal}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">Change Motor (CM-)</div>
                <div className="text-lg font-bold text-amber-300 mt-0.5">{filterSummary.changeMotor}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">Dropping (OD-)</div>
                <div className="text-lg font-bold text-purple-400 mt-0.5">{filterSummary.dropping}</div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                <div className="text-slate-400 font-medium text-[10px]">Priority Lane</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{filterSummary.priority}</div>
              </div>
            </div>

            {/* List of Ticket Numbers matching the active filter */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span>Ticket Numbers in Filtered Result ({filterSummary.ticketNumbers.length}):</span>
                </div>
                {filterSummary.ticketNumbers.length > 15 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTicketNumbers(!showAllTicketNumbers)}
                    className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer underline"
                  >
                    {showAllTicketNumbers ? 'Show Less' : `View All ${filterSummary.ticketNumbers.length} Numbers`}
                  </button>
                )}
              </div>

              {filterSummary.ticketNumbers.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No tickets match the selected criteria.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {(showAllTicketNumbers
                    ? filterSummary.ticketNumbers
                    : filterSummary.ticketNumbers.slice(0, 16)
                  ).map((tNum) => (
                    <span
                      key={tNum}
                      className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-800/90 text-teal-300 border border-slate-700 shadow-2xs"
                    >
                      {tNum}
                    </span>
                  ))}
                  {!showAllTicketNumbers && filterSummary.ticketNumbers.length > 16 && (
                    <span className="px-2 py-0.5 rounded-md text-xs text-slate-400 bg-slate-800/50">
                      +{filterSummary.ticketNumbers.length - 16} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Audit Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">
                Detailed Queue Records ({filteredTickets.length} items)
              </h3>
              <span className="text-xs text-slate-500">
                Showing tickets matching active filters
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Ticket No</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Applicant Name</th>
                    <th className="px-4 py-3">Body Number</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Counter</th>
                    <th className="px-4 py-3">Date / Time</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        No ticket records match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-ticket font-extrabold text-slate-900 text-sm">
                          {t.ticketNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-800">
                              {getFranchiseTypeLabel(t.franchiseType)}
                            </span>
                            {t.priorityLevel === 'PRIORITY' && (
                              <span className="text-[10px] font-bold text-amber-700">★ Priority</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            {t.classification || 'Operator'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                            {t.zone || 'Zone 1'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{t.applicantName}</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {t.bodyNumber || t.plateOrUnitNumber || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              t.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'SERVING'
                                ? 'bg-teal-100 text-teal-800'
                                : t.status === 'CALLING'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : t.status === 'NO_SHOW'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {t.assignedCounter ? `Counter ${t.assignedCounter}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          <div>{new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="text-[10px] text-slate-400">{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedDetailTicket(t)}
                            className="px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50 border border-teal-200 rounded-lg transition-colors cursor-pointer font-semibold"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Monthly & Weekly Records for Audit Records */}
      {activeTab === 'monthly_audit' && (
        <div className="space-y-5">
          {/* Monthly/Weekly Audit Overview Banner */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-700" />
                  <span>Audit Records Archive (Monthly & Weekly)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search historical records by Body Number, review monthly/weekly compliance metrics, and inspect MTFRB audit logs.
                </p>
              </div>

              {/* Period Type Toggle & Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setAuditPeriodType('monthly')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      auditPeriodType === 'monthly'
                        ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditPeriodType('weekly')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      auditPeriodType === 'weekly'
                        ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Weekly Summary
                  </button>
                </div>

                <select
                  value={selectedAuditMonth}
                  onChange={(e) => setSelectedAuditMonth(e.target.value)}
                  className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-800"
                >
                  <option value="ALL">All Available Months</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dedicated Search Functionality via Body Number */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditBodySearch}
                  onChange={(e) => setAuditBodySearch(e.target.value)}
                  placeholder="Search Audit Records by Body Number (e.g. 077, 102), Applicant Name, or Ticket..."
                  className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-medium"
                />
                {auditBodySearch && (
                  <button
                    onClick={() => setAuditBodySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {auditBodySearch && (
                <div className="text-xs text-teal-800 font-semibold bg-teal-50 px-3 py-2 rounded-xl border border-teal-200 flex items-center gap-1.5 shrink-0">
                  <Hash className="w-3.5 h-3.5 text-teal-600" />
                  <span>Filtered: {auditSearchTickets.length} matching audit ticket(s)</span>
                </div>
              )}
            </div>
          </div>

          {/* Period Summary Cards Grid (Monthly or Weekly) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auditPeriodType === 'monthly' ? (
              (selectedAuditMonth === 'ALL'
                ? monthlyRecords
                : monthlyRecords.filter((m) => m.monthKey === selectedAuditMonth)
              ).map((record) => (
                <div
                  key={record.monthKey}
                  className="bg-white rounded-2xl border-2 border-slate-200 hover:border-teal-400 p-5 shadow-xs transition-all space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-black text-slate-900">{record.monthName}</h3>
                        <span className="text-[11px] font-mono text-slate-500">Monthly Period: {record.monthKey}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-900 border border-teal-300">
                        {record.total} Tickets
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 py-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="text-slate-500 text-[11px] font-medium">Completed</div>
                        <div className="text-base font-black text-emerald-700 mt-0.5">
                          {record.completed}
                          <span className="text-[10px] font-semibold text-slate-500 ml-1">
                            ({record.completionRate}%)
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="text-slate-500 text-[11px] font-medium">Avg Wait Time</div>
                        <div className="text-base font-black text-slate-800 mt-0.5">
                          ~{record.avgMinutes} mins
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 col-span-2">
                        <div className="text-slate-500 text-[10px] font-medium">Franchise Breakdown</div>
                        <div className="text-[11px] font-bold text-slate-800 mt-0.5 flex flex-wrap gap-2">
                          <span className="text-sky-700">New: {record.newFranchise}</span>
                          <span>•</span>
                          <span className="text-indigo-700">Renewal: {record.renewal}</span>
                          <span>•</span>
                          <span className="text-amber-700">Change Motor: {record.changeMotor}</span>
                          <span>•</span>
                          <span className="text-purple-700">Dropping: {record.dropping}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMonthFilter(record.monthKey);
                        setActiveTab('filter_data');
                      }}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Filter View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportMonthlyAuditCSV(record.monthKey)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      title="Export official monthly audit CSV"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              weeklyRecords.map((record) => (
                <div
                  key={record.weekKey}
                  className="bg-white rounded-2xl border-2 border-slate-200 hover:border-teal-400 p-5 shadow-xs transition-all space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-black text-slate-900">{record.weekName}</h3>
                        <span className="text-[11px] font-mono text-slate-500">Week Period: {record.weekKey}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-900 border border-teal-300">
                        {record.total} Tickets
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 py-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="text-slate-500 text-[11px] font-medium">Completed</div>
                        <div className="text-base font-black text-emerald-700 mt-0.5">
                          {record.completed}
                          <span className="text-[10px] font-semibold text-slate-500 ml-1">
                            ({record.completionRate}%)
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="text-slate-500 text-[11px] font-medium">Avg Wait Time</div>
                        <div className="text-base font-black text-slate-800 mt-0.5">
                          ~{record.avgMinutes} mins
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 col-span-2">
                        <div className="text-slate-500 text-[10px] font-medium">Franchise Breakdown</div>
                        <div className="text-[11px] font-bold text-slate-800 mt-0.5 flex flex-wrap gap-2">
                          <span className="text-sky-700">New: {record.newFranchise}</span>
                          <span>•</span>
                          <span className="text-indigo-700">Renewal: {record.renewal}</span>
                          <span>•</span>
                          <span className="text-amber-700">Change Motor: {record.changeMotor}</span>
                          <span>•</span>
                          <span className="text-purple-700">Dropping: {record.dropping}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 font-medium">
                      Priority: <strong className="text-amber-700">{record.priority}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const targetTickets = record.tickets;
                        const headers = ['Audit ID', 'Period', 'Ticket Number', 'Type', 'Priority', 'Applicant', 'Body Number', 'Status', 'Counter', 'Created Time'];
                        const rows = targetTickets.map((t) => [
                          t.id,
                          record.weekKey,
                          t.ticketNumber,
                          getFranchiseTypeLabel(t.franchiseType),
                          t.priorityLevel,
                          `"${t.applicantName}"`,
                          t.bodyNumber || t.plateOrUnitNumber || '',
                          t.status,
                          t.assignedCounter || '—',
                          new Date(t.createdAt).toLocaleString()
                        ]);
                        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                        const link = document.createElement('a');
                        link.setAttribute('href', encodeURI(csvContent));
                        link.setAttribute('download', `mtfrb_audit_weekly_${record.weekKey}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export Week</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Searchable Audit Records Table (with Body Number search integration) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Audit Records Log ({auditSearchTickets.length} records)
                </h3>
                <p className="text-xs text-slate-500">
                  Searchable by Body Number, applicant name, and ticket number.
                </p>
              </div>
              {auditBodySearch && (
                <button
                  type="button"
                  onClick={() => setAuditBodySearch('')}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                >
                  Clear Body Number Search
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Ticket No</th>
                    <th className="px-4 py-3">Body Number</th>
                    <th className="px-4 py-3">Franchise Type</th>
                    <th className="px-4 py-3">Applicant Name</th>
                    <th className="px-4 py-3">Zone & Class</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Counter</th>
                    <th className="px-4 py-3">Date Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditSearchTickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        No audit records found matching your Body Number search or period.
                      </td>
                    </tr>
                  ) : (
                    auditSearchTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-ticket font-extrabold text-slate-900 text-sm">
                          {t.ticketNumber}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            {t.bodyNumber || t.plateOrUnitNumber || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800">
                            {getFranchiseTypeLabel(t.franchiseType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {t.applicantName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {t.zone || 'Zone 1'} • {t.classification || 'Operator'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              t.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'SERVING'
                                ? 'bg-teal-100 text-teal-800'
                                : t.status === 'CALLING'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : t.status === 'NO_SHOW'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {t.assignedCounter ? `Counter ${t.assignedCounter}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedDetailTicket(t)}
                            className="px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50 border border-teal-200 rounded-lg transition-colors cursor-pointer font-semibold"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Inspection Modal */}
      {selectedDetailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="font-ticket font-black text-xl text-slate-900">
                  {selectedDetailTicket.ticketNumber}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold border border-teal-200">
                  {getFranchiseTypeLabel(selectedDetailTicket.franchiseType)}
                </span>
                {selectedDetailTicket.priorityLevel === 'PRIORITY' && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-200">
                    ★ Priority
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedDetailTicket(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <span className="text-slate-500 font-medium block">Applicant Name</span>
                  <span className="font-extrabold text-sm text-slate-800">{selectedDetailTicket.applicantName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Body Number</span>
                  <span className="font-mono font-black text-base text-teal-800">{selectedDetailTicket.bodyNumber || selectedDetailTicket.plateOrUnitNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Queue Status</span>
                  <span className="font-extrabold text-sm text-teal-800">{selectedDetailTicket.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Classification</span>
                  <span className="font-bold text-blue-800">{selectedDetailTicket.classification || 'Operator'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Franchise Zone</span>
                  <span className="font-bold text-teal-800">{selectedDetailTicket.zone || 'Zone 1'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Assigned Officer</span>
                  <span className="font-bold text-slate-800">{selectedDetailTicket.assignedOfficer || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Served Counter</span>
                  <span className="font-bold text-slate-800">
                    {selectedDetailTicket.assignedCounter ? `Counter ${selectedDetailTicket.assignedCounter}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Mobile Contact</span>
                  <span className="font-mono font-bold text-slate-800">{selectedDetailTicket.contactNumber || 'None provided'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Date & Time Created</span>
                  <span className="font-medium text-slate-700">
                    {new Date(selectedDetailTicket.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedDetailTicket.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">Evaluation & Officer Notes:</span>
                  <p className="text-slate-600 italic">{selectedDetailTicket.notes}</p>
                </div>
              )}

              <div>
                <span className="font-bold text-slate-700 block mb-1.5">Verified Documents Checklist:</span>
                {selectedDetailTicket.verifiedDocuments && selectedDetailTicket.verifiedDocuments.length > 0 ? (
                  <ul className="space-y-1">
                    {selectedDetailTicket.verifiedDocuments.map((docId) => (
                      <li key={docId} className="flex items-center gap-1.5 text-slate-700">
                        <Check className="w-3.5 h-3.5 text-teal-600" />
                        <span className="capitalize">{docId.replace('doc_', '').replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400 italic">No checklist items recorded yet.</span>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setSelectedDetailTicket(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
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
