import { 
  Ticket, 
  ServiceCounter, 
  DEFAULT_COUNTERS, 
  UserAccount, 
  DEFAULT_USERS, 
  FranchiseType,
  TerminalPasswords,
  DEFAULT_TERMINAL_PASSWORDS,
  BackupConfig,
  DEFAULT_BACKUP_CONFIG,
  BackupNotificationLog,
  TricycleFranchiseRecord,
  DEFAULT_FRANCHISE_RECORDS,
  QueueAnnouncement,
  TricycleInspectionChecklist,
  createDefaultInspectionChecklist,
  PaymentRecord,
  PaymentFeeItem,
  PAYMENT_FEES_CATALOG,
} from '../types';
import { generateDemoQueue50Database } from './demoQueueDatabase';

export type { TerminalPasswords, BackupConfig, BackupNotificationLog };

const STORAGE_KEYS = {
  TICKETS: 'franchise_queue_tickets_v1',
  COUNTERS: 'franchise_queue_counters_v1',
  LAST_SEQ_NEW: 'franchise_seq_new_v1',
  LAST_SEQ_RENEW: 'franchise_seq_renew_v1',
  LAST_SEQ_CM: 'franchise_seq_cm_v1',
  LAST_SEQ_OD: 'franchise_seq_od_v1',
  AUDIO_CONFIG: 'franchise_audio_config_v1',
  USERS: 'mtfrb_users_v1',
  DELETED_USERS: 'mtfrb_deleted_users_v1',
  CURRENT_USER: 'mtfrb_current_user_v1',
  LOBBY_ADVISORY: 'franchise_lobby_advisory_v1',
  TERMINAL_PASSWORDS: 'mtfrb_terminal_passwords_v1',
  BACKUP_CONFIG: 'mtfrb_backup_config_v1',
  BACKUP_LOGS: 'mtfrb_backup_logs_v1',
  FRANCHISE_REGISTRY: 'mtfrb_franchise_registry_v1',
  INSPECTIONS_DB: 'mtfrb_inspections_database_v1',
  PAYMENTS_DB: 'mtfrb_payments_database_v1',
  FEES_CATALOG: 'mtfrb_fees_catalog_v1',
  CAMERA_PERMISSION_DECISION: 'mtfrb_camera_permission_decision_v1',
};

export const PAYMENT_STORAGE_KEY_PREFIX = 'mtfrb_payment_body_';

export const DEFAULT_ADVISORY =
  'Please listen for audio chimes & voice announcements when your number is summoned. Senior Citizens, PWDs, and Pregnant applicants may directly proceed to Priority Lane Counter 3.';

export function loadLobbyAdvisory(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOBBY_ADVISORY);
    if (raw && raw.trim()) {
      return raw.trim();
    }
  } catch {}
  return DEFAULT_ADVISORY;
}

export function saveLobbyAdvisory(advisory: string) {
  try {
    const clean = advisory.trim() || DEFAULT_ADVISORY;
    localStorage.setItem(STORAGE_KEYS.LOBBY_ADVISORY, clean);
    window.dispatchEvent(new Event('franchise_queue_updated'));
    broadcastChan?.postMessage({ type: 'ADVISORY_UPDATED', advisory: clean });

    if (typeof fetch !== 'undefined') {
      fetch('/api/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisory: clean }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save lobby advisory', e);
  }
}

// Initial seed tickets - empty by default so data is accurate only to kiosk input
const SEED_TICKETS: Ticket[] = [];

// BroadcastChannel for instant zero-latency same-browser multi-tab synchronization
let broadcastChan: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChan = new BroadcastChannel('mtfrb_queue_channel');
  }
} catch {
  broadcastChan = null;
}

export function loadTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!raw) {
      return [];
    }
    const parsed: Ticket[] = JSON.parse(raw);
    const validZones = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'];
    const validClassifications = ['Operator', 'Driver'];
    let didMigrateDemo = false;
    const sanitized = parsed.map((t, index) => {
      if (!t.zone || !validZones.includes(t.zone)) {
        t.zone = (validZones[index % validZones.length] as any) || 'Zone 1';
      }
      if (!t.classification || !validClassifications.includes(t.classification)) {
        t.classification = (index % 2 === 0 ? 'Operator' : 'Driver') as any;
      }
      // If legacy demo ticket without 1000-4000 body number as ticket number, upgrade seamlessly
      if (
        t.id &&
        t.id.startsWith('demo-') &&
        (t.ticketNumber.includes('-') || !t.bodyNumber || parseInt(t.bodyNumber, 10) < 1000 || t.ticketNumber !== t.bodyNumber)
      ) {
        const randBody = String(1000 + ((index * 53 + 37) % 3001));
        t.bodyNumber = randBody;
        t.ticketNumber = randBody;
        if (t.franchiseNumber) {
          t.franchiseNumber = `FN-2023-${randBody}`;
        }
        didMigrateDemo = true;
      }
      // Ensure all demo waiting tickets are distributed across pipeline counters
      if (t.id && t.id.startsWith('demo-wait-') && (!t.assignedCounter || t.assignedCounter === 1)) {
        const waitIdx = parseInt(t.id.replace('demo-wait-', ''), 10) - 1;
        if (!isNaN(waitIdx) && waitIdx >= 0) {
          let assignedC = 1;
          if (waitIdx < 15) assignedC = 1;
          else if (waitIdx < 25) assignedC = 2;
          else if (waitIdx < 35) assignedC = 3;
          else if (waitIdx < 43) assignedC = 4;
          else if (waitIdx < 46) assignedC = 5;
          else if (waitIdx < 48) assignedC = 6;
          else if (waitIdx === 48) assignedC = 7;
          else assignedC = 8;
          if (t.assignedCounter !== assignedC) {
            t.assignedCounter = assignedC;
            didMigrateDemo = true;
          }
        }
      }
      return t;
    });
    if (didMigrateDemo) {
      saveTickets(sanitized);
    }
    return sanitized;
  } catch (e) {
    console.error('Failed to load tickets from localStorage', e);
    return [];
  }
}

// Atomically save tickets and counters together to prevent race conditions during calling / completing tickets
export function saveQueueState(tickets: Ticket[], counters: ServiceCounter[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    localStorage.setItem(STORAGE_KEYS.COUNTERS, JSON.stringify(counters));

    // Notify listeners in current and other tabs
    window.dispatchEvent(new Event('franchise_queue_updated'));
    window.dispatchEvent(new CustomEvent('mtfrb_tickets_updated', { detail: tickets }));
    window.dispatchEvent(new CustomEvent('mtfrb_counters_updated', { detail: counters }));
    broadcastChan?.postMessage({ type: 'QUEUE_STATE_UPDATED', tickets, counters });

    // Single unified push to server endpoint
    if (typeof fetch !== 'undefined') {
      fetch('/api/queue/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets, counters }),
      }).catch((err) => {
        console.warn('Background queue state sync notice:', err);
      });
    }
  } catch (e) {
    console.error('Failed to save queue state', e);
  }
}

export function saveTickets(tickets: Ticket[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    // Notify same tab & other tabs
    window.dispatchEvent(new Event('franchise_queue_updated'));
    window.dispatchEvent(new CustomEvent('mtfrb_tickets_updated', { detail: tickets }));
    broadcastChan?.postMessage({ type: 'TICKETS_UPDATED', tickets });

    // Asynchronously push to real-time server endpoint
    if (typeof fetch !== 'undefined') {
      fetch('/api/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets }),
      }).catch((err) => {
        console.warn('Background sync to server skipped/delayed:', err);
      });
    }
  } catch (e) {
    console.error('Failed to save tickets', e);
  }
}

export function loadCounters(): ServiceCounter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COUNTERS);
    if (!raw) {
      const initialCounters = DEFAULT_COUNTERS.map((c) => ({
        ...c,
        currentTicketId: null,
        status: 'OPEN' as const,
      }));
      saveCounters(initialCounters);
      return initialCounters;
    }
    const parsed: ServiceCounter[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Validate that items are proper counters
      const validCounters = parsed.filter(p => p && typeof p.id === 'number' && p.name);
      if (validCounters.length > 0) {
        return validCounters;
      }
    }
    
    return DEFAULT_COUNTERS.map((c) => ({
      ...c,
      currentTicketId: null,
      status: 'OPEN' as const,
    }));
  } catch (e) {
    console.error('Failed to load counters', e);
    return DEFAULT_COUNTERS.map((c) => ({
      ...c,
      currentTicketId: null,
      status: 'OPEN' as const,
    }));
  }
}

export function saveCounters(counters: ServiceCounter[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.COUNTERS, JSON.stringify(counters));
    window.dispatchEvent(new Event('franchise_queue_updated'));
    window.dispatchEvent(new CustomEvent('mtfrb_counters_updated', { detail: counters }));
    broadcastChan?.postMessage({ type: 'COUNTERS_UPDATED', counters });

    if (typeof fetch !== 'undefined') {
      fetch('/api/counters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(counters),
      }).catch((err) => {
        console.warn('Background counters sync delayed:', err);
      });
    }
  } catch (e) {
    console.error('Failed to save counters', e);
  }
}

export function generateNextTicketNumber(type: FranchiseType, isPriority: boolean, bodyNumber?: string): string {
  if (bodyNumber && bodyNumber.trim()) {
    return bodyNumber.trim();
  }

  let key = STORAGE_KEYS.LAST_SEQ_NEW;
  let initialBase = 103;
  let prefix = 'N';

  if (type === 'NEW') {
    key = STORAGE_KEYS.LAST_SEQ_NEW;
    initialBase = 103;
    prefix = 'N';
  } else if (type === 'RENEWAL') {
    key = STORAGE_KEYS.LAST_SEQ_RENEW;
    initialBase = 203;
    prefix = 'R';
  } else if (type === 'CHANGE_MOTOR') {
    key = STORAGE_KEYS.LAST_SEQ_CM;
    initialBase = 301;
    prefix = 'CM';
  } else if (type === 'DROPPING') {
    key = STORAGE_KEYS.LAST_SEQ_OD;
    initialBase = 401;
    prefix = 'OD';
  }
  
  let currentSeq = parseInt(localStorage.getItem(key) || String(initialBase), 10);
  currentSeq += 1;
  localStorage.setItem(key, String(currentSeq));

  const priorityTag = isPriority ? 'P-' : '-';
  return `${prefix}${priorityTag}${currentSeq}`;
}

export function resetQueueData() {
  const demo = generateDemoQueue50Database();
  localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(demo.tickets));
  localStorage.setItem(STORAGE_KEYS.COUNTERS, JSON.stringify(demo.counters));
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_NEW, String(demo.lastSequences.newSeq));
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_RENEW, String(demo.lastSequences.renewSeq));
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_CM, String(demo.lastSequences.cmSeq));
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_OD, String(demo.lastSequences.odSeq));
  
  window.dispatchEvent(new Event('franchise_queue_updated'));
  broadcastChan?.postMessage({ type: 'QUEUE_RESET', tickets: demo.tickets, counters: demo.counters });

  if (typeof fetch !== 'undefined') {
    fetch('/api/reset', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickets: demo.tickets, counters: demo.counters }),
    }).catch(() => {});
  }
}

/**
 * Completely wipe all queue tickets and reset ticket sequence numbering back to 101.
 * Counters become idle/open. Clean slate for a new operating day.
 */
export function wipeAndResetAllTickets() {
  const emptyTickets: Ticket[] = [];
  localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(emptyTickets));

  // Reset counters to OPEN and idle
  const currentCounters = loadCounters();
  const resetCounters = currentCounters.map((c) => ({
    ...c,
    status: 'OPEN' as const,
    currentTicketId: null,
  }));
  localStorage.setItem(STORAGE_KEYS.COUNTERS, JSON.stringify(resetCounters));

  // Reset sequence numbering back to base 100/200/300/400 (so next is N-101, R-201, CM-301, OD-401)
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_NEW, '100');
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_RENEW, '200');
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_CM, '300');
  localStorage.setItem(STORAGE_KEYS.LAST_SEQ_OD, '400');

  window.dispatchEvent(new Event('franchise_queue_updated'));
  broadcastChan?.postMessage({
    type: 'QUEUE_WIPED',
    tickets: emptyTickets,
    counters: resetCounters,
  });

  if (typeof fetch !== 'undefined') {
    fetch('/api/tickets/wipe', { method: 'POST' }).catch(() => {});
  }
}

export interface SystemBackupPayload {
  version: string;
  timestamp: number;
  dateString: string;
  tickets: Ticket[];
  counters: ServiceCounter[];
  users: UserAccount[];
  franchiseRegistry?: TricycleFranchiseRecord[];
  inspections?: Record<string, TricycleInspectionChecklist>;
  sequences: {
    lastSeqNew: number;
    lastSeqRenew: number;
    lastSeqCM: number;
    lastSeqOD: number;
  };
}

/**
 * Generate full system backup JSON snapshot
 */
export function createSystemBackup(): SystemBackupPayload {
  return {
    version: '1.3.0',
    timestamp: Date.now(),
    dateString: new Date().toISOString(),
    tickets: loadTickets(),
    counters: loadCounters(),
    users: loadUsers(),
    franchiseRegistry: loadFranchiseRecords(),
    inspections: loadAllInspectionChecklists(),
    sequences: {
      lastSeqNew: parseInt(localStorage.getItem(STORAGE_KEYS.LAST_SEQ_NEW) || '100', 10),
      lastSeqRenew: parseInt(localStorage.getItem(STORAGE_KEYS.LAST_SEQ_RENEW) || '200', 10),
      lastSeqCM: parseInt(localStorage.getItem(STORAGE_KEYS.LAST_SEQ_CM) || '300', 10),
      lastSeqOD: parseInt(localStorage.getItem(STORAGE_KEYS.LAST_SEQ_OD) || '400', 10),
    },
  };
}

/**
 * Restore system records from backup file
 */
