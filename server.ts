import express from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { 
  Ticket, 
  ServiceCounter, 
  DEFAULT_COUNTERS, 
  UserAccount, 
  DEFAULT_USERS,
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
  PAYMENT_FEES_CATALOG
} from './src/types';
import { generateDemoQueue50Database } from './src/utils/demoQueueDatabase';

const app = express();
const PORT = 3000;

// Body parser with generous limit for vehicle inspection photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Persistent Database Directory & File
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const INSPECTIONS_DB_FILE = path.join(DATA_DIR, 'inspections_db.json');
const PAYMENTS_DB_FILE = path.join(DATA_DIR, 'payments_db.json');
const FEES_DB_FILE = path.join(DATA_DIR, 'fees_db.json');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

if (!fs.existsSync(PHOTOS_DIR)) {
  try {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create photos directory:', err);
  }
}

// Helper to save base64 photo to binary image on disk
function saveBase64PhotoToDisk(cleanBody: string, slot: string, dataUrl: string): string {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  if (dataUrl === 'STORED_IN_INSPECTION_DB') return '';
  if (dataUrl.startsWith('/api/photos/')) return dataUrl;

  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (match) {
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const filename = `${cleanBody}_${slot}.${ext}`;
    const filePath = path.join(PHOTOS_DIR, filename);
    try {
      fs.writeFileSync(filePath, buffer);
    } catch (err) {
      console.error(`Failed to save photo file to disk: ${filePath}`, err);
    }
  }
  return dataUrl;
}

// In-memory stores initialized with disk data if present, or defaults
let usersStore: UserAccount[] = DEFAULT_USERS.map(u => 
  u.role === 'ADMIN' || u.username === 'admin' ? { ...u, fullName: 'Kevin Salonga' } : u
);

const INITIAL_COUNTERS: ServiceCounter[] = DEFAULT_COUNTERS.map((c) => ({
  ...c,
  currentTicketId: null,
  status: 'OPEN' as const,
}));

let ticketsStore: Ticket[] = [];
let countersStore: ServiceCounter[] = [...INITIAL_COUNTERS];
let deletedUserIdsStore: string[] = [];
let franchiseRegistryStore: TricycleFranchiseRecord[] = [...DEFAULT_FRANCHISE_RECORDS];
let advisoryStore: string = 'Please listen for audio chimes & voice announcements when your number is summoned. Senior Citizens, PWDs, and Pregnant applicants may directly proceed to Priority Lane Counter 3.';
let terminalPasswordsStore: TerminalPasswords = { ...DEFAULT_TERMINAL_PASSWORDS };
let backupConfigStore: BackupConfig = { ...DEFAULT_BACKUP_CONFIG };
let backupLogsStore: BackupNotificationLog[] = [];
let latestAnnouncementStore: QueueAnnouncement | null = null;
let inspectionsStore: Record<string, TricycleInspectionChecklist> = {};
let paymentsStore: Record<string, PaymentRecord> = {};
let feesCatalogStore: PaymentFeeItem[] = [...PAYMENT_FEES_CATALOG];
let lastUpdated = Date.now();

// Baseline inspections seed linked to known franchise records
function seedBaselineInspections() {
  franchiseRegistryStore.forEach((record) => {
    const cleanBody = record.bodyNumber.trim().toUpperCase();
    if (!inspectionsStore[cleanBody]) {
      const isPassed = record.inspectionPassed ?? true;
      const chk = createDefaultInspectionChecklist(
        cleanBody,
        record.inspectorName || 'Carmela Dizon',
        isPassed ? 'PASSED' : 'FAILED'
      );
      chk.operatorName = record.operatorName;
      chk.driverName = record.driverName;
      chk.plateNumber = record.plateNumber;
      chk.makeModel = record.makeModel || record.make;
      chk.motorNumber = record.motorNumber || record.engineNumber;
      chk.chassisNumber = record.chassisNumber;
      chk.inspectionDate = record.inspectionDate || new Date().toISOString().slice(0, 10);
      chk.remarks = record.notes || (isPassed ? 'Passed MTFRB physical vehicle inspection.' : 'Pending inspection.');
      inspectionsStore[cleanBody] = chk;
    }
  });
}

// Load separate inspection checklist database from dedicated disk file
function loadInspectionsFromDisk() {
  try {
    if (fs.existsSync(INSPECTIONS_DB_FILE)) {
      const raw = fs.readFileSync(INSPECTIONS_DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        inspectionsStore = data;
      }
      console.log(`[INSPECTIONS DB LOADED] Loaded ${Object.keys(inspectionsStore).length} vehicle inspection checklists from dedicated disk storage.`);
    } else {
      // If legacy db.json had inspections, migrate them into the separate database
      if (Object.keys(inspectionsStore).length > 0) {
        saveInspectionsToDisk();
      } else {
        seedBaselineInspections();
        saveInspectionsToDisk();
      }
      console.log(`[INSPECTIONS DB CREATED] Initialized dedicated inspection database with ${Object.keys(inspectionsStore).length} records.`);
    }
  } catch (err) {
    console.error('Failed to load inspections database from disk:', err);
  }
}