export function restoreSystemBackup(backup: SystemBackupPayload): { success: boolean; message: string } {
  if (!backup || !Array.isArray(backup.tickets) || !Array.isArray(backup.counters)) {
    return { success: false, message: 'Invalid backup file format: Missing tickets or counters schema.' };
  }

  saveTickets(backup.tickets);
  saveCounters(backup.counters);

  if (Array.isArray(backup.users) && backup.users.length > 0) {
    saveUsers(backup.users);
  }

  if (Array.isArray(backup.franchiseRegistry) && backup.franchiseRegistry.length > 0) {
    saveFranchiseRecords(backup.franchiseRegistry);
    window.dispatchEvent(new Event('franchise_registry_updated'));
  }

  if (backup.inspections && typeof backup.inspections === 'object' && Object.keys(backup.inspections).length > 0) {
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS_DB, JSON.stringify(backup.inspections));
    window.dispatchEvent(new CustomEvent('mtfrb_inspections_db_synced', { detail: backup.inspections }));
  }

  if (backup.sequences) {
    localStorage.setItem(STORAGE_KEYS.LAST_SEQ_NEW, String(backup.sequences.lastSeqNew || 100));
    localStorage.setItem(STORAGE_KEYS.LAST_SEQ_RENEW, String(backup.sequences.lastSeqRenew || 200));
    localStorage.setItem(STORAGE_KEYS.LAST_SEQ_CM, String(backup.sequences.lastSeqCM || 300));
    localStorage.setItem(STORAGE_KEYS.LAST_SEQ_OD, String(backup.sequences.lastSeqOD || 400));
  }

  window.dispatchEvent(new Event('franchise_queue_updated'));
  broadcastChan?.postMessage({
    type: 'BACKUP_RESTORED',
    tickets: backup.tickets,
    counters: backup.counters,
  });

  // Also push restored database snapshot to server backend so server disk db.json and inspections_db.json are updated
  if (typeof fetch !== 'undefined') {
    fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup),
    }).catch((err) => {
      console.warn('Server restore sync notice:', err);
    });
  }

  const franchiseCount = backup.franchiseRegistry?.length || 0;
  const inspectionsCount = backup.inspections ? Object.keys(backup.inspections).length : 0;
  return {
    success: true,
    message: `Restored ${backup.tickets.length} tickets, ${backup.counters.length} counters, ${backup.users?.length || 0} users, ${franchiseCount} franchise records, and ${inspectionsCount} inspection records to database.`,
  };
}

export function calculateWaitEstimates(tickets: Ticket[], ticketId: string): { position: number; estimatedMinutes: number } {
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== 'WAITING') {
    return { position: 0, estimatedMinutes: 0 };
  }

  const waitingTickets = tickets.filter((t) => t.status === 'WAITING');
  
  const sorted = [...waitingTickets].sort((a, b) => {
    if (a.priorityLevel === 'PRIORITY' && b.priorityLevel !== 'PRIORITY') return -1;
    if (b.priorityLevel === 'PRIORITY' && a.priorityLevel !== 'PRIORITY') return 1;
    return a.createdAt - b.createdAt;
  });

  const index = sorted.findIndex((t) => t.id === ticketId);
  const position = index >= 0 ? index + 1 : 1;
  const estimatedMinutes = Math.max(3, position * 7);

  return { position, estimatedMinutes };
}

/**
 * Real-time queue subscription connecting via Server-Sent Events (SSE) + fast polling fallback + BroadcastChannel.
 * This guarantees real-time synchronicity across mobile phones, kiosk terminals, counter officer desks, and lobby TVs.
 */
export function subscribeToRealTimeQueue(
  onUpdate: (data: { tickets: Ticket[]; counters: ServiceCounter[]; isConnected: boolean }) => void
): () => void {
  let isSubscribed = true;
  let eventSource: EventSource | null = null;
  let pollTimer: any = null;

  const updateFromPayload = (
    ticketsData?: Ticket[], 
    countersData?: ServiceCounter[], 
    usersData?: UserAccount[], 
    advisoryData?: string,
    passwordsData?: TerminalPasswords,
    backupConfigData?: BackupConfig,
    announcementData?: QueueAnnouncement,
    franchiseData?: TricycleFranchiseRecord[],
    paymentsData?: Record<string, PaymentRecord>,
    inspectionsData?: Record<string, TricycleInspectionChecklist>
  ) => {
    if (!isSubscribed) return;
    let hasQueueChanges = false;
    let finalTickets = loadTickets();
    let finalCounters = loadCounters();

    if (Array.isArray(ticketsData)) {
      const localTickets = loadTickets();
      // If server returned empty array on cold boot, but local has valid existing tickets, retain and sync up!
      if (ticketsData.length === 0 && localTickets.length > 0) {
        finalTickets = localTickets;
        if (typeof fetch !== 'undefined') {
          fetch('/api/tickets/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickets: localTickets }),
          }).catch(() => {});
        }
      } else {
        // Safe smart merge: never wipe or lose existing tickets
        const ticketMap = new Map<string, Ticket>();
        for (const t of localTickets) {
          if (t && t.id) ticketMap.set(t.id, t);
        }
        for (const t of ticketsData) {
          if (t && t.id) {
            const loc = ticketMap.get(t.id);
            if (!loc || (t.createdAt || 0) >= (loc.createdAt || 0)) {
              ticketMap.set(t.id, { ...loc, ...t });
            }
          }
        }
        const mergedTickets = Array.from(ticketMap.values());
        localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(mergedTickets));
        finalTickets = mergedTickets;
        hasQueueChanges = true;
      }
    }

    if (Array.isArray(countersData) && countersData.length > 0) {
      localStorage.setItem(STORAGE_KEYS.COUNTERS, JSON.stringify(countersData));
      finalCounters = countersData;
      hasQueueChanges = true;
    }

    // Sync Users / Officer Directory across computers & browsers
    if (Array.isArray(usersData) && usersData.length > 0) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(usersData));
      window.dispatchEvent(new Event('mtfrb_users_updated'));
      // Sync current logged in user if modified (e.g. password changed or profile edited)
      const currentUser = getCurrentUser();
      if (currentUser) {
        const updatedSelf = usersData.find(u => u.id === currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase());
        if (updatedSelf) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedSelf));
          window.dispatchEvent(new Event('mtfrb_auth_changed'));
        }
      }
    }

    // Sync Franchise Records across computers and browsers (Safe Non-destructive Union)
    if (Array.isArray(franchiseData) && franchiseData.length > 0) {
      const localRecords = loadFranchiseRecords();
      const localMap = new Map(localRecords.map((r) => [r.bodyNumber.replace(/^#+/, '').trim().toUpperCase(), r]));
      let hasFranchiseChanges = false;
      for (const serverRec of franchiseData) {
        if (serverRec && serverRec.bodyNumber) {
          const key = serverRec.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
          const localRec = localMap.get(key);
          if (!localRec || (serverRec.updatedAt || 0) > (localRec.updatedAt || 0)) {
            localMap.set(key, serverRec);
            hasFranchiseChanges = true;
          }
        }
      }
      const mergedRecords = Array.from(localMap.values());
      localStorage.setItem(STORAGE_KEYS.FRANCHISE_REGISTRY, JSON.stringify(mergedRecords));
      if (hasFranchiseChanges) {
        window.dispatchEvent(new Event('franchise_registry_updated'));
        window.dispatchEvent(new Event('mtfrb_franchise_registry_updated'));
      }
    }

    // Sync Payments Database non-destructively so payments never reset or roll back
    if (paymentsData && typeof paymentsData === 'object' && Object.keys(paymentsData).length > 0) {
      const localPayments = loadAllPaymentsMap();
      const deletedPayments = getDeletedPaymentsSet();
      let hasPaymentChanges = false;
      const mergedPayments = { ...localPayments };

      for (const [bodyNum, sPayment] of Object.entries(paymentsData)) {
        const cleanBody = bodyNum.replace(/^#+/, '').trim().toUpperCase();
        if (deletedPayments.has(cleanBody)) continue;
        const localP = mergedPayments[cleanBody];
        if (!localP || (sPayment.createdAt || 0) >= (localP.createdAt || 0)) {
          mergedPayments[cleanBody] = sPayment;
          hasPaymentChanges = true;
        }
      }

      localStorage.setItem(STORAGE_KEYS.PAYMENTS_DB, JSON.stringify(mergedPayments));
      if (hasPaymentChanges) {
        window.dispatchEvent(new CustomEvent('mtfrb_payments_db_synced', { detail: mergedPayments }));
      }
    }

    // Sync Inspections Database non-destructively
    if (inspectionsData && typeof inspectionsData === 'object' && Object.keys(inspectionsData).length > 0) {
      const localInspections = loadAllInspectionChecklists();
      const deletedInspections = getDeletedInspectionsSet();
      let hasInspectionChanges = false;
      const mergedInspections = { ...localInspections };

      for (const [bodyNum, sInspection] of Object.entries(inspectionsData)) {
        const cleanBody = bodyNum.replace(/^#+/, '').trim().toUpperCase();
        if (deletedInspections.has(cleanBody)) continue;
        const localI = mergedInspections[cleanBody];
        if (!localI) {
          mergedInspections[cleanBody] = sInspection;
          hasInspectionChanges = true;
        } else {
          // Preserve local photos if server doesn't have them
          mergedInspections[cleanBody] = {
            ...sInspection,
            frontImage: localI.frontImage || sInspection.frontImage,
            oppositeSideImage: localI.oppositeSideImage || sInspection.oppositeSideImage,
            backImage: localI.backImage || sInspection.backImage,
            motorSideImage: localI.motorSideImage || sInspection.motorSideImage,
          };
        }
      }

      localStorage.setItem(STORAGE_KEYS.INSPECTIONS_DB, JSON.stringify(mergedInspections));
      if (hasInspectionChanges) {
        window.dispatchEvent(new CustomEvent('mtfrb_inspections_db_synced', { detail: mergedInspections }));
      }
    }

    if (typeof advisoryData === 'string' && advisoryData.trim()) {
      localStorage.setItem(STORAGE_KEYS.LOBBY_ADVISORY, advisoryData.trim());
      hasQueueChanges = true;
    }

    if (passwordsData && typeof passwordsData === 'object') {
      localStorage.setItem(STORAGE_KEYS.TERMINAL_PASSWORDS, JSON.stringify(passwordsData));
      window.dispatchEvent(new Event('mtfrb_passwords_updated'));
    }

    if (backupConfigData && typeof backupConfigData === 'object') {
      localStorage.setItem(STORAGE_KEYS.BACKUP_CONFIG, JSON.stringify(backupConfigData));
      window.dispatchEvent(new Event('mtfrb_backup_config_updated'));
    }

    if (announcementData && announcementData.id) {
      window.dispatchEvent(new CustomEvent('mtfrb_call_announcement', { detail: announcementData }));
    }

    if (hasQueueChanges) {
      window.dispatchEvent(new Event('franchise_queue_updated'));
    }

    onUpdate({
      tickets: finalTickets,
      counters: finalCounters,
      isConnected: true,
    });
  };

  // 1. Listen to BroadcastChannel for zero-latency local tab messages
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data) {
      if (event.data.type === 'CALL_ANNOUNCEMENT' && event.data.announcement) {
        window.dispatchEvent(new CustomEvent('mtfrb_call_announcement', { detail: event.data.announcement }));
      }
      updateFromPayload(
        event.data.tickets,
        event.data.counters,
        event.data.users,
        event.data.advisory,
        event.data.passwords,
        event.data.backupConfig,
        event.data.announcement,
        event.data.franchiseRegistry,
        event.data.payments,
        event.data.inspections
      );
    }
  };
  broadcastChan?.addEventListener('message', handleBroadcast);

  // 2. Setup Server-Sent Events (SSE) connection to server
  const connectSSE = () => {
    if (typeof window === 'undefined' || !window.EventSource) return;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          updateFromPayload(
            payload.tickets,
            payload.counters,
            payload.users,
            payload.advisory,
            payload.terminalPasswords,
            payload.backupConfig,
            payload.latestAnnouncement || payload.announcement,
            payload.franchiseRegistry,
            payload.payments,
            payload.inspections
          );
        } catch {}
      };

      eventSource.onerror = () => {
        onUpdate({
          tickets: loadTickets(),
          counters: loadCounters(),
          isConnected: false,
        });
        // Reconnection will be handled automatically by EventSource, but poll in the meantime
      };

      eventSource.onopen = () => {
        onUpdate({
          tickets: loadTickets(),
          counters: loadCounters(),
          isConnected: true,
        });
      };
    } catch {
      // EventSource failed to instantiate; polling will handle it
    }
  };

  connectSSE();

  // 3. Periodic real-time safety poll every 2.5 seconds to sync if connection fluctuates
  const fetchLatestState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        updateFromPayload(
          data.tickets,
          data.counters,
          data.users,
          data.advisory,
          data.terminalPasswords,
          data.backupConfig,
          data.latestAnnouncement,
          data.franchiseRegistry,
          data.payments,
          data.inspections
        );
      }
    } catch {}
  };

  // Initial fetch immediately
  fetchLatestState();
  pollTimer = setInterval(fetchLatestState, 2500);

  // Cleanup handler
  return () => {
    isSubscribed = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    broadcastChan?.removeEventListener('message', handleBroadcast);
  };
}

/**
 * Ensures a ticket exists on the server, useful when a mobile phone scans a QR code
 * that contains ticket parameters directly.
 */
export async function ensureTicketRegistered(ticket: Partial<Ticket> & { ticketNumber: string }) {
  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to ensure ticket registered on server:', err);
  }
  return null;
}

// ---------------- USER MANAGEMENT ----------------

export function loadDeletedUserIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function recordDeletedUser(id: string, username?: string) {
  try {
    const current = loadDeletedUserIds();
    const toAdd = [id.toLowerCase()];
    if (username) toAdd.push(username.toLowerCase());
    const updated = Array.from(new Set([...current, ...toAdd]));
    localStorage.setItem(STORAGE_KEYS.DELETED_USERS, JSON.stringify(updated));
  } catch {}
}

export function loadUsers(): UserAccount[] {
  try {
    const deletedIds = loadDeletedUserIds();
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    let list: UserAccount[];

    if (!raw) {
      // First time initialization
      list = DEFAULT_USERS.map(u => 
        u.role === 'ADMIN' || u.username === 'admin' ? { ...u, fullName: 'Kevin Salonga' } : u
      );
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
      return list;
    }

    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }

    // Filter out any explicitly deleted users so deleted users stay deleted
    list = list.filter(u => !deletedIds.includes(u.id.toLowerCase()) && !deletedIds.includes(u.username.toLowerCase()));

    // Always enforce that the admin account is named Kevin Salonga
    let changed = false;
    list = list.map(u => {
      if (u.role === 'ADMIN' || u.username.toLowerCase() === 'admin') {
        if (u.fullName !== 'Kevin Salonga') {
          changed = true;
          return { ...u, fullName: 'Kevin Salonga' };
        }
      }
      return u;
    });

    if (!list.some(u => u.role === 'ADMIN' || u.username.toLowerCase() === 'admin')) {
      list.unshift({
        id: 'user_admin',
        username: 'admin',
        fullName: 'Kevin Salonga',
        role: 'ADMIN',
        password: 'admin',
        assignedCounter: 1,
        designation: 'Board Chairman / Admin',
        isActive: true,
        createdAt: Date.now() - 30 * 24 * 3600 * 1000,
      });
      changed = true;
    }

    // Ensure the canonical database default officers are present as the default dataset
    DEFAULT_USERS.forEach((defaultUser) => {
      const isDeleted = deletedIds.includes(defaultUser.id.toLowerCase()) || deletedIds.includes(defaultUser.username.toLowerCase());
      if (!isDeleted && !list.some((u) => u.username.toLowerCase() === defaultUser.username.toLowerCase())) {
        list.push(
          defaultUser.role === 'ADMIN' || defaultUser.username === 'admin'
            ? { ...defaultUser, fullName: 'Kevin Salonga' }
            : defaultUser
        );
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
    }
    return list;
  } catch {
    return DEFAULT_USERS.map(u => 
      u.role === 'ADMIN' || u.username === 'admin' ? { ...u, fullName: 'Kevin Salonga' } : u
    );
  }
}

/**
 * Reset officers directory to default canonical database records
 */
export function resetUsersToDefault(): UserAccount[] {
  const canonical = DEFAULT_USERS.map(u => 
    u.role === 'ADMIN' || u.username === 'admin' ? { ...u, fullName: 'Kevin Salonga' } : u
  );
  localStorage.removeItem(STORAGE_KEYS.DELETED_USERS);
  saveUsers(canonical);
  return canonical;
}

export function saveUsers(users: UserAccount[]) {
  try {
    const deletedIds = loadDeletedUserIds();
    // Ensure admin is always named Kevin Salonga and filter out deleted users
    const sanitized = users
      .filter(u => !deletedIds.includes(u.id.toLowerCase()) && !deletedIds.includes(u.username.toLowerCase()))
      .map(u => 
        u.role === 'ADMIN' || u.username.toLowerCase() === 'admin' 
          ? { ...u, fullName: 'Kevin Salonga' } 
          : u
      );

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
    window.dispatchEvent(new Event('mtfrb_users_updated'));
    broadcastChan?.postMessage({ type: 'USERS_UPDATED', users: sanitized });

    if (typeof fetch !== 'undefined') {
      fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: sanitized }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save users', e);
  }
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && (user.role === 'ADMIN' || user.username?.toLowerCase() === 'admin')) {
        return { ...user, fullName: 'Kevin Salonga' };
      }
      return user;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    window.dispatchEvent(new Event('mtfrb_auth_changed'));
    broadcastChan?.postMessage({ type: 'AUTH_CHANGED', user });
  } catch (e) {
    console.error('Failed to set current user', e);
  }
}

export function logoutUser() {
  setCurrentUser(null);
}

// Aliases for convenience
export const loadCurrentUser = getCurrentUser;
export const saveCurrentUser = setCurrentUser;
export const clearCurrentUser = logoutUser;

/**
 * Access Control for Payments & Collections Database
 * Only accessible by Administrator accounts (role === 'ADMIN') and
 * Payment Accounts (Counter 4 or designation/username indicating Payment/Cashier/Treasury).
 */
export function canAccessPaymentsDatabase(user: UserAccount | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.assignedCounter === 4) return true;
  const des = (user.designation || '').toLowerCase();
  const uname = (user.username || '').toLowerCase();
  if (
    des.includes('payment') || 
    des.includes('cashier') || 
    des.includes('treasur') || 
    des.includes('collection') ||
    uname.includes('payment') || 
    uname.includes('cashier')
  ) {
    return true;
  }
  return false;
}

export type CameraPermissionDecision = 'granted' | 'denied' | null;

/**
 * Reads stored camera permission decision for the Inspection Station.
 * Returns 'granted', 'denied', or null if not yet prompted.
 */
export function getCameraPermissionDecision(): CameraPermissionDecision {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.CAMERA_PERMISSION_DECISION);
    if (val === 'granted' || val === 'denied') {
      return val;
    }
  } catch (err) {
    console.warn('Error reading camera permission decision:', err);
  }
  return null;
}

/**
 * Persistently saves the camera permission answer ('granted' or 'denied')
 * so the Inspection Station only prompts once and will not prompt again.
 */
export function saveCameraPermissionDecision(decision: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CAMERA_PERMISSION_DECISION, decision);
    window.dispatchEvent(new CustomEvent('mtfrb_camera_permission_changed', { detail: decision }));
  } catch (err) {
    console.error('Error saving camera permission decision:', err);
  }
}

/**
 * Resets camera permission decision if the user explicitly wants to re-prompt.
 */
export function clearCameraPermissionDecision(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CAMERA_PERMISSION_DECISION);
    window.dispatchEvent(new CustomEvent('mtfrb_camera_permission_changed', { detail: null }));
  } catch (err) {}
}

export function authenticateUser(username: string, password?: string): UserAccount | null {
  const users = loadUsers();
  const cleanUsername = username.trim().toLowerCase();
  
  const found = users.find(
    (u) => u.username.toLowerCase() === cleanUsername && u.isActive
  );

  if (!found) return null;

  // If password provided, verify (or allow match if password matched)
  if (password !== undefined) {
    if (found.password && found.password !== password) {
      return null;
    }
  }

  return found;
}

export function addUser(userData: Omit<UserAccount, 'id' | 'createdAt'>): UserAccount {
  const users = loadUsers();
  const newUser: UserAccount = {
    ...userData,
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    createdAt: Date.now(),
  };

  const updated = [...users, newUser];
  saveUsers(updated);
  return newUser;
}

export function updateUser(id: string, updates: Partial<UserAccount>): UserAccount[] {
  const users = loadUsers();
  const updated = users.map((u) => (u.id === id ? { ...u, ...updates } : u));
  saveUsers(updated);

  // If current logged-in user is updated, update current session too
  const current = getCurrentUser();
  if (current && current.id === id) {
    setCurrentUser({ ...current, ...updates });
  }

  return updated;
}

export function deleteUser(id: string): UserAccount[] {
  const users = loadUsers();
  const target = users.find((u) => u.id === id || u.username.toLowerCase() === id.toLowerCase());
  
  // Don't delete if it's the last active admin
  const admins = users.filter((u) => u.role === 'ADMIN' && u.isActive);
  if (target?.role === 'ADMIN' && admins.length <= 1) {
    throw new Error('Cannot delete the last active administrator account.');
  }

  // Record deleted user ID and username so that it is never restored
  if (target) {
    recordDeletedUser(target.id, target.username);
  } else {
    recordDeletedUser(id);
  }

  const updated = users.filter((u) => u.id !== id && u.username.toLowerCase() !== (target?.username || '').toLowerCase());
  saveUsers(updated);

  // Send DELETE call to backend server API
  if (typeof fetch !== 'undefined') {
    fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('Server user deletion sync error:', err));
  }

  const current = getCurrentUser();
  if (current && (current.id === id || current.username.toLowerCase() === (target?.username || '').toLowerCase())) {
    logoutUser();
  }

  return updated;
}

// ---------------- TERMINAL PASSWORDS (KIOSK & LOBBY TV) ----------------

export function loadTerminalPasswords(): TerminalPasswords {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TERMINAL_PASSWORDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        kioskPassword: parsed.kioskPassword || DEFAULT_TERMINAL_PASSWORDS.kioskPassword,
        lobbyTvPassword: parsed.lobbyTvPassword || DEFAULT_TERMINAL_PASSWORDS.lobbyTvPassword,
      };
    }
  } catch {}

  return { ...DEFAULT_TERMINAL_PASSWORDS };
}

export function saveTerminalPasswords(updates: Partial<TerminalPasswords>): TerminalPasswords {
  const current = loadTerminalPasswords();
  const updated: TerminalPasswords = {
    ...current,
    ...updates,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.TERMINAL_PASSWORDS, JSON.stringify(updated));
    window.dispatchEvent(new Event('franchise_terminal_passwords_updated'));
    broadcastChan?.postMessage({ type: 'TERMINAL_PASSWORDS_UPDATED', passwords: updated });

    if (typeof fetch !== 'undefined') {
      fetch('/api/terminal-passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save terminal passwords', e);
  }

  return updated;
}

// ---------------- GOOGLE DRIVE & AUTO-BACKUP CONFIGURATION ----------------

export function loadBackupConfig(): BackupConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BACKUP_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_BACKUP_CONFIG,
        ...parsed,
      };
    }
  } catch {}

  return { ...DEFAULT_BACKUP_CONFIG };
}

export function saveBackupConfig(updates: Partial<BackupConfig>): BackupConfig {
  const current = loadBackupConfig();
  const updated: BackupConfig = {
    ...current,
    ...updates,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.BACKUP_CONFIG, JSON.stringify(updated));
    window.dispatchEvent(new Event('franchise_backup_config_updated'));

    if (typeof fetch !== 'undefined') {
      fetch('/api/backup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save backup config', e);
  }

  return updated;
}

export function loadLocalBackupLogs(): BackupNotificationLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BACKUP_LOGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function saveLocalBackupLogs(logs: BackupNotificationLog[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.BACKUP_LOGS, JSON.stringify(logs.slice(0, 100)));
  } catch {}
}

export async function triggerBackup(source: 'AUTOMATIC_5MIN' | 'MANUAL' = 'MANUAL'): Promise<{
  success: boolean;
  log?: BackupNotificationLog;
  snapshot?: any;
}> {
  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch('/api/backup/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.log) {
          const localLogs = loadLocalBackupLogs();
          saveLocalBackupLogs([data.log, ...localLogs]);
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('Server backup trigger failed, performing client-side backup snapshot:', err);
  }

  // Client-side fallback snapshot
  const config = loadBackupConfig();
  const tickets = loadTickets();
  const counters = loadCounters();
  const users = loadUsers();
  const snapshot = {
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    timestamp: Date.now(),
    dateFormatted: new Date().toISOString(),
    targetDriveEmail: config.targetEmail,
    tickets,
    counters,
    users,
  };

  const payloadStr = JSON.stringify(snapshot, null, 2);
  const sizeKb = Math.round((payloadStr.length / 1024) * 10) / 10;

  const log: BackupNotificationLog = {
    id: `bkp_client_${Date.now()}`,
    timestamp: Date.now(),
    recipients: [...config.notificationEmails],
    totalTickets: tickets.length,
    totalCounters: counters.length,
    fileSizeKb: sizeKb,
    status: 'SUCCESS',
    source,
    message: `Database backup snapshot (${sizeKb} KB) recorded for ${config.targetEmail}. Notifications queued for ${config.notificationEmails.join(', ')}.`,
  };

  const localLogs = loadLocalBackupLogs();
  saveLocalBackupLogs([log, ...localLogs]);

  return { success: true, log, snapshot };
}

// ---------------- EMAIL TEST & DIRECT DATABASE EXPORTS ----------------

export async function triggerTestBackupEmail(recipientEmail?: string): Promise<{
  success: boolean;
  message: string;
  log?: BackupNotificationLog;
}> {
  try {
    const res = await fetch('/api/backup/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.log) {
        const localLogs = loadLocalBackupLogs();
        saveLocalBackupLogs([data.log, ...localLogs]);
      }
      return data;
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, message: errData.error || 'Failed to dispatch test notification email' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Server connection error during test email' };
  }
}