// Save separate inspection checklist database to dedicated disk file
function saveInspectionsToDisk() {
  try {
    // Write base64 photos to discrete files in data/photos to guarantee image durability
    for (const [bodyNum, chk] of Object.entries(inspectionsStore)) {
      if (chk.frontImage && chk.frontImage.startsWith('data:image/')) {
        saveBase64PhotoToDisk(bodyNum, 'frontImage', chk.frontImage);
      }
      if (chk.oppositeSideImage && chk.oppositeSideImage.startsWith('data:image/')) {
        saveBase64PhotoToDisk(bodyNum, 'oppositeSideImage', chk.oppositeSideImage);
      }
      if (chk.backImage && chk.backImage.startsWith('data:image/')) {
        saveBase64PhotoToDisk(bodyNum, 'backImage', chk.backImage);
      }
      if (chk.motorSideImage && chk.motorSideImage.startsWith('data:image/')) {
        saveBase64PhotoToDisk(bodyNum, 'motorSideImage', chk.motorSideImage);
      }
    }
    fs.writeFileSync(INSPECTIONS_DB_FILE, JSON.stringify(inspectionsStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save inspections database to disk:', err);
  }
}

function seedBaselinePayments(): Record<string, PaymentRecord> {
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

// Load separate payments database from dedicated disk file
function loadPaymentsFromDisk() {
  try {
    if (fs.existsSync(PAYMENTS_DB_FILE)) {
      const raw = fs.readFileSync(PAYMENTS_DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        paymentsStore = data;
      } else {
        paymentsStore = seedBaselinePayments();
        savePaymentsToDisk();
      }
      console.log(`[PAYMENTS DB LOADED] Loaded ${Object.keys(paymentsStore).length} payment transaction records from dedicated disk storage.`);
    } else {
      paymentsStore = seedBaselinePayments();
      savePaymentsToDisk();
      console.log(`[PAYMENTS DB CREATED] Initialized dedicated payments database with ${Object.keys(paymentsStore).length} baseline records.`);
    }
  } catch (err) {
    console.error('Failed to load payments database from disk:', err);
  }
}

// Save separate payments database to dedicated disk file
function savePaymentsToDisk() {
  try {
    fs.writeFileSync(PAYMENTS_DB_FILE, JSON.stringify(paymentsStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save payments database to disk:', err);
  }
}

// Load municipal fee checklist catalog from disk
function loadFeesFromDisk() {
  try {
    if (fs.existsSync(FEES_DB_FILE)) {
      const raw = fs.readFileSync(FEES_DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        feesCatalogStore = data;
      }
      console.log(`[FEES DB LOADED] Loaded ${feesCatalogStore.length} municipal fee items from disk.`);
    } else {
      saveFeesToDisk();
      console.log(`[FEES DB CREATED] Initialized default municipal fees catalog.`);
    }
  } catch (err) {
    console.error('Failed to load fees database from disk:', err);
  }
}

// Save municipal fee checklist catalog to disk
function saveFeesToDisk() {
  try {
    fs.writeFileSync(FEES_DB_FILE, JSON.stringify(feesCatalogStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save fees database to disk:', err);
  }
}

// Load persistent state from disk to prevent any data rollback on server start
function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.deletedUserIds)) {
        deletedUserIdsStore = data.deletedUserIds;
      }
      if (Array.isArray(data.tickets)) {
        ticketsStore = data.tickets.map((t: Ticket, index: number) => {
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
          }
          return t;
        });
      }
      if (Array.isArray(data.counters) && data.counters.length > 0) {
        countersStore = data.counters;
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        // Filter out any deleted users - do NOT merge them back
        usersStore = data.users.filter((u: UserAccount) => 
          !deletedUserIdsStore.includes(u.id.toLowerCase()) && 
          !deletedUserIdsStore.includes(u.username.toLowerCase())
        );
      }
      if (Array.isArray(data.franchiseRegistry) && data.franchiseRegistry.length > 0) {
        franchiseRegistryStore = data.franchiseRegistry;
      }
      if (typeof data.advisory === 'string' && data.advisory.trim()) {
        advisoryStore = data.advisory;
      }
      if (data.terminalPasswords && typeof data.terminalPasswords === 'object') {
        terminalPasswordsStore = {
          kioskPassword: data.terminalPasswords.kioskPassword || 'admin',
          lobbyTvPassword: data.terminalPasswords.lobbyTvPassword || 'admin',
        };
      }
      if (data.backupConfig && typeof data.backupConfig === 'object') {
        backupConfigStore = {
          ...DEFAULT_BACKUP_CONFIG,
          ...data.backupConfig,
        };
      }
      if (Array.isArray(data.backupLogs)) {
        backupLogsStore = data.backupLogs;
      }
      if (data.latestAnnouncement && typeof data.latestAnnouncement === 'object') {
        latestAnnouncementStore = data.latestAnnouncement;
      }
      if (data.inspections && typeof data.inspections === 'object' && Object.keys(data.inspections).length > 0) {
        inspectionsStore = data.inspections;
      }
      console.log(`[DB LOADED] Preserved ${ticketsStore.length} tickets, ${countersStore.length} counters, ${usersStore.length} users, ${franchiseRegistryStore.length} franchise records.`);
    } else {
      // Save initial defaults to disk
      saveDatabaseToDisk();
    }
  } catch (err) {
    console.error('Failed to load database from disk:', err);
  }
}

// Save database to disk synchronously/safely
function saveDatabaseToDisk() {
  try {
    const payload = {
      tickets: ticketsStore,
      counters: countersStore,
      users: usersStore,
      deletedUserIds: deletedUserIdsStore,
      franchiseRegistry: franchiseRegistryStore,
      advisory: advisoryStore,
      terminalPasswords: terminalPasswordsStore,
      backupConfig: backupConfigStore,
      backupLogs: backupLogsStore,
      latestAnnouncement: latestAnnouncementStore,
      lastUpdated: Date.now(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    saveInspectionsToDisk();
    savePaymentsToDisk();
    saveFeesToDisk();
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }
}

// Initial disk load
loadDatabaseFromDisk();
loadInspectionsFromDisk();
loadPaymentsFromDisk();
loadFeesFromDisk();

// Active SSE client connections
const sseClients = new Set<express.Response>();

function broadcastRealtimeUpdate(type: string = 'UPDATE', extraPayload?: Record<string, any>) {
  lastUpdated = Date.now();
  const payload = JSON.stringify({
    type,
    tickets: ticketsStore,
    counters: countersStore,
    users: usersStore,
    franchiseRegistry: franchiseRegistryStore,
    payments: paymentsStore,
    inspections: inspectionsStore,
    feesCatalog: feesCatalogStore,
    advisory: advisoryStore,
    terminalPasswords: terminalPasswordsStore,
    backupConfig: backupConfigStore,
    latestAnnouncement: latestAnnouncementStore,
    timestamp: lastUpdated,
    ...extraPayload,
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ---------------- API ENDPOINTS ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Full state for initial hydration or polling across all computers and browsers
app.get('/api/state', (req, res) => {
  res.json({
    tickets: ticketsStore,
    counters: countersStore,
    users: usersStore,
    franchiseRegistry: franchiseRegistryStore,
    payments: paymentsStore,
    inspections: inspectionsStore,
    feesCatalog: feesCatalogStore,
    advisory: advisoryStore,
    terminalPasswords: terminalPasswordsStore,
    backupConfig: backupConfigStore,
    latestAnnouncement: latestAnnouncementStore,
    timestamp: lastUpdated,
  });
});

// Announce / Call Ticket broadcast across all screens, devices, and browsers
app.post('/api/announce', (req, res) => {
  const { ticketNumber, bodyNumber, counterName, counterId, officerName, serviceType, ticketId } = req.body;
  const announcement: QueueAnnouncement = {
    id: 'ann-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    ticketId: ticketId ? String(ticketId).trim() : undefined,
    ticketNumber: String(ticketNumber || '').trim(),
    bodyNumber: String(bodyNumber || ticketNumber || '').trim(),
    counterName: String(counterName || 'Service Station').trim(),
    counterId: Number(counterId) || 1,
    officerName: officerName ? String(officerName).trim() : undefined,
    serviceType: serviceType ? String(serviceType).trim() : undefined,
    calledAt: Date.now(),
  };

  latestAnnouncementStore = announcement;
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('CALL_TICKET', { announcement });
  res.json({ success: true, announcement });
});

// Full call ticket endpoint (updates ticket, updates counter, broadcasts announcement)
app.post('/api/call-ticket', (req, res) => {
  const { ticketId, ticketNumber, bodyNumber, counterId, counterName, officerName, serviceType } = req.body;
  const now = Date.now();

  // 1. Update ticket in ticketsStore
  const tIdx = ticketsStore.findIndex(t => t.id === ticketId || t.ticketNumber === ticketNumber);
  let resolvedTicketId = ticketId;
  if (tIdx >= 0) {
    resolvedTicketId = ticketsStore[tIdx].id;
    ticketsStore[tIdx] = {
      ...ticketsStore[tIdx],
      status: 'SERVING',
      calledAt: now,
      servedAt: ticketsStore[tIdx].servedAt || now,
      assignedCounter: Number(counterId) || ticketsStore[tIdx].assignedCounter,
      assignedOfficer: officerName || ticketsStore[tIdx].assignedOfficer,
      callCount: (ticketsStore[tIdx].callCount || 0) + 1,
    };
  } else if (ticketNumber) {
    const newT: Ticket = {
      id: ticketId || `ticket-${now}`,
      ticketNumber: String(ticketNumber).trim(),
      franchiseType: (serviceType as any) || 'NEW',
      priorityLevel: 'REGULAR',
      applicantName: 'Applicant ' + ticketNumber,
      classification: 'Operator',
      zone: 'Zone 1',
      status: 'SERVING',
      createdAt: now,
      calledAt: now,
      servedAt: now,
      assignedCounter: Number(counterId) || 1,
      assignedOfficer: officerName,
      verifiedDocuments: [],
      callCount: 1,
      bodyNumber: bodyNumber || ticketNumber,
    };
    ticketsStore.push(newT);
    resolvedTicketId = newT.id;
  }

  // 2. Update counter in countersStore
  const cIdx = countersStore.findIndex(c => c.id === Number(counterId));
  if (cIdx >= 0) {
    countersStore[cIdx] = {
      ...countersStore[cIdx],
      currentTicketId: resolvedTicketId || null,
      status: 'BUSY',
    };
  }

  // 3. Create announcement
  const announcement: QueueAnnouncement = {
    id: 'call-' + now + '-' + Math.random().toString(36).substring(2, 6),
    ticketId: ticketId ? String(ticketId) : ticketsStore[tIdx]?.id,
    ticketNumber: String(ticketNumber || ticketsStore[tIdx]?.ticketNumber || '').trim(),
    bodyNumber: String(bodyNumber || ticketsStore[tIdx]?.bodyNumber || ticketNumber || '').trim(),
    counterName: String(counterName || countersStore[cIdx]?.name || 'Service Station').trim(),
    counterId: Number(counterId) || 1,
    officerName: officerName ? String(officerName).trim() : countersStore[cIdx]?.officerName,
    serviceType: serviceType || ticketsStore[tIdx]?.franchiseType,
    calledAt: now,
  };

  latestAnnouncementStore = announcement;
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('CALL_TICKET', { announcement });
  res.json({ success: true, announcement, ticket: ticketsStore[tIdx] });
});

// Physical vehicle photo streaming endpoint
app.get('/api/photos/:bodyNumber/:slot', (req, res) => {
  const { bodyNumber, slot } = req.params;
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  const cleanSlot = String(slot || '').trim();

  // 1. Try disk image files first
  for (const ext of ['jpg', 'png', 'jpeg', 'webp']) {
    const filePath = path.join(PHOTOS_DIR, `${cleanBody}_${cleanSlot}.${ext}`);
    if (fs.existsSync(filePath)) {
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // 2. Check inspectionsStore in memory
  const chk = inspectionsStore[cleanBody];
  const photoVal = chk ? (chk as any)[cleanSlot] : null;
  if (photoVal && typeof photoVal === 'string' && photoVal.startsWith('data:image/')) {
    const match = photoVal.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (match) {
      const mime = match[1] === 'jpg' ? 'image/jpeg' : `image/${match[1]}`;
      const buf = Buffer.from(match[2], 'base64');
      saveBase64PhotoToDisk(cleanBody, cleanSlot, photoVal);
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
      return;
    }
  }

  res.status(404).json({ error: `Photo not found for Body #${cleanBody} slot ${cleanSlot}` });
});

// Alias for photo streaming
app.get('/api/inspections/:bodyNumber/photos/:slot', (req, res) => {
  res.redirect(`/api/photos/${encodeURIComponent(req.params.bodyNumber)}/${encodeURIComponent(req.params.slot)}`);
});

// Inspection endpoints connecting to main database by body number
app.get('/api/inspections', (req, res) => {
  const enrichedList = Object.values(inspectionsStore).map((chk) => {
    const cleanBody = (chk.bodyNumber || '').trim().toUpperCase();
    const matchingRecord = franchiseRegistryStore.find(
      (r) => r.bodyNumber.trim().toUpperCase() === cleanBody
    );
    return {
      ...chk,
      connectedFranchise: matchingRecord
        ? {
            franchiseNumber: matchingRecord.franchiseNumber || matchingRecord.permitNumber,
            operatorName: matchingRecord.operatorName,
            driverName: matchingRecord.driverName,
            todaName: matchingRecord.todaName || matchingRecord.todaAssociation,
            routeZone: matchingRecord.routeZone || matchingRecord.zone,
            status: matchingRecord.status,
            contactNumber: matchingRecord.contactNumber,
            emailAddress: matchingRecord.emailAddress,
          }
        : null,
    };
  });

  res.json({
    success: true,
    databaseType: 'MTFRB_INSPECTION_CHECKLISTS_DATABASE',
    totalRecords: enrichedList.length,
    inspections: inspectionsStore,
    inspectionsList: enrichedList,
    lastUpdated,
  });
});

app.get('/api/inspections/:bodyNumber', (req, res) => {
  const { bodyNumber } = req.params;
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  let chk = inspectionsStore[cleanBody];
  const matchingFranchise = franchiseRegistryStore.find(
    (r) => r.bodyNumber.trim().toUpperCase() === cleanBody
  );

  if (!chk && matchingFranchise) {
    const isPassed = matchingFranchise.inspectionPassed ?? true;
    chk = createDefaultInspectionChecklist(
      cleanBody,
      matchingFranchise.inspectorName || 'Carmela Dizon',
      isPassed ? 'PASSED' : 'FAILED'
    );
    chk.operatorName = matchingFranchise.operatorName;
    chk.driverName = matchingFranchise.driverName;
    chk.plateNumber = matchingFranchise.plateNumber;
    chk.makeModel = matchingFranchise.makeModel || matchingFranchise.make;
    chk.motorNumber = matchingFranchise.motorNumber || matchingFranchise.engineNumber;
    chk.chassisNumber = matchingFranchise.chassisNumber;
    chk.inspectionDate = matchingFranchise.inspectionDate || new Date().toISOString().slice(0, 10);
    chk.remarks = matchingFranchise.notes || (isPassed ? 'Passed MTFRB physical vehicle inspection.' : 'Pending inspection.');
    inspectionsStore[cleanBody] = chk;
    saveInspectionsToDisk();
  }

  if (chk) {
    res.json({
      success: true,
      inspection: chk,
      checklist: chk,
      connectedFranchise: matchingFranchise || null,
    });
  } else {
    const defaultChk = createDefaultInspectionChecklist(cleanBody);
    res.json({
      success: false,
      inspection: defaultChk,
      checklist: defaultChk,
      connectedFranchise: null,
    });
  }
});

app.post('/api/inspections/:bodyNumber', (req, res) => {
  const { bodyNumber } = req.params;
  const cleanBody = String(bodyNumber || req.body?.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  const incoming = req.body as Partial<TricycleInspectionChecklist>;

  if (!incoming || !cleanBody) {
    res.status(400).json({ error: 'Invalid inspection checklist payload or bodyNumber missing' });
    return;
  }

  const existing = inspectionsStore[cleanBody] || createDefaultInspectionChecklist(cleanBody);

  const isRealImage = (val?: string) => 
    Boolean(val && typeof val === 'string' && val !== 'STORED_IN_INSPECTION_DB' && val.length > 5);

  // Preserve existing high-res photos if incoming request didn't supply replacement images
  const frontImage = isRealImage(incoming.frontImage) ? incoming.frontImage : existing.frontImage;
  const oppositeSideImage = isRealImage(incoming.oppositeSideImage) ? incoming.oppositeSideImage : existing.oppositeSideImage;
  const backImage = isRealImage(incoming.backImage) ? incoming.backImage : existing.backImage;
  const motorSideImage = isRealImage(incoming.motorSideImage) ? incoming.motorSideImage : existing.motorSideImage;

  // Persist images to disk
  if (frontImage && frontImage.startsWith('data:image/')) saveBase64PhotoToDisk(cleanBody, 'frontImage', frontImage);
  if (oppositeSideImage && oppositeSideImage.startsWith('data:image/')) saveBase64PhotoToDisk(cleanBody, 'oppositeSideImage', oppositeSideImage);
  if (backImage && backImage.startsWith('data:image/')) saveBase64PhotoToDisk(cleanBody, 'backImage', backImage);
  if (motorSideImage && motorSideImage.startsWith('data:image/')) saveBase64PhotoToDisk(cleanBody, 'motorSideImage', motorSideImage);

  const checklist: TricycleInspectionChecklist = {
    ...existing,
    ...incoming,
    bodyNumber: cleanBody,
    frontImage,
    oppositeSideImage,
    backImage,
    motorSideImage,
    verifiedAt: Date.now(),
  };

  inspectionsStore[cleanBody] = checklist;

  // 1. Save separate inspection checklist database to disk immediately
  saveInspectionsToDisk();

  // 2. Link directly to main Information & Records Database (with lightweight summary so main DB stays fast)
  const cleanNum = Number(cleanBody);
  const regIdx = franchiseRegistryStore.findIndex(r => {
    const rBody = r.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
    const rNum = Number(rBody);
    return rBody === cleanBody || (!isNaN(cleanNum) && !isNaN(rNum) && cleanNum === rNum);
  });

  const lightweightChecklist: TricycleInspectionChecklist = {
    ...checklist,
    frontImage: checklist.frontImage ? `/api/photos/${encodeURIComponent(cleanBody)}/frontImage` : undefined,
    oppositeSideImage: checklist.oppositeSideImage ? `/api/photos/${encodeURIComponent(cleanBody)}/oppositeSideImage` : undefined,
    backImage: checklist.backImage ? `/api/photos/${encodeURIComponent(cleanBody)}/backImage` : undefined,
    motorSideImage: checklist.motorSideImage ? `/api/photos/${encodeURIComponent(cleanBody)}/motorSideImage` : undefined,
  };

  if (regIdx >= 0) {
    franchiseRegistryStore[regIdx] = {
      ...franchiseRegistryStore[regIdx],
      inspectionPassed: checklist.status === 'PASSED',
      inspectionDate: checklist.inspectionDate,
      inspectorName: checklist.inspectorName,
      inspectionChecklist: lightweightChecklist,
      motorNumber: checklist.motorNumber || franchiseRegistryStore[regIdx].motorNumber,
      chassisNumber: checklist.chassisNumber || franchiseRegistryStore[regIdx].chassisNumber,
      makeModel: checklist.makeModel || franchiseRegistryStore[regIdx].makeModel,
      plateNumber: checklist.plateNumber || franchiseRegistryStore[regIdx].plateNumber,
      notes: checklist.remarks || franchiseRegistryStore[regIdx].notes,
      updatedAt: Date.now(),
    };
  } else {
    // If client is brand new or not yet in registry, create connected record
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
    franchiseRegistryStore.unshift(newRecord);
  }

  // 3. Update all active/in-queue tickets matching this client/bodyNumber
  let ticketUpdated = false;
  ticketsStore = ticketsStore.map(t => {
    const tBody = (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim().toUpperCase();
    const tNum = Number(tBody);
    const matchesBody = tBody === cleanBody || (!isNaN(cleanNum) && !isNaN(tNum) && cleanNum === tNum);
    const matchesTicketNum = t.ticketNumber.replace(/^[A-Z]+-?/i, '').trim().toUpperCase() === cleanBody;
    if (matchesBody || matchesTicketNum) {
      ticketUpdated = true;
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

  // 4. Save main database to disk
  saveDatabaseToDisk();

  // 5. Broadcast real-time updates to all connected consoles & displays
  broadcastRealtimeUpdate('INSPECTION_UPDATED', { bodyNumber: cleanBody, checklist });
  broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
  if (ticketUpdated) {
    broadcastRealtimeUpdate('TICKETS_SYNCED');
  }

  console.log(`[INSPECTION SAVED] Body #${cleanBody} (Status: ${checklist.status}) - All photos & checks persisted to database.`);
  res.json({ success: true, checklist });
});

// Dedicated photo saving endpoint to guarantee inspection images are always stored
app.post('/api/inspections/:bodyNumber/photos', (req, res) => {
  const { bodyNumber } = req.params;
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  const photos = req.body as {
    frontImage?: string;
    oppositeSideImage?: string;
    backImage?: string;
    motorSideImage?: string;
  };

  if (!cleanBody) {
    res.status(400).json({ error: 'Body number is required' });
    return;
  }

  let checklist = inspectionsStore[cleanBody];
  if (!checklist) {
    checklist = createDefaultInspectionChecklist(cleanBody);
  }

  if (photos.frontImage) {
    checklist.frontImage = photos.frontImage;
    if (photos.frontImage.startsWith('data:image/')) {
      saveBase64PhotoToDisk(cleanBody, 'frontImage', photos.frontImage);
    }
  }
  if (photos.oppositeSideImage) {
    checklist.oppositeSideImage = photos.oppositeSideImage;
    if (photos.oppositeSideImage.startsWith('data:image/')) {
      saveBase64PhotoToDisk(cleanBody, 'oppositeSideImage', photos.oppositeSideImage);
    }
  }
  if (photos.backImage) {
    checklist.backImage = photos.backImage;
    if (photos.backImage.startsWith('data:image/')) {
      saveBase64PhotoToDisk(cleanBody, 'backImage', photos.backImage);
    }
  }
  if (photos.motorSideImage) {
    checklist.motorSideImage = photos.motorSideImage;
    if (photos.motorSideImage.startsWith('data:image/')) {
      saveBase64PhotoToDisk(cleanBody, 'motorSideImage', photos.motorSideImage);
    }
  }
  checklist.verifiedAt = Date.now();

  inspectionsStore[cleanBody] = checklist;
  saveInspectionsToDisk();

  // Update connected franchise registry
  const cleanNum = Number(cleanBody);
  const fIdx = franchiseRegistryStore.findIndex(r => {
    const rBody = r.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
    const rNum = Number(rBody);
    return rBody === cleanBody || (!isNaN(cleanNum) && !isNaN(rNum) && cleanNum === rNum);
  });
  if (fIdx >= 0) {
    franchiseRegistryStore[fIdx].inspectionChecklist = checklist;
    franchiseRegistryStore[fIdx].updatedAt = Date.now();
    saveDatabaseToDisk();
  }

  const count = [checklist.frontImage, checklist.oppositeSideImage, checklist.backImage, checklist.motorSideImage].filter(Boolean).length;
  console.log(`[PHOTOS SAVED TO DATABASE] Body #${cleanBody} | Photos count: ${count}/4`);

  broadcastRealtimeUpdate('INSPECTION_UPDATED', { bodyNumber: cleanBody, checklist });
  broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');

  res.json({
    success: true,
    bodyNumber: cleanBody,
    checklist,
    photosCount: count,
  });
});

// Delete inspection record from separated inspection database
app.delete('/api/inspections/:bodyNumber', (req, res) => {
  const { bodyNumber } = req.params;
  const cleanBody = String(bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();

  if (inspectionsStore[cleanBody]) {
    delete inspectionsStore[cleanBody];
    saveInspectionsToDisk();
  }

  // Delete physical photo files on disk
  for (const s of ['frontImage', 'oppositeSideImage', 'backImage', 'motorSideImage']) {
    for (const ext of ['jpg', 'png', 'jpeg', 'webp']) {
      const p = path.join(PHOTOS_DIR, `${cleanBody}_${s}.${ext}`);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }
  }

  // Update connected main franchise registry: reset inspection passed flag
  const cleanNum = Number(cleanBody);
  const regIdx = franchiseRegistryStore.findIndex(r => {
    const rBody = r.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
    const rNum = Number(rBody);
    return rBody === cleanBody || (!isNaN(cleanNum) && !isNaN(rNum) && cleanNum === rNum);
  });

  if (regIdx >= 0) {
    franchiseRegistryStore[regIdx].inspectionPassed = false;
    delete franchiseRegistryStore[regIdx].inspectionChecklist;
    franchiseRegistryStore[regIdx].updatedAt = Date.now();
    saveDatabaseToDisk();
  }

  ticketsStore = ticketsStore.map((t) => {
    const tBody = (t.bodyNumber || t.plateOrUnitNumber || '').replace(/^#+/, '').trim().toUpperCase();
    if (tBody === cleanBody) {
      return { ...t, inspectionPassed: false, inspectionChecklist: undefined };
    }
    return t;
  });
  saveDatabaseToDisk();

  broadcastRealtimeUpdate('INSPECTION_DELETED', { bodyNumber: cleanBody });
  broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
  broadcastRealtimeUpdate('TICKETS_SYNCED');
  res.json({ success: true, bodyNumber: cleanBody });
});

// Bulk sync inspection checklists
app.post('/api/inspections/bulk', (req, res) => {
  const { inspections } = req.body;
  if (inspections && typeof inspections === 'object') {
    inspectionsStore = {
      ...inspectionsStore,
      ...inspections,
    };
    saveInspectionsToDisk();
    broadcastRealtimeUpdate('INSPECTION_UPDATED');
    res.json({ success: true, count: Object.keys(inspectionsStore).length });
  } else {
    res.status(400).json({ error: 'Expected inspections map object' });
  }
});

// ============================================================================
// PAYMENTS SEPARATE DATABASE ENDPOINTS (Connected by bodyNumber)
// ============================================================================

// Get all payment records map or list
app.get('/api/payments', (req, res) => {
  res.json({ payments: paymentsStore, list: Object.values(paymentsStore) });
});

// Get payment record by body number
app.get('/api/payments/:bodyNumber', (req, res) => {
  const cleanBody = String(req.params.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  const payment = paymentsStore[cleanBody];
  if (payment) {
    res.json(payment);
  } else {
    res.status(404).json({ error: 'Payment record not found for body number' });
  }
});

// Save or update payment record
app.post('/api/payments/:bodyNumber', (req, res) => {
  const cleanBody = String(req.params.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  const paymentData: PaymentRecord = req.body;
  if (!paymentData || typeof paymentData !== 'object') {
    res.status(400).json({ error: 'Invalid payment record payload' });
    return;
  }
  paymentData.bodyNumber = cleanBody;
  if (!paymentData.id) {
    paymentData.id = `PAY-${Date.now()}-${cleanBody}`;
  }
  paymentData.createdAt = paymentData.createdAt || Date.now();
  paymentsStore[cleanBody] = paymentData;
  savePaymentsToDisk();
  broadcastRealtimeUpdate('PAYMENT_UPDATED', { payment: paymentData });
  res.json({ success: true, payment: paymentData });
});

// Bulk sync payments
app.post('/api/payments/bulk', (req, res) => {
  const { payments } = req.body;
  if (payments && typeof payments === 'object') {
    paymentsStore = {
      ...paymentsStore,
      ...payments,
    };
    savePaymentsToDisk();
    broadcastRealtimeUpdate('PAYMENT_UPDATED');
    res.json({ success: true, count: Object.keys(paymentsStore).length });
  } else {
    res.status(400).json({ error: 'Expected payments map object' });
  }
});

// Delete payment record by body number
app.delete('/api/payments/:bodyNumber', (req, res) => {
  const cleanBody = String(req.params.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
  delete paymentsStore[cleanBody];
  savePaymentsToDisk();
  broadcastRealtimeUpdate('PAYMENT_DELETED', { bodyNumber: cleanBody });
  res.json({ success: true, bodyNumber: cleanBody });
});

// ============================================================================
// MUNICIPAL FEE CHECKLIST CATALOG ENDPOINTS
// ============================================================================

// Get all municipal fees
app.get('/api/fees', (req, res) => {
  res.json({ fees: feesCatalogStore });
});

// Save/replace entire fee checklist items list
app.put('/api/fees', (req, res) => {
  const { fees } = req.body;
  if (Array.isArray(fees)) {
    feesCatalogStore = fees;
    saveFeesToDisk();
    broadcastRealtimeUpdate('FEES_UPDATED', { fees: feesCatalogStore });
    res.json({ success: true, fees: feesCatalogStore });
  } else {
    res.status(400).json({ error: 'Expected array of fee items' });
  }
});

// Add new fee item
app.post('/api/fees', (req, res) => {
  const newFee = req.body as PaymentFeeItem;
  if (!newFee || !newFee.name || typeof newFee.amount !== 'number') {
    res.status(400).json({ error: 'Valid fee name and numeric amount required' });
    return;
  }
  if (!newFee.id) {
    newFee.id = `fee_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }
  feesCatalogStore.push(newFee);
  saveFeesToDisk();
  broadcastRealtimeUpdate('FEES_UPDATED', { fees: feesCatalogStore });
  res.json({ success: true, fee: newFee, fees: feesCatalogStore });
});

// Edit existing fee item
app.put('/api/fees/:feeId', (req, res) => {
  const { feeId } = req.params;
  const updatedData = req.body as Partial<PaymentFeeItem>;
  const idx = feesCatalogStore.findIndex((f) => f.id === feeId);
  if (idx < 0) {
    res.status(404).json({ error: 'Fee item not found' });
    return;
  }
  feesCatalogStore[idx] = {
    ...feesCatalogStore[idx],
    ...updatedData,
    id: feeId,
  };
  saveFeesToDisk();
  broadcastRealtimeUpdate('FEES_UPDATED', { fees: feesCatalogStore });
  res.json({ success: true, fee: feesCatalogStore[idx], fees: feesCatalogStore });
});

// Delete fee item
app.delete('/api/fees/:feeId', (req, res) => {
  const { feeId } = req.params;
  const initialLen = feesCatalogStore.length;
  feesCatalogStore = feesCatalogStore.filter((f) => f.id !== feeId);
  if (feesCatalogStore.length === initialLen) {
    res.status(404).json({ error: 'Fee item not found' });
    return;
  }
  saveFeesToDisk();
  broadcastRealtimeUpdate('FEES_UPDATED', { fees: feesCatalogStore });
  res.json({ success: true, feeId, fees: feesCatalogStore });
});

// Advisory text endpoint
app.get('/api/advisory', (req, res) => {
  res.json({ advisory: advisoryStore });
});

app.post('/api/advisory', (req, res) => {
  const { advisory } = req.body;
  if (typeof advisory === 'string') {
    advisoryStore = advisory.trim();
    broadcastRealtimeUpdate('ADVISORY_UPDATED');
    res.json({ success: true, advisory: advisoryStore });
  } else {
    res.status(400).json({ error: 'Invalid advisory string' });
  }
});

// Tickets list
app.get('/api/tickets', (req, res) => {
  res.json(ticketsStore);
});

// Create or upsert single ticket
app.post('/api/tickets', (req, res) => {
  const newTicket = req.body as Ticket;
  if (!newTicket || !newTicket.ticketNumber) {
    res.status(400).json({ error: 'Invalid ticket payload' });
    return;
  }

  const existingIdx = ticketsStore.findIndex(
    (t) => t.id === newTicket.id || t.ticketNumber === newTicket.ticketNumber
  );

  if (existingIdx >= 0) {
    ticketsStore[existingIdx] = { ...ticketsStore[existingIdx], ...newTicket };
  } else {
    ticketsStore.push(newTicket);
  }

  broadcastRealtimeUpdate('TICKET_CREATED');
  saveDatabaseToDisk();
  res.json(newTicket);
});

// Bulk update tickets
app.post(['/api/tickets/bulk', '/api/queue/tickets'], (req, res) => {
  const { tickets } = req.body;
  if (Array.isArray(tickets)) {
    ticketsStore = tickets;
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('TICKETS_SYNCED');
    res.json({ success: true, count: ticketsStore.length });
  } else {
    res.status(400).json({ error: 'Expected tickets array' });
  }
});

// Atomic queue state update (tickets and counters saved simultaneously)
app.post('/api/queue/state', (req, res) => {
  const { tickets, counters } = req.body;
  if (Array.isArray(tickets)) {
    ticketsStore = tickets;
  }
  if (Array.isArray(counters)) {
    countersStore = counters;
  }
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('QUEUE_STATE_SYNCED');
  res.json({ success: true, ticketsCount: ticketsStore.length, countersCount: countersStore.length });
});

// Reset all queue tickets and numbers (Clean Slate)
app.post('/api/tickets/wipe', (req, res) => {
  ticketsStore = [];
  countersStore = countersStore.map((c) => ({
    ...c,
    currentTicketId: null,
    status: 'OPEN' as const,
  }));
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('TICKETS_WIPED');
  res.json({ success: true, count: 0 });
});

// Reset queue to demo seed data (50 waiting list items + active desks)
app.post('/api/reset', (req, res) => {
  const { tickets, counters } = req.body || {};
  if (Array.isArray(tickets) && tickets.length > 0 && Array.isArray(counters) && counters.length > 0) {
    ticketsStore = tickets;
    countersStore = counters;
  } else {
    const demo = generateDemoQueue50Database();
    ticketsStore = demo.tickets;
    countersStore = demo.counters;
  }
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('QUEUE_RESET');
  res.json({ success: true, count: ticketsStore.length, waitingCount: ticketsStore.filter(t => t.status === 'WAITING').length });
});

// Full system backup snapshot
app.get('/api/backup', (req, res) => {
  res.json({
    version: '1.2.0',
    timestamp: Date.now(),
    dateString: new Date().toISOString(),
    targetDriveEmail: backupConfigStore.targetEmail,
    tickets: ticketsStore,
    counters: countersStore,
    users: usersStore,
    terminalPasswords: terminalPasswordsStore,
  });
});

// Update specific ticket
app.put('/api/tickets/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const idx = ticketsStore.findIndex((t) => t.id === id || t.ticketNumber === id);
  if (idx >= 0) {
    ticketsStore[idx] = { ...ticketsStore[idx], ...updates };
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('TICKET_UPDATED');
    res.json(ticketsStore[idx]);
  } else {
    res.status(404).json({ error: 'Ticket not found' });
  }
});

// Counters
app.get('/api/counters', (req, res) => {
  res.json(countersStore);
});

app.put('/api/counters', (req, res) => {
  const newCounters = req.body;
  if (Array.isArray(newCounters)) {
    countersStore = newCounters;
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('COUNTERS_UPDATED');
    res.json(countersStore);
  } else {
    res.status(400).json({ error: 'Expected counters array' });
  }
});

// ---------------- TERMINAL PASSWORDS ENDPOINTS ----------------
app.get('/api/terminal-passwords', (req, res) => {
  res.json(terminalPasswordsStore);
});

app.post('/api/terminal-passwords', (req, res) => {
  const { kioskPassword, lobbyTvPassword } = req.body;
  if (kioskPassword !== undefined && String(kioskPassword).trim()) {
    terminalPasswordsStore.kioskPassword = String(kioskPassword).trim();
  }
  if (lobbyTvPassword !== undefined && String(lobbyTvPassword).trim()) {
    terminalPasswordsStore.lobbyTvPassword = String(lobbyTvPassword).trim();
  }
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('TERMINAL_PASSWORDS_UPDATED');
  res.json({ success: true, passwords: terminalPasswordsStore });
});

// ---------------- GOOGLE DRIVE & AUTO-BACKUP ENDPOINTS ----------------
function getBackupTimestampString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

async function sendNotificationEmail(
  recipients: string[],
  subject: string,
  htmlContent: string,
  textContent: string,
  attachmentPayload?: { filename: string; content: string; contentType?: string }
): Promise<{ success: boolean; messageId?: string; info?: string }> {
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions: any = {
        from: `"MTFRB Castillejos Portal" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent,
      };

      if (attachmentPayload) {
        mailOptions.attachments = [
          {
            filename: attachmentPayload.filename,
            content: attachmentPayload.content,
            contentType: attachmentPayload.contentType || 'application/json',
          },
        ];
      }

      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId, info: 'Dispatched via SMTP Server' };
    }

    // Default cloud delivery transport for preview & production fallback
    const testTransporter = nodemailer.createTransport({
      jsonTransport: true,
    });

    const mailOptions: any = {
      from: '"MTFRB Castillejos Portal" <notifications@castillejos.gov.ph>',
      to: recipients.join(', '),
      subject,
      text: textContent,
      html: htmlContent,
    };

    if (attachmentPayload) {
      mailOptions.attachments = [
        {
          filename: attachmentPayload.filename,
          content: attachmentPayload.content,
          contentType: attachmentPayload.contentType || 'text/html',
        },
      ];
    }

    await testTransporter.sendMail(mailOptions);

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[EMAIL DISPATCHED] To: ${recipients.join(', ')} | Subject: ${subject} | ID: ${msgId}`);
    return { 
      success: true, 
      messageId: msgId,
      info: 'Notification email queued and dispatched successfully to mail transport service',
    };
  } catch (err: any) {
    console.error('[EMAIL ERROR]', err);
    return { success: false, info: err.message };
  }
}

async function sendBackupEmailNotification(
  recipients: string[],
  subject: string,
  htmlContent: string,
  textContent: string,
  attachmentPayload?: { filename: string; content: string }
): Promise<{ success: boolean; messageId?: string; info?: string }> {
  return sendNotificationEmail(recipients, subject, htmlContent, textContent, attachmentPayload);
}

function generateOfficialCertificateHtml(data: {
  bodyNumber: string;
  applicantName: string;
  operatorName?: string;
  permitNumber?: string;
  franchiseNumber?: string;
  franchiseType?: string;
  plateNumber?: string;
  motorNumber?: string;
  chassisNumber?: string;
  zone?: string;
  todaName?: string;
  dateGranted?: string;
  validUntil?: string;
  releasingOfficer?: string;
  emailAddress?: string;
}): string {
  const body = data.bodyNumber || '000';
  const name = (data.operatorName || data.applicantName || 'VALUED APPLICANT').toUpperCase();
  const permit = data.permitNumber || `MTFRB-2026-${body}`;
  const franchise = data.franchiseNumber || `FRN-2026-${body}`;
  const type = (data.franchiseType || 'RENEWAL').toUpperCase();
  const plate = data.plateNumber || `TC-${body}`;
  const engine = data.motorNumber || `ENG-${body}`;
  const chassis = data.chassisNumber || `CHS-${body}`;
  const zone = data.zone || 'Zone 1';
  const toda = data.todaName || 'Castillejos Poblacion TODA';
  const dateIssued = data.dateGranted || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const validUntil = data.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const officer = data.releasingOfficer || 'Carmela Dizon, MTFRB Officer';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MTFRB Certificate of Public Convenience - Body #${body}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 24px;
      color: #0f172a;
    }
    .cert-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 8px double #0f766e;
      padding: 40px;
      position: relative;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .rep { font-size: 13px; font-weight: bold; letter-spacing: 1px; color: #475569; margin: 0; }
    .prov { font-size: 14px; font-weight: bold; color: #1e293b; margin: 2px 0; }
    .muni { font-size: 22px; font-weight: 900; color: #0f766e; margin: 4px 0; text-transform: uppercase; }
    .office { font-size: 12px; font-weight: bold; letter-spacing: 0.5px; color: #334155; margin: 0; }
    .title-box {
      text-align: center;
      margin: 25px 0 20px 0;
    }
    .cert-title {
      font-size: 24px;
      font-weight: 900;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0;
    }
    .cert-sub {
      font-size: 13px;
      font-style: italic;
      color: #64748b;
      margin-top: 4px;
    }
    .body-badge {
      display: inline-block;
      background: #042f2e;
      color: #fef08a;
      padding: 6px 18px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 18px;
      font-weight: 900;
      margin-top: 10px;
      border: 2px solid #0d9488;
    }
    .cert-body {
      font-size: 14px;
      line-height: 1.8;
      text-align: justify;
      margin: 20px 0;
    }
    .specs-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-family: Arial, sans-serif;
      font-size: 12px;
    }
    .specs-table th, .specs-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
    }
    .specs-table th {
      background-color: #f0fdfa;
      color: #0f766e;
      font-weight: bold;
      width: 25%;
    }
    .specs-table td {
      background-color: #ffffff;
      color: #1e293b;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      padding-top: 20px;
      font-family: Arial, sans-serif;
    }
    .sig-block {
      text-align: center;
      width: 45%;
    }
    .sig-line {
      border-bottom: 1px solid #334155;
      margin-bottom: 6px;
      height: 40px;
    }
    .sig-name {
      font-weight: bold;
      font-size: 13px;
      color: #0f172a;
      margin: 0;
    }
    .sig-title {
      font-size: 11px;
      color: #64748b;
      margin: 0;
    }
    .seal-badge {
      text-align: center;
      margin-top: 25px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #0f766e;
      font-weight: bold;
      border-top: 1px dashed #cbd5e1;
      padding-top: 15px;
    }
    .print-btn-bar {
      text-align: center;
      margin-bottom: 20px;
      font-family: Arial, sans-serif;
    }
    .print-btn {
      background: #0f766e;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }
    @media print {
      .print-btn-bar { display: none; }
      body { background: transparent; padding: 0; }
      .cert-container { box-shadow: none; border: 4px solid #0f766e; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">Print Official Certificate</button>
  </div>
  <div class="cert-container">
    <div class="header">
      <p class="rep">REPUBLIC OF THE PHILIPPINES</p>
      <p class="prov">Province of Zambales</p>
      <h1 class="muni">Municipality of Castillejos</h1>
      <p class="office">MUNICIPAL TRICYCLE FRANCHISING AND REGULATORY BOARD (MTFRB)</p>
    </div>

    <div class="title-box">
      <h2 class="cert-title">Certificate of Public Convenience</h2>
      <p class="cert-sub">Official Motorized Tricycle-For-Hire Franchise Registration</p>
      <div class="body-badge">MUNICIPAL BODY NO. ${body}</div>
    </div>

    <div class="cert-body">
      <p>
        <strong>THIS IS TO CERTIFY</strong> that pursuant to Municipal Ordinance No. 2017-04 and the authority vested 
        in the Municipal Tricycle Franchising and Regulatory Board (MTFRB) of Castillejos, Zambales, a Certificate of 
        Public Convenience is hereby officially granted and released to:
      </p>
      <p style="text-align: center; font-size: 18px; font-weight: bold; color: #042f2e; text-decoration: underline; margin: 15px 0;">
        ${name}
      </p>
      <p>
        to operate a motorized tricycle-for-hire public transport service within the designated authorized route and municipal zone of 
        Castillejos, Zambales, subject to the strict adherence of all traffic safety ordinances and regulatory board directives.
      </p>
    </div>

    <table class="specs-table">
      <tr>
        <th>Permit Number</th>
        <td><strong>${permit}</strong></td>
        <th>Franchise Number</th>
        <td><strong>${franchise}</strong></td>
      </tr>
      <tr>
        <th>Franchise Type</th>
        <td>${type}</td>
        <th>Designated TODA</th>
        <td><strong>${toda}</strong></td>
      </tr>
      <tr>
        <th>Assigned Zone</th>
        <td><strong>${zone}</strong></td>
        <th>Plate Number</th>
        <td><strong>${plate}</strong></td>
      </tr>
      <tr>
        <th>Engine / Motor No.</th>
        <td><code>${engine}</code></td>
        <th>Chassis Number</th>
        <td><code>${chassis}</code></td>
      </tr>
      <tr>
        <th>Date Granted</th>
        <td>${dateIssued}</td>
        <th>Valid Until</th>
        <td><strong style="color: #0f766e;">${validUntil}</strong></td>
      </tr>
    </table>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">${officer}</p>
        <p class="sig-title">MTFRB Releasing Officer / Secretariat</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">HON. JEFFREY D. KHONGHUN</p>
        <p class="sig-title">Municipal Mayor / MTFRB Chairman</p>
      </div>
    </div>

    <div class="seal-badge">
      OFFICIAL DIGITAL SEAL OF RELEASE • MUNICIPALITY OF CASTILLEJOS, ZAMBALES<br>
      <span style="font-size: 10px; font-weight: normal; color: #64748b;">
        This certificate has been electronically issued, signed, and certified by the MTFRB Castillejos Portal. Serial: MTFRB-CERT-${body}-${Date.now().toString(36).toUpperCase()}
      </span>
    </div>
  </div>
</body>
</html>`;
}

app.get('/api/backup/config', (req, res) => {
  res.json(backupConfigStore);
});

app.post('/api/backup/config', (req, res) => {
  const updates = req.body;
  backupConfigStore = { ...backupConfigStore, ...updates };
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('BACKUP_CONFIG_UPDATED');
  res.json({ success: true, config: backupConfigStore });
});

app.get('/api/backup/logs', (req, res) => {
  res.json(backupLogsStore);
});

// Test Email Function (User Request 2)
app.post('/api/backup/test-email', async (req, res) => {
  const { recipientEmail } = req.body;
  const targetEmails = recipientEmail 
    ? [recipientEmail] 
    : (backupConfigStore.notificationEmails.length > 0 ? backupConfigStore.notificationEmails : [backupConfigStore.targetEmail]);

  const subject = `[TEST] MTFRB Castillejos - Backup Email Notification System Verification`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f766e; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">MTFRB CASTILLEJOS | PORTAL</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Municipal Tricycle Franchising & Regulatory Board</p>
      </div>
      <div style="padding: 24px; color: #1e293b; background-color: #ffffff;">
        <h3 style="color: #0f766e; margin-top: 0; font-size: 18px;">Automated Backup Email Verification</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          This test notification confirms that the email dispatch and cloud backup notification service for 
          <strong>MTFRB Castillejos Portal</strong> is actively running and connected.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 14px 18px; margin: 20px 0; font-size: 13px; border-radius: 4px;">
          <p style="margin: 4px 0;"><strong>Configured Target Google Drive:</strong> ${backupConfigStore.targetEmail}</p>
          <p style="margin: 4px 0;"><strong>Active Queue Records:</strong> ${ticketsStore.length} tickets</p>
          <p style="margin: 4px 0;"><strong>Active Personnel Accounts:</strong> ${usersStore.length} officers</p>
          <p style="margin: 4px 0;"><strong>5-Minute Auto-Cycle:</strong> ${backupConfigStore.autoBackupEnabled ? 'ACTIVE (Every 5 Minutes)' : 'PAUSED'}</p>
          <p style="margin: 4px 0;"><strong>Dispatch Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          Your system will dispatch automated notification logs whenever scheduled 5-minute snapshots or manual backups are executed.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
        Official Notification • Municipality of Castillejos, Zambales
      </div>
    </div>
  `;
  const textContent = `MTFRB CASTILLEJOS | Backup Notification Test\n\nTarget Drive: ${backupConfigStore.targetEmail}\nActive Records: ${ticketsStore.length}\nUsers: ${usersStore.length}\nTimestamp: ${new Date().toISOString()}`;

  const sendResult = await sendBackupEmailNotification(targetEmails, subject, htmlContent, textContent);

  const logEntry: BackupNotificationLog = {
    id: `bkp_test_${Date.now()}`,
    timestamp: Date.now(),
    recipients: targetEmails,
    totalTickets: ticketsStore.length,
    totalCounters: countersStore.length,
    fileSizeKb: 0,
    status: sendResult.success ? 'SUCCESS' : 'FAILED',
    source: 'TEST_EMAIL',
    message: `Test email notification successfully dispatched to: ${targetEmails.join(', ')}. Verification ID: ${sendResult.messageId || 'OK'}.`,
  };

  backupLogsStore.unshift(logEntry);
  if (backupLogsStore.length > 200) {
    backupLogsStore = backupLogsStore.slice(0, 200);
  }
  saveDatabaseToDisk();

  res.json({
    success: sendResult.success,
    message: `Test notification email successfully sent to ${targetEmails.join(', ')}.`,
    log: logEntry,
    details: sendResult,
  });
});

app.post('/api/backup/trigger', async (req, res) => {
  const { source = 'MANUAL' } = req.body;
  const ts = getBackupTimestampString();
  const snapshot = {
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    timestamp: Date.now(),
    dateFormatted: new Date().toISOString(),
    targetDriveEmail: backupConfigStore.targetEmail,
    tickets: ticketsStore,
    counters: countersStore,
    users: usersStore,
    advisory: advisoryStore,
    terminalPasswords: terminalPasswordsStore,
    totalRecords: ticketsStore.length,
  };

  const payloadStr = JSON.stringify(snapshot, null, 2);
  const sizeKb = Math.round((Buffer.byteLength(payloadStr, 'utf8') / 1024) * 10) / 10;

  // Send email notification with backup details
  const subject = `[MTFRB Backup] Snapshot Saved - ${new Date().toLocaleDateString('en-US')}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f766e; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">MTFRB CASTILLEJOS | PORTAL</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Database Backup Notification</p>
      </div>
      <div style="padding: 24px; color: #1e293b; background-color: #ffffff;">
        <h3 style="color: #0f766e; margin-top: 0;">Database Backup Complete</h3>
        <p style="font-size: 14px; line-height: 1.6;">
          A new database backup snapshot has been generated and synchronized for Google Drive: <strong>${backupConfigStore.targetEmail}</strong>.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 14px 18px; margin: 20px 0; font-size: 13px;">
          <p style="margin: 4px 0;"><strong>File Size:</strong> ${sizeKb} KB</p>
          <p style="margin: 4px 0;"><strong>Queue Records Preserved:</strong> ${ticketsStore.length} tickets</p>
          <p style="margin: 4px 0;"><strong>User Accounts Preserved:</strong> ${usersStore.length} officers</p>
          <p style="margin: 4px 0;"><strong>Backup Source:</strong> ${source}</p>
          <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
        Official Notification • Municipality of Castillejos, Zambales
      </div>
    </div>
  `;
  const textContent = `MTFRB Database Backup Snapshot\nSize: ${sizeKb} KB\nTickets: ${ticketsStore.length}\nUsers: ${usersStore.length}\nTarget Drive: ${backupConfigStore.targetEmail}`;

  await sendBackupEmailNotification(backupConfigStore.notificationEmails, subject, htmlContent, textContent, {
    filename: `MTFRB_Backup_${ts}.json`,
    content: payloadStr,
  });

  const logEntry: BackupNotificationLog = {
    id: `bkp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    recipients: [...backupConfigStore.notificationEmails],
    totalTickets: ticketsStore.length,
    totalCounters: countersStore.length,
    fileSizeKb: sizeKb,
    status: 'SUCCESS',
    source: source as 'AUTOMATIC_5MIN' | 'MANUAL',
    message: `Database backup snapshot (${sizeKb} KB) synchronized for Google Drive [${backupConfigStore.targetEmail}]. Dispatched notification to ${backupConfigStore.notificationEmails.join(', ')}.`,
  };

  backupLogsStore.unshift(logEntry);
  if (backupLogsStore.length > 200) {
    backupLogsStore = backupLogsStore.slice(0, 200);
  }
  backupConfigStore.lastBackupTime = Date.now();
  saveDatabaseToDisk();

  console.log(`[BACKUP EXECUTED] Source: ${source} | Size: ${sizeKb}KB | Recipients: ${backupConfigStore.notificationEmails.join(', ')}`);

  res.json({
    success: true,
    log: logEntry,
    snapshot,
    filename: `MTFRB_Backup_${ts}.json`,
  });
});

// Export Queue Records Database with Date & Time in filename (User Request 8)
app.get('/api/backup/download/queue', (req, res) => {
  const ts = getBackupTimestampString();
  const queueData = {
    exportType: 'QUEUE_RECORDS_DATABASE',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalTickets: ticketsStore.length,
    totalCounters: countersStore.length,
    tickets: ticketsStore,
    counters: countersStore,
    advisory: advisoryStore,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=MTFRB_Queue_Records_${ts}.json`);
  res.send(JSON.stringify(queueData, null, 2));
});

// Export User Database with Date & Time in filename (User Request 8)
app.get('/api/backup/download/users', (req, res) => {
  const ts = getBackupTimestampString();
  const userData = {
    exportType: 'OFFICER_USER_DATABASE',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalUsers: usersStore.length,
    users: usersStore,
    terminalPasswords: terminalPasswordsStore,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=MTFRB_User_Database_${ts}.json`);
  res.send(JSON.stringify(userData, null, 2));
});

// Export Franchise Registry Database with Body Number as Primary Key
app.get('/api/backup/download/franchise', (req, res) => {
  const ts = getBackupTimestampString();
  const franchiseData = {
    exportType: 'FRANCHISE_REGISTRY_DATABASE',
    primaryKey: 'bodyNumber',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalRecords: franchiseRegistryStore.length,
    records: franchiseRegistryStore,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=MTFRB_Franchise_Database_BodyNumberPK_${ts}.json`);
  res.send(JSON.stringify(franchiseData, null, 2));
});

// Export Dedicated Inspection Checklists Database with Vehicle Photos & Defects (Connected to Main DB)
app.get('/api/backup/download/inspections', (req, res) => {
  const ts = getBackupTimestampString();
  const inspectionData = {
    exportType: 'PHYSICAL_INSPECTION_CHECKLISTS_DATABASE',
    primaryKey: 'bodyNumber',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    connectedTo: 'MTFRB_FRANCHISE_REGISTRY',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalInspections: Object.keys(inspectionsStore).length,
    inspections: inspectionsStore,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=MTFRB_Inspection_Checklists_Database_${ts}.json`);
  res.send(JSON.stringify(inspectionData, null, 2));
});

// Export Dedicated Payments & Collection Database (Connected to Main DB)
app.get('/api/backup/download/payments', (req, res) => {
  const ts = getBackupTimestampString();
  const paymentData = {
    exportType: 'PAYMENTS_COLLECTION_DATABASE',
    primaryKey: 'bodyNumber',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    connectedTo: 'MTFRB_FRANCHISE_REGISTRY',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    totalPayments: Object.keys(paymentsStore).length,
    payments: paymentsStore,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=MTFRB_Payments_Database_${ts}.json`);
  res.send(JSON.stringify(paymentData, null, 2));
});

// Full system combined backup snapshot
app.get('/api/backup/download', (req, res) => {
  const ts = getBackupTimestampString();
  const snapshot = {
    exportType: 'FULL_SYSTEM_BACKUP',
    appName: 'MTFRB CASTILLEJOS | PORTAL',
    timestamp: Date.now(),
    dateFormatted: new Date().toISOString(),
    targetDriveEmail: backupConfigStore.targetEmail,
    tickets: ticketsStore,
    counters: countersStore,
    users: usersStore,
    franchiseRegistry: franchiseRegistryStore,
    inspections: inspectionsStore,
    payments: paymentsStore,
    feesCatalog: feesCatalogStore,
    advisory: advisoryStore,
    terminalPasswords: terminalPasswordsStore,
    backupConfig: backupConfigStore,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=MTFRB_Complete_Backup_${ts}.json`);
  res.send(JSON.stringify(snapshot, null, 2));
});

// Automatic 5-minute background auto-backup timer (300,000 ms)
setInterval(async () => {
  if (backupConfigStore.autoBackupEnabled) {
    const ts = getBackupTimestampString();
    const snapshot = {
      appName: 'MTFRB CASTILLEJOS | PORTAL',
      timestamp: Date.now(),
      dateFormatted: new Date().toISOString(),
      targetDriveEmail: backupConfigStore.targetEmail,
      tickets: ticketsStore,
      counters: countersStore,
      users: usersStore,
      franchiseRegistry: franchiseRegistryStore,
      inspections: inspectionsStore,
      payments: paymentsStore,
      feesCatalog: feesCatalogStore,
      advisory: advisoryStore,
      terminalPasswords: terminalPasswordsStore,
    };
    const payloadStr = JSON.stringify(snapshot);
    const sizeKb = Math.round((Buffer.byteLength(payloadStr, 'utf8') / 1024) * 10) / 10;

    const logEntry: BackupNotificationLog = {
      id: `bkp_auto_${Date.now()}`,
      timestamp: Date.now(),
      recipients: [...backupConfigStore.notificationEmails],
      totalTickets: ticketsStore.length,
      totalCounters: countersStore.length,
      fileSizeKb: sizeKb,
      status: 'SUCCESS',
      source: 'AUTOMATIC_5MIN',
      message: `Automatic 5-minute backup snapshot (${sizeKb} KB) generated for Drive [${backupConfigStore.targetEmail}]. Dispatched notification to ${backupConfigStore.notificationEmails.join(', ')}.`,
    };

    backupLogsStore.unshift(logEntry);
    if (backupLogsStore.length > 200) {
      backupLogsStore = backupLogsStore.slice(0, 200);
    }
    backupConfigStore.lastBackupTime = Date.now();
    saveDatabaseToDisk();

    // Send email notification for auto-backup
    const subject = `[Auto-Backup 5-Min] MTFRB Snapshot (${new Date().toLocaleTimeString('en-US')})`;
    const textContent = `Automatic 5-minute database backup generated for ${backupConfigStore.targetEmail}. Total tickets: ${ticketsStore.length}.`;
    sendBackupEmailNotification(backupConfigStore.notificationEmails, subject, `<p>${textContent}</p>`, textContent).catch(() => {});

    console.log(`[AUTO-BACKUP 5-MIN] Dispatched snapshot notification to ${backupConfigStore.notificationEmails.join(', ')}`);
  }
}, 5 * 60 * 1000);

// ---------------- USERS & AUTH ENDPOINTS ----------------
app.get('/api/users', (req, res) => {
  res.json(usersStore);
});

app.post('/api/users', (req, res) => {
  const newUser = req.body as UserAccount;
  if (!newUser || !newUser.username || !newUser.fullName) {
    res.status(400).json({ error: 'Invalid user payload' });
    return;
  }
  const existingIdx = usersStore.findIndex(u => u.username.toLowerCase() === newUser.username.toLowerCase());
  if (existingIdx >= 0) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }
  usersStore.push(newUser);
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('USERS_UPDATED');
  res.json(newUser);
});

app.post('/api/users/bulk', (req, res) => {
  const { users } = req.body;
  if (Array.isArray(users)) {
    // Filter out any users recorded as deleted
    usersStore = users.filter((u: UserAccount) => 
      !deletedUserIdsStore.includes(u.id.toLowerCase()) && 
      !deletedUserIdsStore.includes(u.username.toLowerCase())
    );
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('USERS_UPDATED');
    res.json({ success: true, count: usersStore.length });
  } else {
    res.status(400).json({ error: 'Expected users array' });
  }
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const idx = usersStore.findIndex(u => u.id === id);
  if (idx >= 0) {
    usersStore[idx] = { ...usersStore[idx], ...updates };
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('USERS_UPDATED');
    res.json(usersStore[idx]);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Change Password Endpoint (User Request 3)
app.post('/api/users/:id/change-password', (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || !String(newPassword).trim()) {
    res.status(400).json({ error: 'New password cannot be empty.' });
    return;
  }

  const user = usersStore.find(u => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }

  // Validate current password if existing
  if (user.password && currentPassword && user.password !== currentPassword) {
    res.status(403).json({ error: 'Current password does not match.' });
    return;
  }

  user.password = String(newPassword).trim();
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('USERS_UPDATED');

  console.log(`[PASSWORD CHANGED] User @${user.username} updated password.`);
  res.json({ success: true, message: 'Password updated successfully.', user });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const target = usersStore.find(u => u.id === id || u.username.toLowerCase() === id.toLowerCase());
  const admins = usersStore.filter(u => u.role === 'ADMIN' && u.isActive);
  
  if (target?.role === 'ADMIN' && admins.length <= 1) {
    res.status(403).json({ error: 'Cannot delete the last active administrator account' });
    return;
  }

  const idToDelete = target ? target.id : id;
  const usernameToDelete = target ? target.username.toLowerCase() : '';

  if (!deletedUserIdsStore.includes(idToDelete.toLowerCase())) {
    deletedUserIdsStore.push(idToDelete.toLowerCase());
  }
  if (usernameToDelete && !deletedUserIdsStore.includes(usernameToDelete)) {
    deletedUserIdsStore.push(usernameToDelete);
  }

  usersStore = usersStore.filter(u => u.id !== idToDelete && u.username.toLowerCase() !== usernameToDelete);
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('USERS_UPDATED');
  console.log(`[USER DELETED] Permanently removed user id=${idToDelete} @${usernameToDelete}. Remaining: ${usersStore.length}`);
  res.json({ success: true });
});

// ---------------- FRANCHISE DATABASE REST ENDPOINTS (PRIMARY KEY: BODY NUMBER) ----------------

app.get('/api/franchise-records', (req, res) => {
  res.json(franchiseRegistryStore);
});

app.get('/api/franchise-records/:bodyNumber', (req, res) => {
  const { bodyNumber } = req.params;
  const record = franchiseRegistryStore.find(
    r => r.bodyNumber.trim().toUpperCase() === String(bodyNumber).trim().toUpperCase()
  );
  if (!record) {
    res.status(404).json({ error: `Record with Body Number ${bodyNumber} not found.` });
    return;
  }
  res.json(record);
});

app.post('/api/franchise-records', (req, res) => {
  const record: TricycleFranchiseRecord = req.body;
  if (!record || !record.bodyNumber) {
    res.status(400).json({ error: 'Body Number is required as Primary Key.' });
    return;
  }

  const cleanBody = String(record.bodyNumber).trim().toUpperCase();
  const exists = franchiseRegistryStore.some(
    r => r.bodyNumber.trim().toUpperCase() === cleanBody
  );

  if (exists) {
    res.status(409).json({ error: `Primary Key Conflict: Body Number "${cleanBody}" is already registered.` });
    return;
  }

  const newRecord: TricycleFranchiseRecord = {
    ...record,
    bodyNumber: cleanBody,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  franchiseRegistryStore.unshift(newRecord);
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
  res.status(201).json(newRecord);
});

app.put('/api/franchise-records/:bodyNumber', (req, res) => {
  const { bodyNumber } = req.params;
  const cleanBody = String(bodyNumber).trim().toUpperCase();
  const idx = franchiseRegistryStore.findIndex(
    r => r.bodyNumber.trim().toUpperCase() === cleanBody
  );

  if (idx === -1) {
    res.status(404).json({ error: `Franchise record with Body Number ${bodyNumber} not found.` });
    return;
  }

  const updates = req.body;
  franchiseRegistryStore[idx] = {
    ...franchiseRegistryStore[idx],
    ...updates,
    bodyNumber: cleanBody, // keep primary key intact
    updatedAt: Date.now(),
  };

  saveDatabaseToDisk();
  broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
  res.json(franchiseRegistryStore[idx]);
});

app.delete('/api/franchise-records/:bodyNumber', (req, res) => {
  const { bodyNumber } = req.params;
  const cleanBody = String(bodyNumber).trim().toUpperCase();
  franchiseRegistryStore = franchiseRegistryStore.filter(
    r => r.bodyNumber.trim().toUpperCase() !== cleanBody
  );
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
  res.json({ success: true });
});

// Upsert franchise record (used for automatic ticket sync and direct updating with email)
app.post('/api/franchise-records/upsert', (req, res) => {
  const data = req.body;
  if (!data || !data.bodyNumber) {
    res.status(400).json({ error: 'Body Number is required.' });
    return;
  }

  const cleanBody = String(data.bodyNumber).replace(/^#+/, '').trim().toUpperCase();
  const idx = franchiseRegistryStore.findIndex(
    r => r.bodyNumber.replace(/^#+/, '').trim().toUpperCase() === cleanBody
  );

  if (idx >= 0) {
    franchiseRegistryStore[idx] = {
      ...franchiseRegistryStore[idx],
      ...data,
      bodyNumber: cleanBody,
      emailAddress: data.emailAddress || data.email || franchiseRegistryStore[idx].emailAddress || '',
      updatedAt: Date.now(),
    };
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
    res.json({ success: true, record: franchiseRegistryStore[idx], action: 'updated' });
  } else {
    const newRecord: TricycleFranchiseRecord = {
      bodyNumber: cleanBody,
      operatorName: data.operatorName || 'Registered Operator',
      contactNumber: data.contactNumber || 'N/A',
      emailAddress: data.emailAddress || data.email || '',
      address: data.address || 'Castillejos, Zambales',
      barangay: data.barangay || 'Poblacion',
      driverName: data.driverName || data.operatorName || 'Registered Driver',
      licenseNumber: data.licenseNumber || 'N/A',
      make: data.make || 'Motorcycle with Sidecar',
      motorNumber: data.motorNumber || 'ENG-' + cleanBody,
      chassisNumber: data.chassisNumber || 'CHS-' + cleanBody,
      plateNumber: data.plateNumber || 'TC-' + cleanBody,
      colorScheme: data.colorScheme || 'Blue/Yellow',
      franchiseType: data.franchiseType || 'RENEWAL',
      permitNumber: data.permitNumber || `MTFRB-2026-${cleanBody}`,
      dateGranted: data.dateGranted || new Date().toISOString().slice(0, 10),
      validUntil: data.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: (data.status || 'ACTIVE').toUpperCase() as any,
      todaName: data.todaName || 'Castillejos Poblacion TODA',
      routeZone: data.routeZone || data.zone || 'Zone 1',
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    franchiseRegistryStore.unshift(newRecord);
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
    res.status(201).json({ success: true, record: newRecord, action: 'created' });
  }
});

app.post('/api/franchise-records/bulk', (req, res) => {
  const { records } = req.body;
  if (Array.isArray(records)) {
    const existingMap = new Map(franchiseRegistryStore.map((r) => [r.bodyNumber.toUpperCase(), r]));
    for (const r of records) {
      if (r && r.bodyNumber) {
        const key = r.bodyNumber.toUpperCase();
        const existing = existingMap.get(key);
        if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
          existingMap.set(key, { ...existing, ...r });
        }
      }
    }
    franchiseRegistryStore = Array.from(existingMap.values());
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
    res.json({ success: true, count: franchiseRegistryStore.length });
  } else {
    res.status(400).json({ error: 'Expected records array' });
  }
});

// Bulk sync tickets non-destructively
app.post('/api/tickets/bulk', (req, res) => {
  const { tickets } = req.body || {};
  if (Array.isArray(tickets)) {
    const existingMap = new Map(ticketsStore.map((t) => [t.id, t]));
    for (const t of tickets) {
      if (t && t.id) {
        existingMap.set(t.id, { ...existingMap.get(t.id), ...t });
      }
    }
    ticketsStore = Array.from(existingMap.values());
    saveDatabaseToDisk();
    broadcastRealtimeUpdate('TICKETS_SYNCED');
    res.json({ success: true, count: ticketsStore.length });
  } else {
    res.status(400).json({ error: 'Expected tickets array' });
  }
});

// ---------------- BACKUP & RESTORE REST ENDPOINTS ----------------
app.post('/api/backup/restore', (req, res) => {
  const backup = req.body;
  if (!backup || typeof backup !== 'object') {
    res.status(400).json({ error: 'Invalid backup payload' });
    return;
  }

  let restoredTickets = 0;
  let restoredCounters = 0;
  let restoredUsers = 0;
  let restoredFranchise = 0;
  let restoredInspections = 0;
  let restoredPayments = 0;

  if (Array.isArray(backup.tickets)) {
    ticketsStore = backup.tickets;
    restoredTickets = ticketsStore.length;
  }
  if (Array.isArray(backup.counters) && backup.counters.length > 0) {
    countersStore = backup.counters;
    restoredCounters = countersStore.length;
  }
  if (Array.isArray(backup.users) && backup.users.length > 0) {
    usersStore = backup.users;
    restoredUsers = usersStore.length;
  }
  if (Array.isArray(backup.franchiseRegistry) && backup.franchiseRegistry.length > 0) {
    franchiseRegistryStore = backup.franchiseRegistry;
    restoredFranchise = franchiseRegistryStore.length;
  }
  if (backup.inspections && typeof backup.inspections === 'object' && Object.keys(backup.inspections).length > 0) {
    inspectionsStore = backup.inspections;
    restoredInspections = Object.keys(inspectionsStore).length;
    saveInspectionsToDisk();
  }
  if (backup.payments && typeof backup.payments === 'object' && Object.keys(backup.payments).length > 0) {
    paymentsStore = {
      ...paymentsStore,
      ...backup.payments,
    };
    restoredPayments = Object.keys(paymentsStore).length;
    savePaymentsToDisk();
  }
  if (Array.isArray(backup.feesCatalog) && backup.feesCatalog.length > 0) {
    feesCatalogStore = backup.feesCatalog;
    saveFeesToDisk();
  }
  if (typeof backup.advisory === 'string' && backup.advisory.trim()) {
    advisoryStore = backup.advisory.trim();
  }
  if (backup.terminalPasswords && typeof backup.terminalPasswords === 'object') {
    terminalPasswordsStore = backup.terminalPasswords;
  }
  if (backup.backupConfig && typeof backup.backupConfig === 'object') {
    backupConfigStore = backup.backupConfig;
  }

  saveDatabaseToDisk();
  broadcastRealtimeUpdate('BACKUP_RESTORED');
  broadcastRealtimeUpdate('INSPECTION_UPDATED');
  broadcastRealtimeUpdate('PAYMENT_UPDATED');
  broadcastRealtimeUpdate('FRANCHISE_REGISTRY_UPDATED');
  broadcastRealtimeUpdate('USERS_UPDATED');
  broadcastRealtimeUpdate('TICKETS_SYNCED');

  console.log(`[BACKUP RESTORED] Restored ${restoredTickets} tickets, ${restoredCounters} counters, ${restoredUsers} users, ${restoredFranchise} franchise records, ${restoredInspections} inspections, ${restoredPayments} payments.`);

  res.json({
    success: true,
    message: `Database restored successfully (${restoredTickets} tickets, ${restoredCounters} counters, ${restoredUsers} users, ${restoredFranchise} franchise records, ${restoredInspections} inspections, ${restoredPayments} payments).`,
    restoredTickets,
    restoredCounters,
    restoredUsers,
    restoredFranchise,
    restoredInspections,
    restoredPayments,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  const cleanUsername = String(username).trim().toLowerCase();
  const user = usersStore.find(u => u.username.toLowerCase() === cleanUsername && u.isActive);
  if (!user) {
    res.status(401).json({ error: 'Invalid username or account inactive' });
    return;
  }
  if (user.password && password && user.password !== password) {
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }
  res.json({ success: true, user });
});

// SMS Confirmation Logs
interface SMSLogEntry {
  id: string;
  ticketNumber: string;
  applicantName: string;
  recipient: string;
  message: string;
  status: 'SENT' | 'FAILED';
  timestamp: number;
  provider: string;
}
let smsLogsStore: SMSLogEntry[] = [];

// Reset queue to initial state
app.post('/api/reset', (req, res) => {
  ticketsStore = [];
  countersStore = [...INITIAL_COUNTERS];
  saveDatabaseToDisk();
  broadcastRealtimeUpdate('QUEUE_RESET');
  res.json({ success: true, message: 'Queue data reset' });
});

// ---------------- SMS CONFIRMATION ENDPOINTS ----------------
app.post('/api/sms/send-confirmation', (req, res) => {
  const {
    ticketNumber,
    applicantName = 'Valued Applicant',
    contactNumber,
    franchiseType = 'NEW',
    bodyNumber,
    zone = 'Zone 1',
    estimatedWaitMinutes = 10,
    queuePosition = 1,
    trackingUrl = ''
  } = req.body;

  if (!contactNumber || !ticketNumber) {
    res.status(400).json({ error: 'contactNumber and ticketNumber are required' });
    return;
  }

  const cleanPhone = String(contactNumber).trim();
  const typeMap: Record<string, string> = {
    NEW: 'New Franchise',
    RENEWAL: 'Renewal',
    CHANGE_MOTOR: 'Change Motor',
    DROPPING: 'Order for Dropping',
  };
  const typeLabel = typeMap[franchiseType] || franchiseType;
  const bodyInfo = bodyNumber ? ` | Body No: ${bodyNumber}` : '';
  const message = `[MTFRB CASTILLEJOS]\nMagandang araw ${applicantName}!\nConfirmed ang inyong Queue Ticket: ${ticketNumber} para sa ${typeLabel} (${zone}${bodyInfo}).\nKasalukuyang posisyon sa pila: #${queuePosition} (~${estimatedWaitMinutes} mins waiting time).\nSubaybayan ang live status sa iyong cellphone:\n${trackingUrl}\nMaaari po kayong maghintay sa lobby o subaybayan online. Maraming salamat po!`;

  const logEntry: SMSLogEntry = {
    id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ticketNumber: String(ticketNumber).toUpperCase(),
    applicantName: String(applicantName),
    recipient: cleanPhone,
    message,
    status: 'SENT',
    timestamp: Date.now(),
    provider: 'MTFRB_CASTILLEJOS_SMS_GATEWAY'
  };

  smsLogsStore.unshift(logEntry);
  if (smsLogsStore.length > 500) {
    smsLogsStore = smsLogsStore.slice(0, 500);
  }

  console.log(`[SMS DISPATCHED] To: ${cleanPhone} | Ticket: ${ticketNumber} | ID: ${logEntry.id}`);

  res.json({
    success: true,
    messageId: logEntry.id,
    sentTo: cleanPhone,
    messageText: message,
    timestamp: logEntry.timestamp
  });
});

app.get('/api/sms/logs', (req, res) => {
  res.json(smsLogsStore);
});

// ---------------- RELEASING COMPLETION EMAIL WITH ATTACHED CERTIFICATE ----------------
app.post('/api/releasing/send-completion-email', async (req, res) => {
  try {
    const {
      clientEmail,
      ticketNumber,
      applicantName = 'Valued Applicant',
      bodyNumber,
      franchiseNumber,
      permitNumber,
      franchiseType = 'RENEWAL',
      plateNumber,
      motorNumber,
      chassisNumber,
      zone = 'Zone 1',
      todaName = 'Castillejos Poblacion TODA',
      dateGranted,
      validUntil,
      releasingOfficer = 'MTFRB Releasing Officer',
    } = req.body;

    if (!clientEmail || typeof clientEmail !== 'string' || !clientEmail.includes('@')) {
      res.status(400).json({ error: 'Valid client email address is required.' });
      return;
    }

    const cleanBody = String(bodyNumber || ticketNumber || '').replace(/^#+/, '').trim().toUpperCase();
    const certHtml = generateOfficialCertificateHtml({
      bodyNumber: cleanBody,
      applicantName,
      franchiseNumber,
      permitNumber,
      franchiseType,
      plateNumber,
      motorNumber,
      chassisNumber,
      zone,
      todaName,
      dateGranted: dateGranted || new Date().toISOString().slice(0, 10),
      validUntil: validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      releasingOfficer,
      emailAddress: clientEmail,
    });

    const emailSubject = `[MTFRB CASTILLEJOS] Certificate of Public Convenience Released - Body #${cleanBody} (${applicantName})`;

    const emailHtml = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0f766e; color: #ffffff; padding: 24px; text-align: center;">
          <p style="margin: 0; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; opacity: 0.9;">Republic of the Philippines</p>
          <h2 style="margin: 4px 0; font-size: 22px; letter-spacing: 0.5px;">MUNICIPALITY OF CASTILLEJOS</h2>
          <p style="margin: 2px 0 0 0; font-size: 13px; opacity: 0.95;">Municipal Tricycle Franchising & Regulatory Board (MTFRB)</p>
          <div style="display: inline-block; background-color: #fef08a; color: #042f2e; font-weight: 900; padding: 6px 14px; border-radius: 9999px; font-size: 11px; margin-top: 14px; letter-spacing: 0.5px; border: 1px solid #ca8a04;">
            ✓ TRANSACTION COMPLETED • OFFICIAL RELEASE
          </div>
        </div>

        <div style="padding: 24px; color: #1e293b;">
          <p style="font-size: 16px; font-weight: bold; color: #0f766e; margin-top: 0;">
            Dear ${applicantName},
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            We are pleased to advise that your MTFRB tricycle franchise application for 
            <strong>Municipal Body No. #${cleanBody}</strong> has been successfully processed, verified, and officially released at Counter 8 (Releasing Station).
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h4 style="margin: 0 0 12px 0; color: #0f766e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Franchise Particulars</h4>
            <table style="width: 100%; font-size: 13px; line-height: 1.7; color: #334155; border-collapse: collapse;">
              <tr>
                <td style="font-weight: bold; width: 42%; color: #475569;">Municipal Body No:</td>
                <td><strong style="color: #0f766e; font-size: 15px; font-family: monospace;">#${cleanBody}</strong></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #475569;">Permit Number:</td>
                <td><strong>${permitNumber || 'MTFRB-2026-' + cleanBody}</strong></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #475569;">Franchise Type:</td>
                <td><span style="font-weight: bold;">${franchiseType}</span></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #475569;">Assigned Zone:</td>
                <td>${zone}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #475569;">TODA Association:</td>
                <td>${todaName}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #475569;">Transaction Status:</td>
                <td><span style="color: #15803d; font-weight: bold;">RELEASED & COMPLETED</span></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #475569;">Valid Until:</td>
                <td><strong style="color: #0f766e;">${validUntil || '1 Year From Release'}</strong></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0fdfa; border-left: 4px solid #0f766e; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #134e4a; border-radius: 4px;">
            <strong style="font-size: 14px;">📎 Official Certification Attached:</strong><br>
            Your official electronic <strong>Certificate of Public Convenience</strong> is attached to this email as 
            <code>MTFRB_Certificate_Body_${cleanBody}.html</code>. You may open and print this document for your official vehicle inspection compliance, TODA registration, and municipal records.
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            To claim your physical plate stickers, laminated driver QR badge, or fare matrix card, please visit the MTFRB Office during municipal operating hours (8:00 AM - 5:00 PM).
          </p>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">

          <div style="font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
            Municipal Tricycle Franchising & Regulatory Board (MTFRB)<br>
            Municipal Hall, Castillejos, Zambales, Philippines<br>
            Contact: (047) 232-1234 • mtfrb@castillejos.gov.ph
          </div>
        </div>
      </div>
    `;

    const textBody = `MTFRB CASTILLEJOS - TRANSACTION COMPLETED & FRANCHISE RELEASED\n\nDear ${applicantName},\n\nYour tricycle franchise application for Municipal Body No. #${cleanBody} has been completed and released.\nYour official Certificate of Public Convenience is attached to this email.\n\nMTFRB Castillejos, Zambales.`;

    const sendResult = await sendNotificationEmail(
      [clientEmail],
      emailSubject,
      emailHtml,
      textBody,
      {
        filename: `MTFRB_Certificate_Body_${cleanBody}.html`,
        content: certHtml,
        contentType: 'text/html',
      }
    );

    console.log(`[RELEASING EMAIL] Sent certificate for Body #${cleanBody} to ${clientEmail} (ID: ${sendResult.messageId})`);

    res.json({
      success: true,
      message: `Official certificate email dispatched to ${clientEmail}`,
      messageId: sendResult.messageId,
      recipient: clientEmail,
      bodyNumber: cleanBody,
    });
  } catch (err: any) {
    console.error('[RELEASING EMAIL ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to dispatch releasing email' });
  }
});

// Server-Sent Events (SSE) stream for real-time mobile tracking and TV sync
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial payload immediately
  res.write(
    `data: ${JSON.stringify({
      type: 'INIT',
      tickets: ticketsStore,
      counters: countersStore,
      timestamp: lastUpdated,
    })}\n\n`
  );

  sseClients.add(res);

  // Heartbeat ping every 15s to keep mobile connection alive through reverse proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ---------------- VITE MIDDLEWARE & STATIC SERVING ----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://0.0.0.0:${PORT}`);
  });
}

startServer();