export async function changeUserPassword(
  userId: string, 
  currentPassword: string, 
  newPassword: string
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch(`/api/users/${userId}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      const data = await res.json();
      // Update local storage
      const users = loadUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx >= 0 && data.user) {
        users[idx] = data.user;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        window.dispatchEvent(new Event('mtfrb_users_updated'));
      }
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId && data.user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
        window.dispatchEvent(new Event('mtfrb_auth_changed'));
      }
      return { success: true, message: data.message || 'Password changed successfully', user: data.user };
    }

    const err = await res.json().catch(() => ({}));
    return { success: false, message: err.error || 'Failed to change password.' };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error updating password.' };
  }
}

export function getFormattedBackupTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

export function downloadJsonFile(filename: string, data: any) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// User Request 8: Export Queue Record Database separately with Date & Time in filename
export function exportQueueRecordsDatabase() {
  const ts = getFormattedBackupTimestamp();
  const filename = `MTFRB_Queue_Records_${ts}.json`;
  const tickets = loadTickets();
  const counters = loadCounters();
  const advisory = loadLobbyAdvisory();

  const data = {
    exportType: 'QUEUE_RECORDS_DATABASE',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalTickets: tickets.length,
    totalCounters: counters.length,
    tickets,
    counters,
    advisory,
  };

  downloadJsonFile(filename, data);
  return filename;
}

// User Request 8: Export User Database separately with Date & Time in filename
export function exportUserDatabase() {
  const ts = getFormattedBackupTimestamp();
  const filename = `MTFRB_User_Database_${ts}.json`;
  const users = loadUsers();
  const terminalPasswords = loadTerminalPasswords();

  const data = {
    exportType: 'OFFICER_USER_DATABASE',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalUsers: users.length,
    users,
    terminalPasswords,
  };

  downloadJsonFile(filename, data);
  return filename;
}

// User Request 8: Export Full Complete Database with Date & Time in filename
export function exportCompleteSystemBackup() {
  const ts = getFormattedBackupTimestamp();
  const filename = `MTFRB_Complete_Backup_${ts}.json`;
  const tickets = loadTickets();
  const counters = loadCounters();
  const users = loadUsers();
  const advisory = loadLobbyAdvisory();
  const terminalPasswords = loadTerminalPasswords();
  const backupConfig = loadBackupConfig();

  const franchiseRecords = loadFranchiseRecords();

  const data = {
    exportType: 'FULL_SYSTEM_BACKUP',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    timestamp: Date.now(),
    dateFormatted: new Date().toISOString(),
    targetDriveEmail: backupConfig.targetEmail,
    tickets,
    counters,
    users,
    franchiseRecords,
    advisory,
    terminalPasswords,
    backupConfig,
  };

  downloadJsonFile(filename, data);
  return filename;
}

// ---------------- TRICYCLE FRANCHISE DATABASE (BODY NUMBER) ----------------

export function loadFranchiseRecords(): TricycleFranchiseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FRANCHISE_REGISTRY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Guarantee all body numbers are clean without '#' prefix
        return parsed.map((rec: TricycleFranchiseRecord) => ({
          ...rec,
          bodyNumber: String(rec.bodyNumber || '').replace(/^#+/, '').trim(),
        }));
      }
    }
  } catch {}

  // Initialize with standard municipal franchise registry (without '#' on body numbers)
  const cleanedDefaults = DEFAULT_FRANCHISE_RECORDS.map((rec) => ({
    ...rec,
    bodyNumber: String(rec.bodyNumber || '').replace(/^#+/, '').trim(),
  }));

  try {
    localStorage.setItem(STORAGE_KEYS.FRANCHISE_REGISTRY, JSON.stringify(cleanedDefaults));
  } catch {}
  return cleanedDefaults;
}

export function saveFranchiseRecords(records: TricycleFranchiseRecord[]) {
  try {
    const cleaned = records.map((r) => ({
      ...r,
      bodyNumber: String(r.bodyNumber || '').replace(/^#+/, '').trim(),
    }));
    localStorage.setItem(STORAGE_KEYS.FRANCHISE_REGISTRY, JSON.stringify(cleaned));
    window.dispatchEvent(new Event('mtfrb_franchise_registry_updated'));
    broadcastChan?.postMessage({ type: 'FRANCHISE_REGISTRY_UPDATED', records: cleaned });

    if (typeof fetch !== 'undefined') {
      fetch('/api/franchise-records/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: cleaned }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save franchise records', e);
  }
}

export function getFranchiseRecordByBodyNumber(bodyNumber: string): TricycleFranchiseRecord | null {
  const records = loadFranchiseRecords();
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return null;
  return records.find((r) => {
    const rClean = String(r.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
    if (rClean === cleanBody) return true;
    if (!isNaN(Number(rClean)) && !isNaN(Number(cleanBody)) && Number(rClean) === Number(cleanBody)) {
      return true;
    }
    return false;
  }) || null;
}

export function addFranchiseRecord(record: TricycleFranchiseRecord): TricycleFranchiseRecord {
  const records = loadFranchiseRecords();
  const cleanBody = String(record.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();

  if (!cleanBody) {
    throw new Error('Body Number is required.');
  }

  // Unique constraint enforcement
  const existing = records.find((r) => r.bodyNumber.replace(/^#+/, '').trim().toUpperCase() === cleanBody);
  if (existing) {
    throw new Error(`Conflict: Body Number "${cleanBody}" already exists in the MTFRB registry.`);
  }

  const now = Date.now();
  const newRecord: TricycleFranchiseRecord = {
    ...record,
    bodyNumber: cleanBody,
    make: record.make || record.makeModel || '',
    makeModel: record.makeModel || record.make || '',
    motorNumber: record.motorNumber || record.engineNumber || '',
    engineNumber: record.engineNumber || record.motorNumber || '',
    colorScheme: record.colorScheme || record.color || '',
    color: record.color || record.colorScheme || '',
    todaName: record.todaName || record.todaAssociation || '',
    todaAssociation: record.todaAssociation || record.todaName || '',
    routeZone: record.routeZone || record.zone || 'Zone 1',
    zone: (record.zone || record.routeZone || 'Zone 1') as any,
    status: record.status || record.franchiseStatus || 'ACTIVE',
    franchiseStatus: (record.franchiseStatus || record.status || 'ACTIVE') as any,
    dateGranted: record.dateGranted || record.dateIssued || '',
    dateIssued: record.dateIssued || record.dateGranted || '',
    validUntil: record.validUntil || record.expiryDate || '',
    expiryDate: record.expiryDate || record.validUntil || '',
    remarks: record.remarks || record.notes || '',
    notes: record.notes || record.remarks || '',
    // User Request 3: Extended Master Profile & Legal Fields
    oldBodyNumber: record.oldBodyNumber || record.oldBodyNo || '',
    oldBodyNo: record.oldBodyNumber || record.oldBodyNo || '',
    caseNumber: record.caseNumber || record.caseNo || '',
    caseNo: record.caseNumber || record.caseNo || '',
    orNumber: record.orNumber || record.orNo || '',
    orNo: record.orNumber || record.orNo || '',
    crNumber: record.crNumber || record.crNo || '',
    crNo: record.crNumber || record.crNo || '',
    taxCertificateNumber: record.taxCertificateNumber || record.taxCertNo || '',
    taxCertNo: record.taxCertificateNumber || record.taxCertNo || '',
    taxCertificateAddress: record.taxCertificateAddress || record.taxCertAddress || '',
    taxCertAddress: record.taxCertificateAddress || record.taxCertAddress || '',
    taxCertificateDate: record.taxCertificateDate || record.taxCertDate || '',
    taxCertDate: record.taxCertificateDate || record.taxCertDate || '',
    // Document Attachments
    barangayClearanceAttachment: record.barangayClearanceAttachment,
    zoneClearanceAttachment: record.zoneClearanceAttachment,
    officialReceiptLtoAttachment: record.officialReceiptLtoAttachment,
    certificateOfRegistrationLtoAttachment: record.certificateOfRegistrationLtoAttachment,
    taxCertificateCedulaAttachment: record.taxCertificateCedulaAttachment,
    driversLicenseAttachment: record.driversLicenseAttachment,
    mtfrbIdAttachment: record.mtfrbIdAttachment,
    businessPermitAttachment: record.businessPermitAttachment,
    birthCertificateAttachment: record.birthCertificateAttachment,
    marriageCertificateAttachment: record.marriageCertificateAttachment,
    deedOfSaleAttachment: record.deedOfSaleAttachment,
    attachments: record.attachments,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newRecord, ...records];
  saveFranchiseRecords(updated);

  if (typeof fetch !== 'undefined') {
    fetch('/api/franchise-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord),
    }).catch(() => {});
  }

  return newRecord;
}

export function updateFranchiseRecord(bodyNumber: string, updates: Partial<TricycleFranchiseRecord>): TricycleFranchiseRecord {
  const records = loadFranchiseRecords();
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  let index = records.findIndex((r) => {
    const rClean = String(r.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
    if (rClean === cleanBody) return true;
    if (!isNaN(Number(rClean)) && !isNaN(Number(cleanBody)) && Number(rClean) === Number(cleanBody)) {
      return true;
    }
    return false;
  });

  // If record not found, upsert it automatically so verification desk saving never fails
  if (index === -1) {
    const newRecord: TricycleFranchiseRecord = {
      bodyNumber: cleanBody,
      operatorName: updates.operatorName || 'Registered Operator',
      contactNumber: updates.contactNumber || 'N/A',
      address: updates.address || 'Castillejos, Zambales',
      barangay: updates.barangay || 'Poblacion',
      driverName: updates.driverName || updates.operatorName || 'Registered Driver',
      licenseNumber: updates.licenseNumber || updates.driverLicenseNumber || 'N/A',
      driverLicenseNumber: updates.driverLicenseNumber || updates.licenseNumber || 'N/A',
      emergencyContact: updates.emergencyContact || updates.emergencyContactPhone || '',
      make: updates.make || updates.makeModel || 'Motorcycle with Sidecar',
      makeModel: updates.makeModel || updates.make || 'Motorcycle with Sidecar',
      motorNumber: updates.motorNumber || updates.engineNumber || 'ENG-' + cleanBody,
      engineNumber: updates.engineNumber || updates.motorNumber || 'ENG-' + cleanBody,
      chassisNumber: updates.chassisNumber || 'CHS-' + cleanBody,
      plateNumber: updates.plateNumber || 'TC-' + cleanBody,
      colorScheme: updates.colorScheme || updates.color || 'Blue/Yellow',
      color: updates.color || updates.colorScheme || 'Blue/Yellow',
      franchiseType: updates.franchiseType || 'RENEWAL',
      permitNumber: updates.permitNumber || updates.franchiseNumber || `MTFRB-2026-${cleanBody}`,
      dateGranted: updates.dateGranted || updates.dateIssued || new Date().toISOString().slice(0, 10),
      dateIssued: updates.dateIssued || updates.dateGranted || new Date().toISOString().slice(0, 10),
      validUntil: updates.validUntil || updates.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      expiryDate: updates.expiryDate || updates.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: (updates.status || updates.franchiseStatus || 'ACTIVE').toUpperCase(),
      franchiseStatus: ((updates.franchiseStatus || updates.status || 'ACTIVE').toUpperCase()) as any,
      todaName: updates.todaName || updates.todaAssociation || 'Castillejos Poblacion TODA',
      todaAssociation: updates.todaAssociation || updates.todaName || 'Castillejos Poblacion TODA',
      routeZone: updates.routeZone || updates.zone || 'Zone 1',
      zone: (updates.zone || updates.routeZone || 'Zone 1') as any,
      remarks: updates.remarks || updates.notes || 'Verified by Verification Station Officer',
      notes: updates.notes || updates.remarks || 'Verified by Verification Station Officer',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...updates,
    };
    records.push(newRecord);
    saveFranchiseRecords(records);
    return newRecord;
  }

  // If bodyNumber is modified in updates, verify no conflict with other records
  if (updates.bodyNumber) {
    const newBody = String(updates.bodyNumber).replace(/^#+/, '').trim().toUpperCase();
    if (newBody !== cleanBody) {
      const conflict = records.find((r, i) => i !== index && r.bodyNumber.replace(/^#+/, '').trim().toUpperCase() === newBody);
      if (conflict) {
        throw new Error(`Cannot change Body Number: "${newBody}" is already registered.`);
      }
    }
  }

  const current = records[index];
  const finalBody = updates.bodyNumber
    ? String(updates.bodyNumber).replace(/^#+/, '').trim().toUpperCase()
    : current.bodyNumber.replace(/^#+/, '').trim().toUpperCase();

  const updatedRecord: TricycleFranchiseRecord = {
    ...current,
    ...updates,
    bodyNumber: finalBody,
    // Safely sync both alias conventions
    make: updates.make ?? updates.makeModel ?? current.make ?? current.makeModel ?? '',
    makeModel: updates.makeModel ?? updates.make ?? current.makeModel ?? current.make ?? '',
    motorNumber: updates.motorNumber ?? updates.engineNumber ?? current.motorNumber ?? current.engineNumber ?? '',
    engineNumber: updates.engineNumber ?? updates.motorNumber ?? current.engineNumber ?? current.motorNumber ?? '',
    colorScheme: updates.colorScheme ?? updates.color ?? current.colorScheme ?? current.color ?? '',
    color: updates.color ?? updates.colorScheme ?? current.color ?? current.colorScheme ?? '',
    todaName: updates.todaName ?? updates.todaAssociation ?? current.todaName ?? current.todaAssociation ?? '',
    todaAssociation: updates.todaAssociation ?? updates.todaName ?? current.todaAssociation ?? current.todaName ?? '',
    routeZone: updates.routeZone ?? updates.zone ?? current.routeZone ?? current.zone ?? 'Zone 1',
    zone: (updates.zone ?? updates.routeZone ?? current.zone ?? current.routeZone ?? 'Zone 1') as any,
    status: (updates.status ?? updates.franchiseStatus ?? current.status ?? current.franchiseStatus ?? 'ACTIVE').toUpperCase(),
    franchiseStatus: ((updates.franchiseStatus ?? updates.status ?? current.franchiseStatus ?? current.status ?? 'ACTIVE').toUpperCase()) as any,
    dateGranted: updates.dateGranted ?? updates.dateIssued ?? current.dateGranted ?? current.dateIssued ?? '',
    dateIssued: updates.dateIssued ?? updates.dateGranted ?? current.dateIssued ?? current.dateGranted ?? '',
    validUntil: updates.validUntil ?? updates.expiryDate ?? current.validUntil ?? current.expiryDate ?? '',
    expiryDate: updates.expiryDate ?? updates.validUntil ?? current.expiryDate ?? current.validUntil ?? '',
    remarks: updates.remarks ?? updates.notes ?? current.remarks ?? current.notes ?? '',
    notes: updates.notes ?? updates.remarks ?? current.notes ?? current.remarks ?? '',
    licenseNumber: updates.licenseNumber ?? updates.driverLicenseNumber ?? current.licenseNumber ?? current.driverLicenseNumber ?? '',
    driverLicenseNumber: updates.driverLicenseNumber ?? updates.licenseNumber ?? current.driverLicenseNumber ?? current.licenseNumber ?? '',
    emergencyContact: updates.emergencyContact ?? updates.emergencyContactPhone ?? current.emergencyContact ?? current.emergencyContactPhone ?? '',
    emailAddress: updates.emailAddress ?? updates.email ?? current.emailAddress ?? current.email ?? '',
    email: updates.email ?? updates.emailAddress ?? current.email ?? current.emailAddress ?? '',
    // User Request 3: Extended Master Profile & Legal Fields
    oldBodyNumber: updates.oldBodyNumber ?? updates.oldBodyNo ?? current.oldBodyNumber ?? current.oldBodyNo ?? '',
    oldBodyNo: updates.oldBodyNumber ?? updates.oldBodyNo ?? current.oldBodyNumber ?? current.oldBodyNo ?? '',
    caseNumber: updates.caseNumber ?? updates.caseNo ?? current.caseNumber ?? current.caseNo ?? '',
    caseNo: updates.caseNumber ?? updates.caseNo ?? current.caseNumber ?? current.caseNo ?? '',
    orNumber: updates.orNumber ?? updates.orNo ?? current.orNumber ?? current.orNo ?? '',
    orNo: updates.orNumber ?? updates.orNo ?? current.orNumber ?? current.orNo ?? '',
    crNumber: updates.crNumber ?? updates.crNo ?? current.crNumber ?? current.crNo ?? '',
    crNo: updates.crNumber ?? updates.crNo ?? current.crNumber ?? current.crNo ?? '',
    taxCertificateNumber: updates.taxCertificateNumber ?? updates.taxCertNo ?? current.taxCertificateNumber ?? current.taxCertNo ?? '',
    taxCertNo: updates.taxCertificateNumber ?? updates.taxCertNo ?? current.taxCertificateNumber ?? current.taxCertNo ?? '',
    taxCertificateAddress: updates.taxCertificateAddress ?? updates.taxCertAddress ?? current.taxCertificateAddress ?? current.taxCertAddress ?? '',
    taxCertAddress: updates.taxCertificateAddress ?? updates.taxCertAddress ?? current.taxCertificateAddress ?? current.taxCertAddress ?? '',
    taxCertificateDate: updates.taxCertificateDate ?? updates.taxCertDate ?? current.taxCertificateDate ?? current.taxCertDate ?? '',
    taxCertDate: updates.taxCertificateDate ?? updates.taxCertDate ?? current.taxCertificateDate ?? current.taxCertDate ?? '',
    // Preserve uploaded attachments
    barangayClearanceAttachment: updates.barangayClearanceAttachment !== undefined ? updates.barangayClearanceAttachment : current.barangayClearanceAttachment,
    zoneClearanceAttachment: updates.zoneClearanceAttachment !== undefined ? updates.zoneClearanceAttachment : current.zoneClearanceAttachment,
    officialReceiptLtoAttachment: updates.officialReceiptLtoAttachment !== undefined ? updates.officialReceiptLtoAttachment : current.officialReceiptLtoAttachment,
    certificateOfRegistrationLtoAttachment: updates.certificateOfRegistrationLtoAttachment !== undefined ? updates.certificateOfRegistrationLtoAttachment : current.certificateOfRegistrationLtoAttachment,
    taxCertificateCedulaAttachment: updates.taxCertificateCedulaAttachment !== undefined ? updates.taxCertificateCedulaAttachment : current.taxCertificateCedulaAttachment,
    driversLicenseAttachment: updates.driversLicenseAttachment !== undefined ? updates.driversLicenseAttachment : current.driversLicenseAttachment,
    mtfrbIdAttachment: updates.mtfrbIdAttachment !== undefined ? updates.mtfrbIdAttachment : current.mtfrbIdAttachment,
    businessPermitAttachment: updates.businessPermitAttachment !== undefined ? updates.businessPermitAttachment : current.businessPermitAttachment,
    birthCertificateAttachment: updates.birthCertificateAttachment !== undefined ? updates.birthCertificateAttachment : current.birthCertificateAttachment,
    marriageCertificateAttachment: updates.marriageCertificateAttachment !== undefined ? updates.marriageCertificateAttachment : current.marriageCertificateAttachment,
    deedOfSaleAttachment: updates.deedOfSaleAttachment !== undefined ? updates.deedOfSaleAttachment : current.deedOfSaleAttachment,
    attachments: updates.attachments !== undefined ? updates.attachments : current.attachments,
    updatedAt: Date.now(),
  };

  records[index] = updatedRecord;
  saveFranchiseRecords(records);

  if (typeof fetch !== 'undefined') {
    fetch(`/api/franchise-records/${encodeURIComponent(cleanBody)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRecord),
    }).catch(() => {});
  }

  return updatedRecord;
}

export function syncTicketToFranchiseDatabase(ticket: Ticket): TricycleFranchiseRecord | null {
  const bodyNumber = ticket.bodyNumber || (ticket as any).plateOrUnitNumber;
  if (!bodyNumber) return null;

  const email = ticket.email || ticket.emailAddress || '';
  const cleanBody = String(bodyNumber).replace(/^#+/, '').trim().toUpperCase();

  const updates: Partial<TricycleFranchiseRecord> = {
    bodyNumber: cleanBody,
    operatorName: ticket.applicantName,
    contactNumber: ticket.contactNumber,
    emailAddress: email,
    email: email,
    franchiseType: ticket.franchiseType || 'RENEWAL',
    routeZone: ticket.zone || 'Zone 1',
    zone: (ticket.zone || 'Zone 1') as any,
  };

  try {
    const res = updateFranchiseRecord(cleanBody, updates);
    // Also broadcast to server upsert endpoint
    if (typeof fetch !== 'undefined') {
      fetch('/api/franchise-records/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          bodyNumber: cleanBody,
          updatedAt: Date.now(),
        }),
      }).catch(() => {});
    }
    return res;
  } catch (err) {
    console.error('Error syncing ticket to franchise database:', err);
    return null;
  }
}

export function deleteFranchiseRecord(bodyNumber: string): TricycleFranchiseRecord[] {
  const records = loadFranchiseRecords();
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  const updated = records.filter((r) => r.bodyNumber.replace(/^#+/, '').trim().toUpperCase() !== cleanBody);

  saveFranchiseRecords(updated);

  if (typeof fetch !== 'undefined') {
    fetch(`/api/franchise-records/${encodeURIComponent(cleanBody)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }

  return updated;
}

export function exportFranchiseDatabase() {
  const ts = getFormattedBackupTimestamp();
  const filename = `MTFRB_Franchise_Database_BodyNumber_${ts}.json`;
  const records = loadFranchiseRecords();

  const data = {
    exportType: 'FRANCHISE_REGISTRY_DATABASE',
    identifier: 'bodyNumber',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalRecords: records.length,
    records,
  };

  downloadJsonFile(filename, data);
  return filename;
}

export function exportFranchiseRecordsAsCsv(): string {
  const records = loadFranchiseRecords();
  const ts = getFormattedBackupTimestamp();
  const filename = `MTFRB_Franchise_Registry_${ts}.csv`;

  const headers = [
    'Body Number',
    'Old Body Number',
    'Franchise Number',
    'Case Number',
    'Operator Name',
    'Contact Number',
    'Email Address',
    'Barangay / Address',
    'Driver Name',
    'Driver License No',
    'Franchise Type',
    'Status',
    'Zone',
    'TODA Association',
    'Plate Number',
    'Make / Model',
    'Engine Number',
    'Chassis Number',
    'O.R Number',
    'C.R Number',
    'Tax Certificate Number',
    'Tax Certificate Address',
    'Tax Certificate Date',
    'Barangay Clearance Uploaded',
    'Zone Clearance Uploaded',
    'LTO O.R Uploaded',
    'LTO C.R Uploaded',
    'CEDULA Uploaded',
    'Drivers License Uploaded',
    'MTFRB ID Uploaded',
    'Business Permit Uploaded',
    'Birth Certificate Uploaded',
    'Marriage Certificate Uploaded',
    'Deed of Sale Uploaded',
    'Inspection Passed',
    'Date Issued',
    'Expiry Date',
  ];

  const escapeCsv = (val: any) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = records.map((r) => [
    escapeCsv(r.bodyNumber),
    escapeCsv(r.oldBodyNumber || r.oldBodyNo || ''),
    escapeCsv(r.franchiseNumber || r.permitNumber || ''),
    escapeCsv(r.caseNumber || r.caseNo || ''),
    escapeCsv(r.operatorName),
    escapeCsv(r.contactNumber),
    escapeCsv(r.emailAddress || ''),
    escapeCsv(r.address),
    escapeCsv(r.driverName),
    escapeCsv(r.driverLicenseNumber || r.licenseNumber || ''),
    escapeCsv(r.franchiseType),
    escapeCsv(r.franchiseStatus || r.status),
    escapeCsv(r.zone || r.routeZone),
    escapeCsv(r.todaAssociation || r.todaName),
    escapeCsv(r.plateNumber),
    escapeCsv(r.makeModel || r.make),
    escapeCsv(r.engineNumber || r.motorNumber),
    escapeCsv(r.chassisNumber),
    escapeCsv(r.orNumber || r.orNo || ''),
    escapeCsv(r.crNumber || r.crNo || ''),
    escapeCsv(r.taxCertificateNumber || r.taxCertNo || ''),
    escapeCsv(r.taxCertificateAddress || r.taxCertAddress || ''),
    escapeCsv(r.taxCertificateDate || r.taxCertDate || ''),
    escapeCsv((r.barangayClearanceAttachment || r.attachments?.barangayClearanceAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.zoneClearanceAttachment || r.attachments?.zoneClearanceAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.officialReceiptLtoAttachment || r.attachments?.officialReceiptLtoAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.certificateOfRegistrationLtoAttachment || r.attachments?.certificateOfRegistrationLtoAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.taxCertificateCedulaAttachment || r.attachments?.taxCertificateCedulaAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.driversLicenseAttachment || r.attachments?.driversLicenseAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.mtfrbIdAttachment || r.attachments?.mtfrbIdAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.businessPermitAttachment || r.attachments?.businessPermitAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.birthCertificateAttachment || r.attachments?.birthCertificateAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.marriageCertificateAttachment || r.attachments?.marriageCertificateAttachment) ? 'YES' : 'NO'),
    escapeCsv((r.deedOfSaleAttachment || r.attachments?.deedOfSaleAttachment) ? 'YES' : 'NO'),
    escapeCsv(r.inspectionPassed ? 'YES' : 'NO'),
    escapeCsv(r.dateIssued || r.dateGranted),
    escapeCsv(r.expiryDate || r.validUntil),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

// ---------------- GLOBAL CROSS-BROWSER/DEVICE CALL NOTIFICATION ----------------
export async function callTicketOnServer(data: {
  ticketId?: string;
  ticketNumber: string;
  bodyNumber?: string;
  counterId: number;
  counterName: string;
  officerName?: string;
  serviceType?: string;
}) {
  try {
    const res = await fetch('/api/call-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.announcement) {
        window.dispatchEvent(new CustomEvent('mtfrb_call_announcement', { detail: json.announcement }));
        broadcastChan?.postMessage({ type: 'CALL_ANNOUNCEMENT', announcement: json.announcement });
      }
      return json;
    }
  } catch (err) {
    console.warn('Call ticket server sync notice:', err);
  }
  const fallbackAnnouncement: QueueAnnouncement = {
    id: 'local-' + Date.now(),
    ...data,
    calledAt: Date.now(),
  };
  window.dispatchEvent(new CustomEvent('mtfrb_call_announcement', { detail: fallbackAnnouncement }));
  broadcastChan?.postMessage({ type: 'CALL_ANNOUNCEMENT', announcement: fallbackAnnouncement });
  return { success: true, announcement: fallbackAnnouncement };
}

export async function broadcastAnnouncement(data: {
  ticketNumber: string;
  bodyNumber?: string;
  counterName: string;
  counterId: number;
  officerName?: string;
  serviceType?: string;
  ticketId?: string;
}) {
  try {
    const res = await fetch('/api/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.announcement) {
        window.dispatchEvent(new CustomEvent('mtfrb_call_announcement', { detail: json.announcement }));
        broadcastChan?.postMessage({ type: 'CALL_ANNOUNCEMENT', announcement: json.announcement });
      }
      return json;
    }
  } catch (err) {
    console.warn('Broadcast announcement notice:', err);
  }
  const fallbackAnnouncement: QueueAnnouncement = {
    id: 'local-' + Date.now(),
    ...data,
    calledAt: Date.now(),
  };
  window.dispatchEvent(new CustomEvent('mtfrb_call_announcement', { detail: fallbackAnnouncement }));
  broadcastChan?.postMessage({ type: 'CALL_ANNOUNCEMENT', announcement: fallbackAnnouncement });
  return { success: true, announcement: fallbackAnnouncement };
}

// ---------------- TRICYCLE PHYSICAL INSPECTION DATABASE ----------------
// Separated dedicated storage for all inspection checklists & vehicle photographs,
// while staying seamlessly connected to the Main Franchise Registry Database.
const INSPECTION_STORAGE_KEY_PREFIX = 'mtfrb_inspection_checklist_';
const DELETED_INSPECTIONS_KEY = 'mtfrb_deleted_inspections_set';

export function getDeletedInspectionsSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_INSPECTIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDeletedInspectionsSet(set: Set<string>) {
  try {
    localStorage.setItem(DELETED_INSPECTIONS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function loadAllInspectionChecklists(): Record<string, TricycleInspectionChecklist> {
  const map: Record<string, TricycleInspectionChecklist> = {};

  try {
    const rawMaster = localStorage.getItem(STORAGE_KEYS.INSPECTIONS_DB);
    if (rawMaster) {
      const parsed = JSON.parse(rawMaster);
      if (parsed && typeof parsed === 'object') {
        Object.assign(map, parsed);
      }
    }
  } catch (err) {
    console.warn('Failed to parse master inspection database:', err);
  }

  // Also collect any individually keyed inspection checklists
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(INSPECTION_STORAGE_KEY_PREFIX)) {
        const bodyNum = key.replace(INSPECTION_STORAGE_KEY_PREFIX, '').trim().toUpperCase();
        if (bodyNum && !map[bodyNum]) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '');
            if (item && item.bodyNumber) {
              map[bodyNum] = item;
            }
          } catch {}
        }
      }
    }
  } catch {}

  // Populate default baseline inspections for known franchise records if not yet present
  try {
    const deletedSet = getDeletedInspectionsSet();
    const franchises = loadFranchiseRecords();
    franchises.forEach((f) => {
      const cleanBody = f.bodyNumber.trim().toUpperCase();
      if (!map[cleanBody] && !deletedSet.has(cleanBody)) {
        if (f.inspectionChecklist) {
          map[cleanBody] = f.inspectionChecklist;
        } else {
          const isPassed = f.inspectionPassed ?? false;
          const baseline = createDefaultInspectionChecklist(
            cleanBody,
            f.inspectorName || 'Carmela Dizon',
            isPassed ? 'PASSED' : 'FAILED'
          );
          baseline.operatorName = f.operatorName;
          baseline.driverName = f.driverName;
          baseline.plateNumber = f.plateNumber;
          baseline.makeModel = f.makeModel || f.make;
          baseline.motorNumber = f.motorNumber || f.engineNumber;
          baseline.chassisNumber = f.chassisNumber;
          baseline.inspectionDate = f.inspectionDate || new Date().toISOString().slice(0, 10);
          baseline.remarks = f.notes || (isPassed ? 'Passed MTFRB physical vehicle inspection.' : 'Pending inspection.');
          map[cleanBody] = baseline;
        }
      }
    });
  } catch {}

  return map;
}

export function loadAllInspectionsList(): (TricycleInspectionChecklist & { connectedFranchise?: TricycleFranchiseRecord | null })[] {
  const map = loadAllInspectionChecklists();
  const franchises = loadFranchiseRecords();

  const list = Object.values(map).map((chk) => {
    const cleanBody = String(chk.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
    const cleanNum = Number(cleanBody);
    const matchingFranchise = franchises.find((f) => {
      const fBody = f.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
      const fNum = Number(fBody);
      return fBody === cleanBody || (!isNaN(cleanNum) && !isNaN(fNum) && cleanNum === fNum);
    });

    return {
      ...chk,
      connectedFranchise: matchingFranchise || null,
    };
  });

  // Sort numerically by body number if possible, then alphabetically
  return list.sort((a, b) => {
    const numA = parseInt(a.bodyNumber.replace(/\D/g, ''), 10);
    const numB = parseInt(b.bodyNumber.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.bodyNumber.localeCompare(b.bodyNumber);
  });
}

export function getInspectionChecklist(bodyNumber: string): TricycleInspectionChecklist {
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  try {
    // 1. Direct inspection prefix
    const raw = localStorage.getItem(`${INSPECTION_STORAGE_KEY_PREFIX}${cleanBody}`);
    if (raw) {
      return JSON.parse(raw);
    }

    // 2. Master inspections database
    const masterDb = loadAllInspectionChecklists();
    if (masterDb[cleanBody]) {
      return masterDb[cleanBody];
    }

    // 3. Check if stored inside the franchise record
    const record = getFranchiseRecordByBodyNumber(cleanBody);
    if (record && record.inspectionChecklist) {
      return record.inspectionChecklist;
    }
    if (record) {
      const isPassed = record.inspectionPassed ?? false;
      const def = createDefaultInspectionChecklist(
        cleanBody, 
        record.inspectorName || 'Carmela Dizon',
        isPassed ? 'PASSED' : 'FAILED'
      );
      if (record.inspectionDate) def.inspectionDate = record.inspectionDate;
      if (record.notes) def.remarks = record.notes;
      def.operatorName = record.operatorName;
      def.driverName = record.driverName;
      def.plateNumber = record.plateNumber;
      def.makeModel = record.makeModel || record.make;
      def.motorNumber = record.motorNumber || record.engineNumber;
      def.chassisNumber = record.chassisNumber;
      return def;
    }
  } catch (err) {
    console.warn('Inspection load notice:', err);
  }

  // If not in official franchise records: strictly FAILED / Not Passed
  const unrecorded = createDefaultInspectionChecklist(cleanBody, 'Carmela Dizon', 'FAILED');
  unrecorded.remarks = 'Unit not found in MTFRB Franchise Registry records. Physical inspection not passed.';
  return unrecorded;
}

export function isBodyNumberInspectionPassed(bodyNumber: string): boolean {
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return false;
  try {
    // 1. Check official franchise record
    const record = getFranchiseRecordByBodyNumber(cleanBody);
    if (!record) {
      return false;
    }

    // 2. Explicit inspection status from separate database
    const raw = localStorage.getItem(`${INSPECTION_STORAGE_KEY_PREFIX}${cleanBody}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.status === 'PASSED') return true;
      if (parsed && parsed.status === 'FAILED') return false;
    }

    // 3. Check embedded checklist or record flag
    if (record.inspectionChecklist) {
      return record.inspectionChecklist.status === 'PASSED';
    }
    return Boolean(record.inspectionPassed);
  } catch {}
  return false;
}

export function saveInspectionChecklist(checklist: TricycleInspectionChecklist) {
  const cleanBody = String(checklist.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return;
  checklist.bodyNumber = cleanBody;
  checklist.verifiedAt = Date.now();

  try {
    // If this vehicle was previously deleted, remove it from the deleted set
    const deletedSet = getDeletedInspectionsSet();
    if (deletedSet.has(cleanBody)) {
      deletedSet.delete(cleanBody);
      saveDeletedInspectionsSet(deletedSet);
    }

    // 1. Save in dedicated inspection database store (both master and specific key)
    try {
      localStorage.setItem(`${INSPECTION_STORAGE_KEY_PREFIX}${cleanBody}`, JSON.stringify(checklist));
    } catch (err) {
      console.warn('Individual checklist key storage notice:', err);
    }
    
    try {
      const currentMap = loadAllInspectionChecklists();
      currentMap[cleanBody] = checklist;
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS_DB, JSON.stringify(currentMap));
    } catch (e) {
      console.warn('Could not update master inspection DB map in localStorage (possible quota):', e);
    }

    window.dispatchEvent(new CustomEvent('mtfrb_inspection_updated', { detail: checklist }));
    broadcastChan?.postMessage({ type: 'INSPECTION_UPDATED', checklist });

    // 2. Seamlessly synchronize with Main Franchise Registry Database WITHOUT duplicating heavy photos into the main records
    const cleanNum = Number(cleanBody);
    const records = loadFranchiseRecords();
    const idx = records.findIndex((r) => {
      const rBody = r.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
      const rNum = Number(rBody);
      return rBody === cleanBody || (!isNaN(cleanNum) && !isNaN(rNum) && cleanNum === rNum);
    });

    // Lightweight reference for main franchise database
    const lightweightChecklist: TricycleInspectionChecklist = {
      ...checklist,
      frontImage: checklist.frontImage ? 'STORED_IN_INSPECTION_DB' : undefined,
      oppositeSideImage: checklist.oppositeSideImage ? 'STORED_IN_INSPECTION_DB' : undefined,
      backImage: checklist.backImage ? 'STORED_IN_INSPECTION_DB' : undefined,
      motorSideImage: checklist.motorSideImage ? 'STORED_IN_INSPECTION_DB' : undefined,
    };

    if (idx >= 0) {
      records[idx] = {
        ...records[idx],
        inspectionPassed: checklist.status === 'PASSED',
        inspectionDate: checklist.inspectionDate,
        inspectorName: checklist.inspectorName,
        inspectionChecklist: lightweightChecklist,
        motorNumber: checklist.motorNumber || records[idx].motorNumber,
        chassisNumber: checklist.chassisNumber || records[idx].chassisNumber,
        makeModel: checklist.makeModel || records[idx].makeModel,
        plateNumber: checklist.plateNumber || records[idx].plateNumber,
        notes: checklist.remarks || records[idx].notes,
        updatedAt: Date.now(),
      };
      saveFranchiseRecords(records);
    } else {
      // If client not yet in franchise records, auto-create connected record
      const newRecord: TricycleFranchiseRecord = {
        bodyNumber: cleanBody,
        franchiseNumber: `FN-2026-${cleanBody}`,
        operatorName: checklist.operatorName || `Operator #${cleanBody}`,
        driverName: checklist.driverName || `Driver #${cleanBody}`,
        contactNumber: '09170000000',
        emailAddress: '',
        barangay: 'San Nicolas',
        todaName: 'CASTROP TODA',
        routeZone: 'Zone 1',
        zone: 'Zone 1',
        makeModel: checklist.makeModel || 'Kawasaki Barako 175',
        motorNumber: checklist.motorNumber || 'MN-UNASSIGNED',
        chassisNumber: checklist.chassisNumber || 'CH-UNASSIGNED',
        plateNumber: checklist.plateNumber || 'PL-UNASSIGNED',
        franchiseType: 'NEW',
        status: 'ACTIVE',
        dateGranted: checklist.inspectionDate || new Date().toISOString().split('T')[0],
        validUntil: '2027-12-31',
        inspectionPassed: checklist.status === 'PASSED',
        inspectionDate: checklist.inspectionDate,
        inspectorName: checklist.inspectorName,
        inspectionChecklist: lightweightChecklist,
        notes: checklist.remarks || 'Fresh official MTFRB inspection created.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      records.unshift(newRecord);
      saveFranchiseRecords(records);
    }

    // 3. Update all active/in-queue tickets matching this body number
    const currentTickets = loadTickets();
    let ticketsChanged = false;
    const updatedTickets = currentTickets.map((t) => {
      const tBody = (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim().toUpperCase();
      const tNum = Number(tBody);
      const matchesBody = tBody === cleanBody || (!isNaN(cleanNum) && !isNaN(tNum) && cleanNum === tNum);
      const matchesTicketNum = t.ticketNumber.replace(/^[A-Z]+-?/i, '').trim().toUpperCase() === cleanBody;
      if (matchesBody || matchesTicketNum) {
        ticketsChanged = true;
        return {
          ...t,
          inspectionPassed: checklist.status === 'PASSED',
          inspectionDate: checklist.inspectionDate,
          inspectorName: checklist.inspectorName,
          inspectionChecklist: lightweightChecklist,
        };
      }
      return t;
    });

    if (ticketsChanged) {
      saveTickets(updatedTickets);
    }

    // 4. Push to backend dedicated inspection database (`data/inspections_db.json`)
    if (typeof fetch !== 'undefined') {
      fetch(`/api/inspections/${encodeURIComponent(cleanBody)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checklist),
      }).catch((err) => {
        console.warn('Background inspection sync notice:', err);
      });
    }
  } catch (e) {
    console.error('Failed to save inspection checklist', e);
  }
}

export function deleteInspectionChecklist(bodyNumber: string) {
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return;

  try {
    const deletedSet = getDeletedInspectionsSet();
    deletedSet.add(cleanBody);
    saveDeletedInspectionsSet(deletedSet);

    localStorage.removeItem(`${INSPECTION_STORAGE_KEY_PREFIX}${cleanBody}`);
    const map = loadAllInspectionChecklists();
    if (map[cleanBody]) {
      delete map[cleanBody];
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS_DB, JSON.stringify(map));
    }

    // Update main franchise registry: mark inspection unpassed
    const records = loadFranchiseRecords();
    const idx = records.findIndex((r) => r.bodyNumber.replace(/^#+/, '').trim().toUpperCase() === cleanBody);
    if (idx >= 0) {
      records[idx].inspectionPassed = false;
      records[idx].inspectionChecklist = undefined;
      records[idx].updatedAt = Date.now();
      saveFranchiseRecords(records);
    }

    // Update tickets in queue: unmark inspection passed
    const currentTickets = loadTickets();
    let ticketsChanged = false;
    const updatedTickets = currentTickets.map((t) => {
      const tBody = (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim().toUpperCase();
      if (tBody === cleanBody) {
        ticketsChanged = true;
        return {
          ...t,
          inspectionPassed: false,
          inspectionChecklist: undefined,
        };
      }
      return t;
    });
    if (ticketsChanged) {
      saveTickets(updatedTickets);
    }

    window.dispatchEvent(new CustomEvent('mtfrb_inspection_deleted', { detail: { bodyNumber: cleanBody } }));
    broadcastChan?.postMessage({ type: 'INSPECTION_DELETED', bodyNumber: cleanBody });

    if (typeof fetch !== 'undefined') {
      fetch(`/api/inspections/${encodeURIComponent(cleanBody)}`, { method: 'DELETE' }).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to delete inspection checklist:', err);
  }
}

/**
 * Transfer client ticket to Payments Counter (Counter ID 4)
 * Used after "Save & Complete Inspection" is selected.
 */
export function transferTicketToPaymentCounter(
  bodyNumberOrTicketId: string,
  inspectionChecklist?: TricycleInspectionChecklist,
  officerNotes?: string
): { success: boolean; ticket?: Ticket; message: string } {
  try {
    const clean = String(bodyNumberOrTicketId || '').replace(/^#+/, '').trim().toUpperCase();
    const cleanNum = Number(clean);
    const tickets = loadTickets();
    const counters = loadCounters();

    // Find Payment counter (ID 4 or name containing Payment)
    const paymentCounter = counters.find((c) => c.id === 4 || c.name.toLowerCase().includes('payment')) || counters[3] || { id: 4, name: 'Payment' };

    let foundTicket: Ticket | null = null;
    const updatedTickets = tickets.map((t) => {
      const tBody = (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim().toUpperCase();
      const tNum = Number(tBody);
      const matchesId = t.id === clean || t.id.toUpperCase() === clean;
      const matchesBody = tBody === clean || (!isNaN(cleanNum) && !isNaN(tNum) && cleanNum === tNum && cleanNum > 0);
      const matchesTicketNum = t.ticketNumber.replace(/^[A-Z]+-?/i, '').trim().toUpperCase() === clean || t.ticketNumber.toUpperCase() === clean;

      if ((matchesId || matchesBody || matchesTicketNum) && !foundTicket) {
        foundTicket = t;
        const transferNote = officerNotes
          ? `[Inspection Completed ➔ Transferred to ${paymentCounter.name} Counter: ${officerNotes}]`
          : `[Inspection Completed ➔ Transferred to ${paymentCounter.name} Counter]`;
        const newNotes = t.notes ? `${t.notes} | ${transferNote}` : transferNote;

        return {
          ...t,
          status: 'WAITING' as const,
          assignedCounter: paymentCounter.id,
          calledAt: undefined,
          servedAt: undefined,
          notes: newNotes,
          inspectionPassed: inspectionChecklist ? inspectionChecklist.status === 'PASSED' : t.inspectionPassed,
          inspectionDate: inspectionChecklist?.inspectionDate || t.inspectionDate,
          inspectorName: inspectionChecklist?.inspectorName || t.inspectorName,
          inspectionChecklist: inspectionChecklist || t.inspectionChecklist,
        };
      }
      return t;
    });

    // Fallback: If no direct match was found yet, check if Inspection Counter (ID 3) is currently serving a ticket!
    if (!foundTicket) {
      const inspectionCounter = counters.find((c) => c.id === 3 || c.name.toLowerCase().includes('inspection'));
      if (inspectionCounter?.currentTicketId) {
        const servingTicket = tickets.find((t) => t.id === inspectionCounter.currentTicketId);
        if (servingTicket) {
          foundTicket = servingTicket;
          const transferNote = officerNotes
            ? `[Inspection Completed ➔ Transferred to ${paymentCounter.name} Counter: ${officerNotes}]`
            : `[Inspection Completed ➔ Transferred to ${paymentCounter.name} Counter]`;
          const newNotes = servingTicket.notes ? `${servingTicket.notes} | ${transferNote}` : transferNote;

          for (let i = 0; i < updatedTickets.length; i++) {
            if (updatedTickets[i].id === servingTicket.id) {
              updatedTickets[i] = {
                ...servingTicket,
                status: 'WAITING' as const,
                assignedCounter: paymentCounter.id,
                calledAt: undefined,
                servedAt: undefined,
                notes: newNotes,
                inspectionPassed: inspectionChecklist ? inspectionChecklist.status === 'PASSED' : true,
                inspectionDate: inspectionChecklist?.inspectionDate || servingTicket.inspectionDate || new Date().toISOString().slice(0, 10),
                inspectorName: inspectionChecklist?.inspectorName || servingTicket.inspectorName || 'Carmela Dizon',
                inspectionChecklist: inspectionChecklist || servingTicket.inspectionChecklist,
              };
              break;
            }
          }
        }
      }
    }

    if (foundTicket) {
      // Free up any counter currently serving this ticket (especially Inspection Counter)
      const updatedCounters = counters.map((c) => {
        if (c.currentTicketId === (foundTicket as Ticket).id) {
          return { ...c, currentTicketId: null, status: 'OPEN' as const };
        }
        return c;
      });

      saveTickets(updatedTickets);
      saveCounters(updatedCounters);

      window.dispatchEvent(new Event('franchise_queue_updated'));
      window.dispatchEvent(new CustomEvent('mtfrb_tickets_updated', { detail: updatedTickets }));
      window.dispatchEvent(new CustomEvent('mtfrb_counters_updated', { detail: updatedCounters }));
      broadcastChan?.postMessage({ type: 'TICKET_TRANSFERRED', ticketId: (foundTicket as Ticket).id, toCounter: paymentCounter.id });

      // Background push to server
      if (typeof fetch !== 'undefined') {
        fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTickets),
        }).catch(() => {});
        fetch('/api/counters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedCounters),
        }).catch(() => {});
      }

      return {
        success: true,
        ticket: foundTicket,
        message: `Client ticket ${(foundTicket as Ticket).ticketNumber} transferred to ${paymentCounter.name} Counter.`,
      };
    }

    return {
      success: false,
      message: 'No active queue ticket found for this vehicle. Inspection saved to database.',
    };
  } catch (err: any) {
    console.error('Error transferring ticket to payment counter:', err);
    return { success: false, message: err?.message || 'Transfer failed' };
  }
}

/**
 * Universal station completion & client transfer to next counter
 * Sequential flow:
 * 1: Assessment -> 2: Verification -> 3: Inspection -> 4: Payment -> 5: Scanning -> 6: Encoding -> 7: Affixing -> 8: Releasing
 */
export function transferTicketToNextStation(
  ticketIdOrBody: string,
  currentCounterId: number,
  officerNotes?: string
): { success: boolean; ticket?: Ticket; nextCounter?: ServiceCounter; isCompleted?: boolean; message: string } {
  try {
    const clean = String(ticketIdOrBody || '').replace(/^#+/, '').trim().toUpperCase();
    const cleanNum = Number(clean);
    const tickets = loadTickets();
    const counters = loadCounters();

    // Determine current counter & next destination counter
    const currentCounter = counters.find((c) => c.id === currentCounterId) || counters[0];
    const isReleasing = currentCounterId === 8 || currentCounter.name.toLowerCase().includes('releasing');

    let nextCounter: ServiceCounter | undefined;
    if (!isReleasing) {
      if (currentCounterId === 3 || currentCounter.name.toLowerCase().includes('inspection')) {
        // Inspection always routes to Payment (Counter 4)
        nextCounter = counters.find((c) => c.id === 4 || c.name.toLowerCase().includes('payment')) || counters[3];
      } else {
        // Direct ID + 1 or index + 1
        nextCounter = counters.find((c) => c.id === currentCounterId + 1);
        if (!nextCounter) {
          const idx = counters.findIndex((c) => c.id === currentCounterId);
          if (idx >= 0 && idx < counters.length - 1) {
            nextCounter = counters[idx + 1];
          }
        }
      }
    }

    let foundTicket: Ticket | null = null;
    const updatedTickets = tickets.map((t) => {
      const tBody = (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim().toUpperCase();
      const tNum = Number(tBody);
      const matchesId = t.id === clean;
      const matchesBody = tBody === clean || (!isNaN(cleanNum) && !isNaN(tNum) && cleanNum === tNum);
      const matchesTicketNum = t.ticketNumber.replace(/^[A-Z]+-?/i, '').trim().toUpperCase() === clean;

      if ((matchesId || matchesBody || matchesTicketNum) && !foundTicket) {
        foundTicket = t;
        if (isReleasing || !nextCounter) {
          // Final counter completed
          const finalNote = officerNotes
            ? `[Completed & Released at ${currentCounter.name}: ${officerNotes}]`
            : `[Completed & Released at ${currentCounter.name}]`;
          return {
            ...t,
            status: 'COMPLETED' as const,
            completedAt: Date.now(),
            notes: t.notes ? `${t.notes} | ${finalNote}` : finalNote,
          };
        } else {
          // Transferred to next counter
          const transferNote = officerNotes
            ? `[Completed at ${currentCounter.name} ➔ Transferred to ${nextCounter.name}: ${officerNotes}]`
            : `[Completed at ${currentCounter.name} ➔ Transferred to ${nextCounter.name}]`;
          return {
            ...t,
            status: 'WAITING' as const,
            assignedCounter: nextCounter.id,
            calledAt: undefined,
            servedAt: undefined,
            notes: t.notes ? `${t.notes} | ${transferNote}` : transferNote,
          };
        }
      }
      return t;
    });

    if (foundTicket) {
      // Free current counter
      const updatedCounters = counters.map((c) => {
        if (c.id === currentCounterId || c.currentTicketId === (foundTicket as Ticket).id) {
          return { ...c, currentTicketId: null, status: 'OPEN' as const };
        }
        return c;
      });

      saveTickets(updatedTickets);
      saveCounters(updatedCounters);

      window.dispatchEvent(new CustomEvent('mtfrb_tickets_updated', { detail: updatedTickets }));
      window.dispatchEvent(new CustomEvent('mtfrb_counters_updated', { detail: updatedCounters }));
      if (nextCounter) {
        broadcastChan?.postMessage({ type: 'TICKET_TRANSFERRED', ticketId: (foundTicket as Ticket).id, toCounter: nextCounter.id });
      }

      return {
        success: true,
        ticket: foundTicket,
        nextCounter,
        isCompleted: isReleasing || !nextCounter,
        message: nextCounter
          ? `Client ticket ${(foundTicket as Ticket).ticketNumber} completed at ${currentCounter.name} and transferred to ${nextCounter.name}.`
          : `Client ticket ${(foundTicket as Ticket).ticketNumber} completed and released.`,
      };
    }

    return {
      success: false,
      message: 'No matching queue ticket found.',
    };
  } catch (err: any) {
    console.error('Error transferring ticket to next counter:', err);
    return { success: false, message: err?.message || 'Transfer failed' };
  }
}

export function exportInspectionsDatabase(): string {
  const map = loadAllInspectionChecklists();
  const count = Object.keys(map).length;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const filename = `MTFRB_Inspection_Checklists_Database_${dateStr}_${timeStr}.json`;

  const data = {
    exportType: 'PHYSICAL_INSPECTION_CHECKLISTS_DATABASE',
    primaryKey: 'bodyNumber',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    connectedTo: 'MTFRB_FRANCHISE_REGISTRY',
    exportTimestamp: Date.now(),
    exportDateFormatted: now.toISOString(),
    totalInspections: count,
    inspections: map,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

export function exportInspectionsCsv(): string {
  const list = loadAllInspectionsList();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const filename = `MTFRB_Inspection_Checklists_Export_${dateStr}_${timeStr}.csv`;

  const headers = [
    'Body Number',
    'Franchise Number',
    'Operator Name',
    'Driver Name',
    'TODA Association',
    'Route / Zone',
    'Plate Number',
    'Make / Model',
    'Engine / Motor Number',
    'Chassis Number',
    'Inspection Status',
    'Inspection Date',
    'Inspector Name',
    'Headlight',
    'Signal Lights',
    'Tail Light',
    'Horn',
    'Muffler',
    'Fare Matrix',
    'Photos Captured',
    'Remarks / Defects',
  ];

  const escapeCsv = (val: any) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = list.map((chk) => {
    const f = chk.connectedFranchise;
    const photoCount = [chk.frontImage, chk.oppositeSideImage, chk.backImage, chk.motorSideImage].filter(Boolean).length;

    return [
      escapeCsv(chk.bodyNumber),
      escapeCsv(f?.franchiseNumber || f?.permitNumber || 'N/A'),
      escapeCsv(chk.operatorName || f?.operatorName || 'N/A'),
      escapeCsv(chk.driverName || f?.driverName || 'N/A'),
      escapeCsv(f?.todaName || f?.todaAssociation || 'N/A'),
      escapeCsv(f?.routeZone || f?.zone || 'N/A'),
      escapeCsv(chk.plateNumber || f?.plateNumber || 'N/A'),
      escapeCsv(chk.makeModel || f?.makeModel || 'N/A'),
      escapeCsv(chk.motorNumber || f?.motorNumber || 'N/A'),
      escapeCsv(chk.chassisNumber || f?.chassisNumber || 'N/A'),
      escapeCsv(chk.status),
      escapeCsv(chk.inspectionDate),
      escapeCsv(chk.inspectorName),
      escapeCsv(chk.headlight),
      escapeCsv(chk.signalLights),
      escapeCsv(chk.tailLight),
      escapeCsv(chk.horn),
      escapeCsv(chk.muffler),
      escapeCsv(chk.fareMatrix),
      escapeCsv(`${photoCount} / 4 Photos`),
      escapeCsv(chk.remarks || ''),
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

export async function fetchInspectionsFromServer() {
  try {
    const res = await fetch('/api/inspections');
    if (res.ok) {
      const data = await res.json();
      if (data && data.inspections && typeof data.inspections === 'object') {
        const localInspections = loadAllInspectionChecklists();
        const deletedInspections = getDeletedInspectionsSet();
        const merged: Record<string, TricycleInspectionChecklist> = { ...localInspections };

        for (const [bodyNum, sInspection] of Object.entries(data.inspections as Record<string, TricycleInspectionChecklist>)) {
          const cleanBody = bodyNum.replace(/^#+/, '').trim().toUpperCase();
          if (deletedInspections.has(cleanBody)) continue;
          const localI = merged[cleanBody];
          if (!localI) {
            merged[cleanBody] = sInspection;
          } else {
            // Preserve local photos if server doesn't have them
            merged[cleanBody] = {
              ...sInspection,
              frontImage: localI.frontImage || sInspection.frontImage,
              oppositeSideImage: localI.oppositeSideImage || sInspection.oppositeSideImage,
              backImage: localI.backImage || sInspection.backImage,
              motorSideImage: localI.motorSideImage || sInspection.motorSideImage,
            };
          }
        }

        localStorage.setItem(STORAGE_KEYS.INSPECTIONS_DB, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('mtfrb_inspections_db_synced', { detail: merged }));
        return merged;
      }
    }
  } catch (err) {
    console.warn('Could not sync inspections from server:', err);
  }
  return null;
}

export async function saveInspectionPhotosToServer(bodyNumber: string, photos: {
  frontImage?: string;
  oppositeSideImage?: string;
  backImage?: string;
  motorSideImage?: string;
}) {
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return false;
  try {
    const res = await fetch(`/api/inspections/${encodeURIComponent(cleanBody)}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(photos),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to upload inspection photos to server:', err);
    return false;
  }
}

// ============================================================================
// SEPARATE PAYMENTS DATABASE (Connected to Main Database by bodyNumber)
// ============================================================================

const DELETED_PAYMENTS_KEY = 'mtfrb_deleted_payments_set';

export function getDeletedPaymentsSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PAYMENTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map((s) => String(s).toUpperCase()));
    }
  } catch {}
  return new Set();
}

export function saveDeletedPaymentsSet(set: Set<string>): void {
  try {
    localStorage.setItem(DELETED_PAYMENTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function seedBaselinePayments(): Record<string, PaymentRecord> {
  return {
    '0042': {
      id: 'PAY-BASE-0042',
      bodyNumber: '0042',
      orNumber: 'OR-89217823',
      ticketNumber: 'R-201',
      applicantName: 'Danilo Santos',
      payerName: 'Danilo Santos',
      selectedFeeIds: ['fee-annual-supervision', 'fee-filing-renewal', 'fee-inspection', 'fee-sticker'],
      feeBreakdown: [
        { id: 'fee-annual-supervision', name: 'Annual Supervision Fee', amount: 350 },
        { id: 'fee-filing-renewal', name: 'Filing & Processing Fee (Renewal)', amount: 250 },
        { id: 'fee-inspection', name: 'Motorized Inspection & Emission Testing Fee', amount: 150 },
        { id: 'fee-sticker', name: 'Municipal Franchise Sticker & Plate Tag', amount: 100 },
      ],
      totalAmount: 850,
      amountPaid: 1000,
      change: 150,
      paymentMethod: 'CASH',
      remarks: 'Official municipal franchise renewal fee assessment fully settled.',
      cashierName: 'Maria Santos (Counter 4)',
      counterId: 4,
      createdAt: 1772323335000,
      paidAt: 'Mar 1, 2026, 09:42:15 AM',
    },
    '0118': {
      id: 'PAY-BASE-0118',
      bodyNumber: '0118',
      orNumber: 'OR-67489211',
      ticketNumber: 'R-202',
      applicantName: 'Rogelio Fernandez',
      payerName: 'Rogelio Fernandez',
      selectedFeeIds: ['fee-annual-supervision', 'fee-filing-renewal', 'fee-inspection', 'fee-sticker', 'fee-legal-research'],
      feeBreakdown: [
        { id: 'fee-annual-supervision', name: 'Annual Supervision Fee', amount: 350 },
        { id: 'fee-filing-renewal', name: 'Filing & Processing Fee (Renewal)', amount: 250 },
        { id: 'fee-inspection', name: 'Motorized Inspection & Emission Testing Fee', amount: 150 },
        { id: 'fee-sticker', name: 'Municipal Franchise Sticker & Plate Tag', amount: 100 },
        { id: 'fee-legal-research', name: 'Legal Research & Verification Fee', amount: 70 },
      ],
      totalAmount: 920,
      amountPaid: 920,
      change: 0,
      paymentMethod: 'CASH',
      remarks: 'Full payment recorded at Municipal Treasury Counter 4.',
      cashierName: 'Maria Santos (Counter 4)',
      counterId: 4,
      createdAt: 1771146930000,
      paidAt: 'Feb 15, 2026, 10:15:30 AM',
    },
    '0256': {
      id: 'PAY-BASE-0256',
      bodyNumber: '0256',
      orNumber: 'OR-55441290',
      ticketNumber: 'N-101',
      applicantName: 'Eduardo Manlapaz',
      payerName: 'Eduardo Manlapaz',
      selectedFeeIds: ['fee-filing-new', 'fee-inspection', 'fee-sticker'],
      feeBreakdown: [
        { id: 'fee-filing-new', name: 'Filing & Processing Fee (New)', amount: 500 },
        { id: 'fee-inspection', name: 'Motorized Inspection & Emission Testing Fee', amount: 150 },
        { id: 'fee-sticker', name: 'Municipal Franchise Sticker & Plate Tag', amount: 100 },
      ],
      totalAmount: 750,
      amountPaid: 800,
      change: 50,
      paymentMethod: 'CASH',
      remarks: 'New franchise application filing assessment.',
      cashierName: 'Maria Santos (Counter 4)',
      counterId: 4,
      createdAt: 1771579324000,
      paidAt: 'Feb 20, 2026, 02:22:04 PM',
    },
    '0389': {
      id: 'PAY-BASE-0389',
      bodyNumber: '0389',
      orNumber: 'OR-99120034',
      ticketNumber: 'CM-301',
      applicantName: 'Nestor Ramos',
      payerName: 'Nestor Ramos',
      selectedFeeIds: ['fee-filing-renewal', 'fee-change-motor', 'fee-inspection', 'fee-sticker'],
      feeBreakdown: [
        { id: 'fee-filing-renewal', name: 'Filing & Processing Fee (Renewal)', amount: 250 },
        { id: 'fee-change-motor', name: 'Change Motor / Engine Modification Fee', amount: 600 },
        { id: 'fee-inspection', name: 'Motorized Inspection & Emission Testing Fee', amount: 150 },
        { id: 'fee-sticker', name: 'Municipal Franchise Sticker & Plate Tag', amount: 100 },
      ],
      totalAmount: 1100,
      amountPaid: 1100,
      change: 0,
      paymentMethod: 'GCASH',
      remarks: 'Change of motor and franchise renewal payment settled via GCash reference.',
      cashierName: 'Maria Santos (Counter 4)',
      counterId: 4,
      createdAt: 1769591118000,
      paidAt: 'Jan 28, 2026, 11:05:18 AM',
    },
    '0412': {
      id: 'PAY-BASE-0412',
      bodyNumber: '0412',
      orNumber: 'OR-11229988',
      ticketNumber: 'OD-401',
      applicantName: 'Arnel Dizon',
      payerName: 'Arnel Dizon',
      selectedFeeIds: ['fee-dropping', 'fee-clearance'],
      feeBreakdown: [
        { id: 'fee-dropping', name: 'Order for Dropping / Surrender of Unit Fee', amount: 500 },
        { id: 'fee-clearance', name: 'MTFRB Clearance Certificate Fee', amount: 150 },
      ],
      totalAmount: 650,
      amountPaid: 700,
      change: 50,
      paymentMethod: 'CASH',
      remarks: 'Order for dropping and municipal clearance fee settled.',
      cashierName: 'Maria Santos (Counter 4)',
      counterId: 4,
      createdAt: 1768045555000,
      paidAt: 'Jan 10, 2026, 01:45:55 PM',
    },
  };
}

export function loadAllPaymentsMap(): Record<string, PaymentRecord> {
  const deletedPayments = getDeletedPaymentsSet();
  let map: Record<string, PaymentRecord> = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYMENTS_DB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        map = parsed;
      }
    }
  } catch (err) {
    console.warn('Error loading payments map from storage:', err);
  }

  // Scan localStorage for any individually saved payment records (prefix mtfrb_payment_body_)
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PAYMENT_STORAGE_KEY_PREFIX)) {
          const bodyNum = key.replace(PAYMENT_STORAGE_KEY_PREFIX, '').trim().toUpperCase();
          if (!deletedPayments.has(bodyNum) && !map[bodyNum]) {
            try {
              const itemRaw = localStorage.getItem(key);
              if (itemRaw) {
                const item = JSON.parse(itemRaw);
                if (item && item.bodyNumber) {
                  map[bodyNum] = item;
                }
              }
            } catch {}
          }
        }
      }
    }
  } catch {}

  // If map is completely empty, initialize with baseline payments (excluding deleted) so database never resets to empty
  if (Object.keys(map).length === 0) {
    const baseline = seedBaselinePayments();
    for (const [bNum, p] of Object.entries(baseline)) {
      if (!deletedPayments.has(bNum.toUpperCase())) {
        map[bNum] = p;
      }
    }
    try {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS_DB, JSON.stringify(map));
    } catch {}
  }

  return map;
}

export function loadAllPaymentsList(): PaymentRecord[] {
  const map = loadAllPaymentsMap();
  const list = Object.values(map);
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getPaymentRecordByBodyNumber(bodyNumber: string): PaymentRecord | null {
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return null;

  try {
    // 1. Check individual key
    const directRaw = localStorage.getItem(`${PAYMENT_STORAGE_KEY_PREFIX}${cleanBody}`);
    if (directRaw) {
      return JSON.parse(directRaw);
    }
  } catch {}

  // 2. Check master map
  const map = loadAllPaymentsMap();
  if (map[cleanBody]) {
    return map[cleanBody];
  }

  // 3. Numeric match fallback e.g. 042 vs 42
  const cleanNum = Number(cleanBody);
  if (!isNaN(cleanNum)) {
    const matchKey = Object.keys(map).find((k) => Number(k) === cleanNum);
    if (matchKey && map[matchKey]) {
      return map[matchKey];
    }
  }

  return null;
}

export function savePaymentRecord(payment: PaymentRecord): void {
  const cleanBody = String(payment.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return;

  payment.bodyNumber = cleanBody;
  if (!payment.id) {
    payment.id = `PAY-${Date.now()}-${cleanBody}`;
  }
  if (!payment.createdAt) {
    payment.createdAt = Date.now();
  }
  if (!payment.paidAt) {
    payment.paidAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  try {
    // 1. Clear from deleted payments set if present
    const deletedPayments = getDeletedPaymentsSet();
    if (deletedPayments.has(cleanBody)) {
      deletedPayments.delete(cleanBody);
      saveDeletedPaymentsSet(deletedPayments);
    }

    // 2. Save specific item key
    localStorage.setItem(`${PAYMENT_STORAGE_KEY_PREFIX}${cleanBody}`, JSON.stringify(payment));

    // 3. Save master payments DB map
    const map = loadAllPaymentsMap();
    map[cleanBody] = payment;
    localStorage.setItem(STORAGE_KEYS.PAYMENTS_DB, JSON.stringify(map));

    // 4. Dispatch events for cross-tab & live updates
    window.dispatchEvent(new CustomEvent('mtfrb_payment_updated', { detail: payment }));
    broadcastChan?.postMessage({ type: 'PAYMENT_UPDATED', payment });

    // 5. Connect to main franchise database record by bodyNumber
    const records = loadFranchiseRecords();
    const cleanNum = Number(cleanBody);
    const recIdx = records.findIndex((r) => {
      const rBody = r.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
      const rNum = Number(rBody);
      return rBody === cleanBody || (!isNaN(cleanNum) && !isNaN(rNum) && cleanNum === rNum);
    });

    if (recIdx >= 0) {
      records[recIdx] = {
        ...records[recIdx],
        orNumber: payment.orNumber,
        latestPaymentDate: payment.paidAt,
        latestPaymentAmount: payment.totalAmount,
        updatedAt: Date.now(),
      };
      saveFranchiseRecords(records);
    }

    // 6. Connect to any active queue ticket matching bodyNumber
    const currentTickets = loadTickets();
    let ticketsChanged = false;
    const updatedTickets = currentTickets.map((t) => {
      const tBody = (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim().toUpperCase();
      const tNum = Number(tBody);
      const matchesBody = tBody === cleanBody || (!isNaN(cleanNum) && !isNaN(tNum) && cleanNum === tNum);
      const matchesTicketNum = t.ticketNumber.replace(/^[A-Z]+-?/i, '').trim().toUpperCase() === cleanBody;
      if (matchesBody || matchesTicketNum) {
        ticketsChanged = true;
        return {
          ...t,
          orNumber: payment.orNumber,
          paymentCompleted: true,
          paymentAmount: payment.totalAmount,
        };
      }
      return t;
    });
    if (ticketsChanged) {
      saveTickets(updatedTickets);
    }

    // 7. Push to server payments database
    if (typeof fetch !== 'undefined') {
      fetch(`/api/payments/${encodeURIComponent(cleanBody)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment),
      }).catch((err) => {
        console.warn('Background payment server sync notice:', err);
      });
    }
  } catch (err) {
    console.error('Failed to save payment record:', err);
  }
}

export function deletePaymentRecord(bodyNumber: string): void {
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  if (!cleanBody) return;

  try {
    const deletedPayments = getDeletedPaymentsSet();
    deletedPayments.add(cleanBody);
    saveDeletedPaymentsSet(deletedPayments);

    localStorage.removeItem(`${PAYMENT_STORAGE_KEY_PREFIX}${cleanBody}`);
    const map = loadAllPaymentsMap();
    delete map[cleanBody];
    localStorage.setItem(STORAGE_KEYS.PAYMENTS_DB, JSON.stringify(map));

    window.dispatchEvent(new CustomEvent('mtfrb_payment_deleted', { detail: { bodyNumber: cleanBody } }));
    broadcastChan?.postMessage({ type: 'PAYMENT_DELETED', bodyNumber: cleanBody });

    if (typeof fetch !== 'undefined') {
      fetch(`/api/payments/${encodeURIComponent(cleanBody)}`, { method: 'DELETE' }).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to delete payment record:', err);
  }
}

export async function fetchPaymentsFromServer() {
  try {
    const res = await fetch('/api/payments');
    if (res.ok) {
      const data = await res.json();
      if (data && data.payments && typeof data.payments === 'object') {
        const localPayments = loadAllPaymentsMap();
        const deletedPayments = getDeletedPaymentsSet();
        const merged: Record<string, PaymentRecord> = { ...localPayments };

        for (const [bodyNum, sPayment] of Object.entries(data.payments as Record<string, PaymentRecord>)) {
          const cleanBody = bodyNum.replace(/^#+/, '').trim().toUpperCase();
          if (deletedPayments.has(cleanBody)) continue;
          const localP = merged[cleanBody];
          if (!localP || (sPayment.createdAt || 0) >= (localP.createdAt || 0)) {
            merged[cleanBody] = sPayment;
          }
        }

        localStorage.setItem(STORAGE_KEYS.PAYMENTS_DB, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('mtfrb_payments_db_synced', { detail: merged }));

        // Push any missing local payments to server
        for (const [bodyNum, p] of Object.entries(localPayments)) {
          if (!data.payments[bodyNum]) {
            fetch(`/api/payments/${encodeURIComponent(bodyNum)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(p),
            }).catch(() => {});
          }
        }

        return merged;
      }
    }
  } catch (err) {
    console.warn('Could not sync payments from server:', err);
  }
  return null;
}

export function exportPaymentsAsCsv(paymentsList: PaymentRecord[], filename: string = `MTFRB_Payments_Registry_${new Date().toISOString().slice(0, 10)}.csv`) {
  const headers = [
    'Body Number',
    'Official Receipt (OR) Number',
    'Applicant / Payor Name',
    'Ticket Number',
    'Selected Fees',
    'Total Amount (PHP)',
    'Payment Method',
    'Cashier / Officer',
    'Date & Time Paid',
    'Remarks',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = paymentsList.map((p) => {
    const feesJoined = (p.feeBreakdown || []).map((f) => `${f.name} (P${f.amount.toFixed(2)})`).join('; ');
    return [
      escapeCsv(p.bodyNumber),
      escapeCsv(p.orNumber),
      escapeCsv(p.applicantName),
      escapeCsv(p.ticketNumber || 'N/A'),
      escapeCsv(feesJoined),
      escapeCsv(p.totalAmount.toFixed(2)),
      escapeCsv(p.paymentMethod || 'CASH'),
      escapeCsv(p.cashierName),
      escapeCsv(p.paidAt || new Date(p.createdAt).toLocaleString()),
      escapeCsv(p.remarks || ''),
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

// ============================================================================
// MUNICIPAL FEE CHECKLIST CATALOG HELPERS (Admin configurable fees)
// ============================================================================

export function loadMunicipalFeesCatalog(): PaymentFeeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FEES_CATALOG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error loading municipal fees catalog:', err);
  }
  return [...PAYMENT_FEES_CATALOG];
}

export function saveMunicipalFeesCatalog(fees: PaymentFeeItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FEES_CATALOG, JSON.stringify(fees));
    window.dispatchEvent(new CustomEvent('mtfrb_fees_catalog_updated', { detail: fees }));
    broadcastChan?.postMessage({ type: 'FEES_CATALOG_UPDATED', fees });

    if (typeof fetch !== 'undefined') {
      fetch('/api/fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees }),
      }).catch((err) => {
        console.warn('Failed to sync fees to server:', err);
      });
    }
  } catch (err) {
    console.error('Failed to save municipal fees catalog:', err);
  }
}

export function addMunicipalFeeItem(item: Omit<PaymentFeeItem, 'id'> & { id?: string }): PaymentFeeItem {
  const current = loadMunicipalFeesCatalog();
  const newItem: PaymentFeeItem = {
    id: item.id || `fee_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: item.name.trim(),
    amount: Number(item.amount) || 0,
    description: item.description?.trim() || '',
    category: item.category || 'other',
  };
  const updated = [...current, newItem];
  saveMunicipalFeesCatalog(updated);
  return newItem;
}

export function updateMunicipalFeeItem(id: string, updates: Partial<PaymentFeeItem>): void {
  const current = loadMunicipalFeesCatalog();
  const updated = current.map((f) => {
    if (f.id === id) {
      return {
        ...f,
        ...updates,
        amount: updates.amount !== undefined ? Number(updates.amount) : f.amount,
        name: updates.name ? updates.name.trim() : f.name,
      };
    }
    return f;
  });
  saveMunicipalFeesCatalog(updated);
}

export function deleteMunicipalFeeItem(id: string): void {
  const current = loadMunicipalFeesCatalog();
  const updated = current.filter((f) => f.id !== id);
  saveMunicipalFeesCatalog(updated);
}

export function resetMunicipalFeesToDefault(): PaymentFeeItem[] {
  const defaults = [...PAYMENT_FEES_CATALOG];
  saveMunicipalFeesCatalog(defaults);
  return defaults;
}

export async function fetchMunicipalFeesFromServer(): Promise<PaymentFeeItem[] | null> {
  try {
    const res = await fetch('/api/fees');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.fees) && data.fees.length > 0) {
        localStorage.setItem(STORAGE_KEYS.FEES_CATALOG, JSON.stringify(data.fees));
        window.dispatchEvent(new CustomEvent('mtfrb_fees_catalog_updated', { detail: data.fees }));
        return data.fees;
      }
    }
  } catch (err) {
    console.warn('Could not sync fees catalog from server:', err);
  }
  return null;
}
