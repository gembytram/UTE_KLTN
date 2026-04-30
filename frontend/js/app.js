// ============================================================
// DATA STORE (RAM) & API SETUP
// ============================================================
function resolveApiBase() {
  if (typeof window !== "undefined" && window.API_BASE) {
    return String(window.API_BASE).replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location) {
    const { origin, protocol, hostname, port } = window.location;
    if (origin && protocol !== "file:") {
      if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "5000") {
        return "http://127.0.0.1:5000";
      }
      return String(origin).replace(/\/$/, "");
    }
  }
  return "http://127.0.0.1:5000";
}

window.API_BASE = resolveApiBase();
const API_BASE = window.API_BASE;
const FETCH_OPTS = { credentials: "include" };

const DB = {
  users: [],
  dotDangKy: [],
  mangDeTai: [],
  bcttList: [],
  kltnList: [],
  hoiDongList: [],
  notifications: [],
  chuyenMonList: [],
  quotaList: [],
  goiYDeTai: [],
  tieuChiCham: [
    { tc: 'TC1', moTa: 'Xác định mục tiêu nghiên cứu và cấu trúc báo cáo.' },
    { tc: 'TC2', moTa: 'Nội dung phù hợp tên đề tài, phân tích có cơ sở.' },
    { tc: 'TC3', moTa: '' }, { tc: 'TC4', moTa: '' }, { tc: 'TC5', moTa: '' },
    { tc: 'TC6', moTa: '' }, { tc: 'TC7', moTa: '' }, { tc: 'TC8', moTa: '' }, { tc: 'TC9', moTa: '' }, { tc: 'TC10', moTa: '' },
  ],
  phanCongRoles: [],
  rawScoreRows: [],
  gvSlots: [],

  currentUser: null,
  currentPage: 'dashboard',
  nextDetaiTab: null,
};

// ============================================================
// HELPERS
// ============================================================
function getUser(email) { return DB.users.find(u => u.email === email); }
function getGV(email) { 
    if (!email) return null;
    return DB.users.find(u => u.email === email && (u.role === 'gv' || u.role === 'bm')); 
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return value.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
      }
    } catch (_) {}
  }
  return [];
}

function normalizeEmailList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((email) => normalizeEmail(email)).filter(Boolean);
}

function userMatchesIdOrEmail(user, idValue, emailValue) {
  if (!user) return false;
  const userId = Number(user.id);
  const candidateId = Number(idValue);
  if (!Number.isNaN(userId) && !Number.isNaN(candidateId) && userId === candidateId) return true;
  const userEmail = normalizeEmail(user.email);
  return Boolean(userEmail) && userEmail === normalizeEmail(emailValue);
}

function isUserCommitteeMemberOnRecord(user, student) {
  if (!user || !student) return false;
  const userId = Number(user.id);
  const userEmail = normalizeEmail(user.email);
  const committeeIds = normalizeIdList(student.committeeMembers);
  const committeeEmails = normalizeEmailList(student.committeeMemberEmails);
  const hoiDongTvEmails = normalizeEmailList(student.hoiDong?.tv);
  return (
    (!Number.isNaN(userId) && committeeIds.includes(userId)) ||
    (userEmail && committeeEmails.includes(userEmail)) ||
    (userEmail && hoiDongTvEmails.includes(userEmail))
  );
}

function hasCommonMajor(a, b) {
    if (!a || !b) return false;
    const majorsA = Array.isArray(a.chuyenMon) ? a.chuyenMon.map((m) => String(m).trim()).filter(Boolean) : [];
    const majorsB = Array.isArray(b.chuyenMon) ? b.chuyenMon.map((m) => String(m).trim()).filter(Boolean) : [];
    return majorsA.length && majorsB.length && majorsA.some((m) => majorsB.includes(m));
}

function normalizeMajorName(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'logistic' || raw === 'log') return 'log';
  return raw;
}

function majorMatches(a, b) {
  return normalizeMajorName(a) && normalizeMajorName(a) === normalizeMajorName(b);
}

function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.API_BASE) return String(window.API_BASE).replace(/\/$/, '');
  return 'http://127.0.0.1:5000';
}

// function uploadFileHref(storedPath) {
//   if (!storedPath) return '#';
//   const base = getApiBaseUrl();
//   const rel = String(storedPath).replace(/^uploads[\\/]/i, '').replace(/\\/g, '/');
//   return base + '/uploads/' + rel.split('/').map((seg) => encodeURIComponent(seg)).join('/');
// }

function uploadFileHref(fileId) {
  if (!fileId) return '#';
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

const ICON_MAP = {
  '🏠': 'home', '📝': 'edit', '🎓': 'academicCap', '⏱️': 'timer', '👤': 'user',
  '✅': 'checkCircle', '❌': 'xCircle', 'ℹ️': 'infoCircle', '🧾': 'receipt', '🏛️': 'building',
  '👨‍⚖️': 'gavel', '💡': 'lightbulb', '📊': 'chartBar', '📈': 'chartLine', '👥': 'users',
  '📋': 'clipboard', '🗂️': 'folder', '🎯': 'target', '📅': 'calendar', '📭': 'inbox',
  '🚫': 'ban', '✕': 'x', '➕': 'plus', '✏️': 'pencil', '🗑️': 'trash', '📄': 'file',
  '📁': 'folder', '📥': 'download', '🔑': 'key', '🔔': 'bell', '📕': 'book', '📑': 'bookmark', '👁': 'eye'
};

const ICON_SVG = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h8"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/></svg>',
  academicCap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 1 8l11 5 9-4.09"/><path d="M2 9.5v4.75C2 16.55 6.58 18.47 12 18.47c5.42 0 10-1.92 10-4.22V9.5"/><path d="M12 18.5v3"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 1"/><path d="M11 2h2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M6 21v-1a5 5 0 0 1 10 0v1"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
  infoCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4 12 9 3 4v16h18V4Z"/><path d="M7 9h10M7 13h6"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16V5L12 2 4 5v16Z"/><path d="M9 8h2m2 0h2M9 12h2m2 0h2M9 16h2m2 0h2"/></svg>',
  gavel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 13 7-7 4 4-7 7-4-4Z"/><path d="m14 10 4 4"/><path d="M3 21h7"/></svg>',
  lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 3a6 6 0 0 0-4 10.9c0 1.7.8 3.3 2.1 4.3L10 20h4l.9-1.8A5.99 5.99 0 0 0 16 3h-4Z"/></svg>',
  chartBar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19V10"/><path d="M10 19V6"/><path d="M14 19v-4"/><path d="M18 19v-7"/><path d="M4 21h16"/></svg>',
  chartLine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17 9 12l3 3 6-6 2 2"/><path d="M4 21h16"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7a4 4 0 1 1 6 0 4 4 0 0 1-6 0Z"/><path d="M3 21v-1a4 4 0 0 1 4-4h2"/><path d="M17 16h2a4 4 0 0 1 4 4v1"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M5 7h14v14H5V7Z"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h6l2 2h10v10H3V7Z"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 5V2"/><path d="M12 22v-3"/><path d="M5 12H2"/><path d="M22 12h-3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 11h18"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v6l-4 5H8l-4-5V4Z"/><path d="M4 20h16"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M7 7l10 10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 6 6 20h12l1-14"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="m8 13 4 4 4-4"/><path d="M4 20h16"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="16" r="3"/><path d="M10.5 16 21 5.5"/><path d="M19 7v3h3"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 7H20v13"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>'
};

const ICON_REGEX = new RegExp(Object.keys(ICON_MAP).map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a,b) => b.length - a.length).join('|'), 'g');

function createIconElement(token) {
  const key = ICON_MAP[token];
  const wrapper = document.createElement('span');
  wrapper.className = 'inline-icon';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = ICON_SVG[key] || '';
  return wrapper;
}

function shouldIgnoreTextNode(node) {
  let el = node.parentElement;
  while (el) {
    const tag = el.tagName;
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'SELECT'].includes(tag)) return true;
    el = el.parentElement;
  }
  return false;
}

function replaceTextNodeIcons(textNode) {
  const value = textNode.nodeValue;
  if (!value || !ICON_REGEX.test(value) || shouldIgnoreTextNode(textNode)) return;
  ICON_REGEX.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let match;
  while ((match = ICON_REGEX.exec(value)) !== null) {
    const beforeText = value.slice(lastIndex, match.index);
    if (beforeText) frag.appendChild(document.createTextNode(beforeText));
    frag.appendChild(createIconElement(match[0]));
    lastIndex = match.index + match[0].length;
  }
  const remaining = value.slice(lastIndex);
  if (remaining) frag.appendChild(document.createTextNode(remaining));
  textNode.replaceWith(frag);
}

function applyIconsToDom(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(node) {
    if (!node.nodeValue) return NodeFilter.FILTER_SKIP;
    ICON_REGEX.lastIndex = 0;
    if (!ICON_REGEX.test(node.nodeValue)) return NodeFilter.FILTER_SKIP;
    if (shouldIgnoreTextNode(node)) return NodeFilter.FILTER_SKIP;
    return NodeFilter.FILTER_ACCEPT;
  } }, false);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceTextNodeIcons);
}

function getCurrentStudentMajor() {
  const u = DB.currentUser || {};
  const majors = Array.isArray(u.chuyenMon)
    ? u.chuyenMon.map((m) => String(m).trim()).filter(Boolean)
    : [];
  if (majors.length) return majors[0];
  if (u.linh_vuc) {
    const parsed = String(u.linh_vuc)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (parsed.length) return parsed[0];
  }
  return '';
}

function getCurrentStudentFields() {
  return ['AI', 'Chất lượng', 'HR', 'Kinh doanh quốc tế', 'Kế toán', 'Logistic', 'Marketing', 'Mô phỏng', 'Quản lý công nghiệp', 'Sản xuất'];
}

function getTopicTypesForField(field) {
  return ['ung_dung', 'nghien_cuu'];
}

function dotMatchesStudentHeAndMajor(d) {
  const u = DB.currentUser;
  if (!u || u.role !== 'sv') return true;
  const majors = u.chuyenMon || [];
  const nganh = (d.nganh || '').trim();
  if (nganh && majors.length) {
    return majors.indexOf(nganh) >= 0;
  }
  if (!nganh && majors.length && majors[0] && d.ten) {
    return d.ten.includes(majors[0]);
  }
  return true;
}

function normalizeStudentSlotHe(u) {
  if (!u) return 'DaiTra';
  return (u.heDaoTao || '').trim() === 'CLC' ? 'CLC' : 'DaiTra';
}

function gvBcttSlotRow(gvId, dotId) {
  const he = normalizeStudentSlotHe(DB.currentUser);
  return (DB.gvSlots || []).find(
    (s) => Number(s.gvId) === Number(gvId) && String(s.dotId) === String(dotId) && (s.heDaoTao || 'DaiTra') === he
  );
}

function gvAcceptsBcttRegistration(gvId, dotId) {
  const sl = gvBcttSlotRow(gvId, dotId);
  if (!sl) return false;
  return Boolean(sl.duyetTbm) && (sl.slotConLai || 0) > 0;
}

function gvListMatchingKltnMajor(k) {
  const mang = k && k.mangDeTai ? String(k.mangDeTai).trim() : '';
  return DB.users.filter((u) => {
    if (u.role !== 'gv' && u.role !== 'bm') return false;
    if (!mang) return true;
    return (u.chuyenMon || []).indexOf(mang) >= 0;
  });
}

function isBCTTVisibleForCurrentUser(b) {
  const u = DB.currentUser;
  if (!u || !b) return false;
  if (u.role === 'sv') return b.svEmail === u.email;
  if (u.role === 'bm') {
    if (!u.chuyenMon || !u.chuyenMon.length) return true;
    return u.chuyenMon.some(n => (b.tenDot || '').includes(n));
  }
  if (u.role === 'gv') return b.gvEmail === u.email;
  return true;
}

function isKLTNVisibleForCurrentUser(k) {
  const u = DB.currentUser;
  if (!u || !k) return false;
  if (u.role === 'sv') return k.svEmail === u.email;
  if (u.role === 'bm') {
    if (!u.chuyenMon || !u.chuyenMon.length) return true;
    return u.chuyenMon.some(n => (k.tenDot || '').includes(n));
  }
  if (u.role === 'gv') {
    return getKLTNAssignment(u, k).canView;
  }
  return true;
}

function getKLTNAssignment(user, student) {
  if (!user || !student) {
    return {
      isAdvisor: false,
      isReviewer: false,
      isCommitteeMember: false,
      isChair: false,
      isSecretary: false,
      canGrade: false,
      canView: false,
    };
  }

  if (student.myAssignment) {
    return {
      isAdvisor: Boolean(student.myAssignment.isAdvisor),
      isReviewer: Boolean(student.myAssignment.isReviewer),
      isCommitteeMember: Boolean(student.myAssignment.isCommitteeMember),
      isChair: Boolean(student.myAssignment.isChair),
      isSecretary: Boolean(student.myAssignment.isSecretary),
      canGrade: Boolean(student.myAssignment.canGrade),
      canView: Boolean(student.myAssignment.canView),
    };
  }

  const isAdvisor = userMatchesIdOrEmail(user, student.advisorId, student.gvHDEmail);
  const isReviewer = userMatchesIdOrEmail(user, student.reviewerId, student.gvPBEmail);
  const isChair = userMatchesIdOrEmail(user, student.chairmanId, student.hoiDong?.ct);
  const isSecretary = userMatchesIdOrEmail(user, student.secretaryId, student.hoiDong?.tk);
  const isCommitteeMember = isUserCommitteeMemberOnRecord(user, student);

  return {
    isAdvisor,
    isReviewer,
    isCommitteeMember,
    isChair,
    isSecretary,
    canGrade: isAdvisor || isReviewer || isCommitteeMember,
    canView: isAdvisor || isReviewer || isCommitteeMember || isChair || isSecretary,
  };
}

function canGrade(user, student) {
  return getKLTNAssignment(user, student).canGrade;
}

function can_grade(user, student) {
  return canGrade(user, student);
}

function canGradeRole(user, student, vaiTro) {
  const assignment = getKLTNAssignment(user, student);
  if (vaiTro === 'HD') return assignment.isAdvisor;
  if (vaiTro === 'PB') return assignment.isReviewer;
  if (vaiTro === 'TV') return assignment.isCommitteeMember;
  return false;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeForTextarea(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function getKLTNCouncilScores(k) {
  if (!k) return [];
  const councilRows = [];
  if (k.diemBB != null && !Number.isNaN(Number(k.diemBB))) {
    councilRows.push(Number(k.diemBB));
  }
  (k.tvScores || []).forEach((t) => {
    const score = Number(t.diem);
    if (!Number.isNaN(score)) councilRows.push(score);
  });
  if (councilRows.length) return councilRows;
  if (k.diemBB == null || Number.isNaN(Number(k.diemBB))) return [];
  return [Number(k.diemBB)];
}

function getKLTNCouncilBreakdown(k) {
  if (!k) return [];
  const rows = [];
  const seen = new Set();

  if (k.hoiDong?.ct) {
    const chairEmail = k.hoiDong.ct;
    rows.push({
      role: 'CT',
      email: chairEmail,
      name: getUser(chairEmail)?.name || chairEmail || 'Chủ tịch hội đồng',
      score: k.diemBB != null && !Number.isNaN(Number(k.diemBB)) ? Number(k.diemBB) : null,
    });
    seen.add(chairEmail);
  } else if (k.diemBB != null && !Number.isNaN(Number(k.diemBB))) {
    rows.push({
      role: 'CT',
      email: '',
      name: 'Chủ tịch hội đồng',
      score: Number(k.diemBB),
    });
  }

  const memberEmails = [];
  if (Array.isArray(k.hoiDong?.tv)) memberEmails.push(...k.hoiDong.tv);
  if (Array.isArray(k.committeeMemberEmails)) memberEmails.push(...k.committeeMemberEmails);

  memberEmails.forEach((email) => {
    if (!email || seen.has(email)) return;
    const matchedScore = (k.tvScores || []).find((row) => row.email === email);
    const score = matchedScore && matchedScore.diem != null && !Number.isNaN(Number(matchedScore.diem))
      ? Number(matchedScore.diem)
      : null;
    rows.push({
      role: 'TV',
      email,
      name: getUser(email)?.name || email,
      score,
    });
    seen.add(email);
  });

  (k.tvScores || []).forEach((row) => {
    if (!row.email || seen.has(row.email)) return;
    const score = row.diem != null && !Number.isNaN(Number(row.diem)) ? Number(row.diem) : null;
    rows.push({
      role: 'TV',
      email: row.email,
      name: getUser(row.email)?.name || row.email,
      score,
    });
  });
  return rows;
}

function computeKLTNFinalAvg(k) {
  if (!k || k.diemHD == null || k.diemPB == null) return null;
  const hoiDongScores = getKLTNCouncilScores(k);
  if (!hoiDongScores.length) return null;
  const avgHd = hoiDongScores.reduce((a, b) => a + b, 0) / hoiDongScores.length;
  // Giới hạn mỗi điểm thành phần không quá 10
  const diemHD = Math.min(Number(k.diemHD), 10);
  const diemPB = Math.min(Number(k.diemPB), 10);
  const avgHdLimited = Math.min(avgHd, 10);
  const total = diemHD * 0.2 + diemPB * 0.2 + avgHdLimited * 0.6;
  return Math.min(total, 10);
}

function parseStoredCriteria(criteria) {
  return Array.isArray(criteria) ? criteria : [];
}

function criteriaInputId(recordId, vaiTro, index) {
  return `${vaiTro.toLowerCase()}-criterion-${index}-${recordId}`;
}

function normalizeCriterionInput(recordId, vaiTro, index, max) {
  const el = document.getElementById(criteriaInputId(recordId, vaiTro, index));
  if (!el) return;
  const raw = String(el.value || '').trim();
  if (raw === '') return;
  let value = Number(raw);
  if (Number.isNaN(value)) {
    el.value = '';
    return;
  }
  value = Math.max(0, Math.min(value, Number(max)));
  el.value = value % 1 === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function totalInputId(recordId, vaiTro) {
  return `${vaiTro.toLowerCase()}-score-${recordId}`;
}

function noteInputId(recordId, vaiTro) {
  return `${vaiTro.toLowerCase()}-note-${recordId}`;
}

function questionInputId(recordId, vaiTro) {
  return `${vaiTro.toLowerCase()}-question-${recordId}`;
}

function getExistingCriteriaForRole(k, vaiTro) {
  if (!k) return [];
  if (vaiTro === 'HD') return parseStoredCriteria(k.hdCriteria);
  if (vaiTro === 'PB') return parseStoredCriteria(k.pbCriteria);
  if (vaiTro === 'CT') return parseStoredCriteria(k.ctCriteria);
  if (vaiTro === 'TV') {
    const current = getCurrentTVScore(k);
    return parseStoredCriteria(current?.criteria);
  }
  return [];
}

function recalcKLTNRoleTotal(recordId, vaiTro) {
  const record = findKltnRecord(recordId);
  if (!record) return 0;
  const template = getScoreTemplate(record.topicType, vaiTro);
  let total = 0;
  template.forEach(([, max], index) => {
    normalizeCriterionInput(record.id, vaiTro, index, max);
    const el = document.getElementById(criteriaInputId(record.id, vaiTro, index));
    const value = el ? Number(el.value) : 0;
    total += Number.isNaN(value) ? 0 : value;
  });
  // Giới hạn tổng điểm không quá 10
  total = Math.min(total, 10);
  const totalEl = document.getElementById(totalInputId(record.id, vaiTro));
  if (totalEl) totalEl.value = total ? total.toFixed(2).replace(/\.00$/, '') : '';
  return total;
}

function buildCriteriaPayload(record, vaiTro) {
  const template = getScoreTemplate(record.topicType, vaiTro);
  return template.map(([name, max], index) => {
    normalizeCriterionInput(record.id, vaiTro, index, max);
    const el = document.getElementById(criteriaInputId(record.id, vaiTro, index));
    const raw = el ? el.value : '';
    const value = raw === '' ? null : Number(raw);
    return {
      name,
      max,
      score: value == null || Number.isNaN(value) ? null : value,
    };
  });
}

function renderKLTNScoreBlock(k, vaiTro, title, hint, options = {}) {
  const existingCriteria = getExistingCriteriaForRole(k, vaiTro);
  const template = getScoreTemplate(k.topicType, vaiTro);
  const existingScore = options.existingScore;
  const noteValue = options.noteValue || '';
  const questionValue = options.questionValue || '';
  const showQuestion = Boolean(options.showQuestion);
  const isLocked = existingScore != null && existingScore !== '';

  const rows = template.map(([name, max], index) => {
    const stored = existingCriteria[index];
    const value = stored && stored.score != null ? stored.score : '';
    const inputAttrs = isLocked ? 'disabled style="opacity:0.6"' : '';
    return `<tr>
      <td style="font-size:13px">${index + 1}. ${escapeHtml(name)}</td>
      <td style="font-size:13px;text-align:center">${max}</td>
      <td><input type="number" min="0" max="${max}" step="0.1" id="${criteriaInputId(k.id, vaiTro, index)}" value="${value}" ${inputAttrs} oninput="normalizeCriterionInput('${k.id}','${vaiTro}',${index},${max});recalcKLTNRoleTotal('${k.id}','${vaiTro}')"></td>
    </tr>`;
  }).join('');

  const lockedMessage = isLocked ? `<div style="background:#FFF7D6;border:1px solid var(--accent3);border-radius:var(--radius);padding:12px 16px;margin-bottom:12px;font-size:13px;color:#974F0C">Bạn đã lưu điểm. Không thể thay đổi.</div>` : '';
  const textareaAttrs = isLocked ? 'readonly style="opacity:0.6;background:var(--bg)"' : '';
  const buttonAttrs = isLocked ? 'disabled style="opacity:0.5;cursor:not-allowed"' : '';

  return `<div style="font-size:16px;font-weight:800;color:var(--primary-dark);margin:12px 0 8px">${escapeHtml(getScoreSheetTitle(k.topicType, vaiTro))}</div>
    <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:8px">${escapeHtml(title)}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px">${escapeHtml(hint)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Mẫu phiếu: ${escapeHtml(getTopicTypeLabel(k.topicType))} • ${escapeHtml(SCORE_ROLE_LABELS[vaiTro] || vaiTro)}</div>
    ${lockedMessage}
    <div class="table-wrap" style="margin-bottom:12px">
      <table>
        <thead><tr><th>Tiêu chí</th><th>Điểm tối đa</th><th>Điểm</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="form-group"><label>Tổng điểm</label><input type="number" id="${totalInputId(k.id, vaiTro)}" value="${existingScore ?? ''}" readonly style="background:var(--bg)"></div>
    <div class="form-group"><label>Nhận xét</label><textarea id="${noteInputId(k.id, vaiTro)}" style="min-height:110px" ${textareaAttrs} placeholder="Nhập nhận xét">${escapeHtml(noteValue)}</textarea></div>
    ${showQuestion ? `<div class="form-group"><label>Câu hỏi / góp ý</label><textarea id="${questionInputId(k.id, vaiTro)}" style="min-height:110px" ${textareaAttrs} placeholder="Nhập câu hỏi hoặc góp ý cho sinh viên">${escapeHtml(questionValue)}</textarea></div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" ${buttonAttrs} onclick="saveKLTNScore('${k.id}','${vaiTro}')">💾 Lưu phiếu chấm</button>
      <button class="btn btn-ghost btn-sm" onclick="exportKLTNScoreDocx('${k.id}','${vaiTro}')">📄 Xuất phiếu DOCX</button>
    </div>`;
}

function getCurrentTVScore(k) {
  const u = DB.currentUser;
  if (!u || !k || !Array.isArray(k.tvScores)) return null;
  return k.tvScores.find((t) => t.email === u.email) || null;
}

async function saveKLTNScore(recordId, vaiTro) {
  const record = findKltnRecord(recordId);
  if (!record) {
    toast("Không tìm thấy hồ sơ KLTN", "error");
    return;
  }
  if (!canGradeRole(DB.currentUser, record, vaiTro)) {
    toast("Bạn không có quyền chấm điểm hồ sơ này", "error");
    return;
  }

  const dangKyId = record.dangKyId || extractId(record.id);
  const criteriaPayload = buildCriteriaPayload(record, vaiTro);
  const diem = recalcKLTNRoleTotal(record.id, vaiTro);
  const nhanXetEl = document.getElementById(noteInputId(record.id, vaiTro));
  const cauHoiEl = document.getElementById(questionInputId(record.id, vaiTro));
  const nhan_xet = nhanXetEl ? nhanXetEl.value.trim() : "";
  const cau_hoi = cauHoiEl ? cauHoiEl.value.trim() : "";
  const criteriaInvalid = criteriaPayload.some((row) => row.score == null || row.score < 0 || row.score > row.max);

  if (!criteriaPayload.length || criteriaInvalid) {
    toast("Vui lòng nhập đầy đủ điểm từng tiêu chí hợp lệ", "error");
    return;
  }

  try {
    await apiRequest("/api/cham-diem", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_id: dangKyId,
        vai_tro: vaiTro,
        diem,
        nhan_xet,
        cau_hoi,
        criteria_json: JSON.stringify(criteriaPayload),
      }),
    });
    toast("Lưu điểm thành công");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function saveScoreHD(recordId) {
  await saveKLTNScore(recordId, "HD");
}

async function saveScoreTV(recordId) {
  await saveKLTNScore(recordId, "TV");
}

async function exportKLTNScoreDocx(recordId, vaiTro) {
  const record = findKltnRecord(recordId);
  if (!record) {
    toast("Không tìm thấy hồ sơ KLTN", "error");
    return;
  }
  if (!canGradeRole(DB.currentUser, record, vaiTro)) {
    toast("Bạn không có quyền xuất phiếu chấm cho hồ sơ này", "error");
    return;
  }

  const criteriaPayload = buildCriteriaPayload(record, vaiTro);
  const total = recalcKLTNRoleTotal(record.id, vaiTro);
  const nhan_xet = document.getElementById(noteInputId(record.id, vaiTro))?.value.trim() || "";
  const cau_hoi = document.getElementById(questionInputId(record.id, vaiTro))?.value.trim() || "";
  const sv = getUser(record.svEmail);
  const current = DB.currentUser || {};
  const authHeaders = {};
  if (current.id) authHeaders["X-User-Id"] = String(current.id);
  if (current.role_raw || current.role) authHeaders["X-User-Role"] = String(current.role_raw || toApiRole(current.role));

  if (!criteriaPayload.length) {
    toast("Chưa có dữ liệu phiếu chấm để xuất", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/cham-diem/xuat-docx`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        title: getScoreSheetTitle(record.topicType, vaiTro),
        tenDeTai: record.tenDeTai,
        sinhVien: sv?.name || record.svEmail,
        maSV: sv?.ma || sv?.mssv || "",
        topicType: getTopicTypeLabel(record.topicType),
        vaiTro,
        roleLabel: SCORE_ROLE_LABELS[vaiTro] || vaiTro,
        nguoiCham: current.name || "",
        diem: total.toFixed(2),
        nhanXet: nhan_xet,
        cauHoi: cau_hoi,
        criteria: criteriaPayload.map((row) => row.score ?? ""),
        criteriaNames: criteriaPayload.map((row) => row.name),
        criteriaMax: criteriaPayload.map((row) => row.max),
        total: total.toFixed(2),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Xuất DOCX thất bại" }));
      throw new Error(body.message || "Xuất DOCX thất bại");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ChamDiem_${vaiTro}_${(sv?.ma || "SV")}_${record.id}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Đã xuất phiếu chấm DOCX");
  } catch (err) {
    toast(err.message, "error");
  }
}

function gvKLTNListForNhapDiem(u) {
  return DB.kltnList.filter((k) => {
    const st = k.trangThai;
    if (st !== 'cham_diem' && st !== 'bao_ve') return false;
    const assignment = getKLTNAssignment(u, k);
    const isHD = assignment.isAdvisor;
    const isPB = assignment.isReviewer;
    const isCT = assignment.isChair;
    const isTK = assignment.isSecretary;
    const isTV = assignment.isCommitteeMember || isUserCommitteeMemberOnRecord(u, k);
    if (!(isHD || isPB || isCT || isTK || isTV)) return false;
    // TV được chấm điểm cả khi đã bảo vệ
    if (st === 'bao_ve' && isPB) return false;
    return true;
  });
}
function getBCTTBySV(email) { return DB.bcttList.filter(b => b.svEmail === email); }
function getKLTNBySV(email) { return DB.kltnList.filter(k => k.svEmail === email); }
function getUnreadNotifs(email) { return DB.notifications.filter(n => n.toEmail === email && !n.read); }

const STATUS_LABELS = {
  cho_duyet: { label: 'Chờ duyệt', cls: 'badge-orange' },
  gv_xac_nhan: { label: 'GV đã xác nhận', cls: 'badge-blue' },
  tu_choi: { label: 'Từ chối', cls: 'badge-red' },
  phan_cong_pb: { label: 'Đã phân công PB', cls: 'badge-purple' },
  cho_cham: { label: 'Chờ GV chấm', cls: 'badge-orange' },
  pass: { label: 'Đạt', cls: 'badge-green' },
  fail: { label: 'Không đạt', cls: 'badge-red' },
  thuc_hien: { label: 'Đang thực hiện', cls: 'badge-blue' },
  hoan_tat: { label: 'Hoàn tất', cls: 'badge-green' },
  cham_diem: { label: 'Chờ chấm điểm', cls: 'badge-orange' },
  bao_ve: { label: 'Đã bảo vệ', cls: 'badge-purple' },
  hoan_thanh: { label: 'Hoàn thành', cls: 'badge-green' },
};
function statusBadge(s) {
  const st = STATUS_LABELS[s] || { label: s, cls: 'badge-gray' };
  return `<span class="badge ${st.cls}">${st.label}</span>`;
}

function toast(msg, type = 'success') {
  const tc = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${msg}`;
  applyIconsToDom(t);
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showModal(html) {
  const modalContent = document.getElementById('modal-content');
  modalContent.innerHTML = html;
  applyIconsToDom(modalContent);
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(e) {
  if (!e || e.target.id === 'modal-overlay') {
    document.getElementById('modal-overlay').classList.remove('open');
  }
}
function closeModalForce() { document.getElementById('modal-overlay').classList.remove('open'); }

function addNotif(toEmail, title, body) {
  DB.notifications.unshift({ id: 'n' + Date.now(), toEmail, title, body, time: new Date().toLocaleString('vi-VN'), read: false });
  if (DB.currentUser && DB.currentUser.email === toEmail) updateNotifDot();
}
function updateNotifDot() {
  const count = getUnreadNotifs(DB.currentUser.email).length;
  document.getElementById('notif-dot').style.display = count > 0 ? 'block' : 'none';
  const btn = document.getElementById('notif-btn');
  if (btn) btn.querySelector('span') && (btn.querySelector('span').style.display = count > 0 ? 'block' : 'none');
}

// ============================================================
// API CORE
// ============================================================
function toApiRole(role) {
  if (role === "sv") return "SV";
  if (role === "gv") return "GV";
  if (role === "bm") return "TBM";
  return role;
}

function toMaFromLoginInput(value) {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.split("@")[0].toUpperCase();
  return raw.toUpperCase();
}

function extractId(prefixed) {
  const m = String(prefixed || "").match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

async function apiRequest(path, options = {}) {
  const current = DB.currentUser || {};
  const authHeaders = {};
  if (current.id) authHeaders["X-User-Id"] = String(current.id);
  if (current.role_raw || current.role) authHeaders["X-User-Role"] = String(current.role_raw || toApiRole(current.role));
  const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...authHeaders, ...(options.headers || {}) };
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...FETCH_OPTS,
      headers,
      ...options,
    });
  } catch (_) {
    throw new Error(`Không kết nối được tới máy chủ (${API_BASE}). Hãy chạy backend Flask rồi mở giao diện từ đúng địa chỉ mà Flask in ra.`);
  }
  const body = await res.json().catch(() => ({ success: false, message: "Invalid JSON" }));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || "Có lỗi từ server");
  }
  return body;
}

async function syncFromServer() {
  const out = await apiRequest("/api/bootstrap", { method: "GET" });
  const data = out.data || {};
  DB.users = (data.users || []).map(u => ({
    ...u,
    chuyenMon: Array.isArray(u.chuyenMon)
      ? u.chuyenMon
      : (u.linh_vuc ? u.linh_vuc.split(',').map(s => s.trim()) : []),
    linhVucPhuTrach: String(u.linhVucPhuTrach || u.linh_vuc_phu_trach || '').trim(),
  }));
  DB.dotDangKy = data.dotDangKy || [];
  DB.bcttList = data.bcttList || [];
  DB.kltnList = data.kltnList || [];
  DB.gvSlots = data.gvSlots || [];
  DB.notifications = data.notifications || [];
  const lv = new Set();
  DB.bcttList.forEach((x) => x.mangDeTai && lv.add(x.mangDeTai));
  DB.kltnList.forEach((x) => x.mangDeTai && lv.add(x.mangDeTai));
  DB.users.forEach((u) => (u.chuyenMon || []).forEach((m) => lv.add(m)));
  DB.mangDeTai = Array.from(lv);
  DB.chuyenMonList = DB.users
    .filter((u) => u.role === "gv" || u.role === "bm")
    .flatMap((u) => (u.chuyenMon || []).map((field) => ({ email: u.email, major: field, field })));
  
  if (DB.currentUser) {
    const currentEmail = normalizeEmail(DB.currentUser.email);
    const fromServer = DB.users.find((u) =>
      (DB.currentUser.id != null && u.id === DB.currentUser.id) ||
      (currentEmail && normalizeEmail(u.email) === currentEmail)
    );
    if (fromServer) {
      DB.currentUser = { ...DB.currentUser, ...fromServer };
    }
    try {
      localStorage.setItem("currentUser", JSON.stringify(DB.currentUser));
    } catch (_) {}
  }
  
}

async function loadNotifications() {
  try {
    const res = await apiRequest('/api/thong-bao', { method: 'GET' });
    DB.notifications = res.data?.thong_bao || [];
  } catch (err) {
    DB.notifications = DB.notifications || [];
    console.error('Không tải được thông báo', err);
  }
}

// ============================================================
// AUTH & APP INIT
// ============================================================
const NAV_CONFIG = {
  sv: [
    { section: 'Sinh viên' },
    { id: 'dashboard', label: 'Thông tin chung', icon: '🏠' },
    { id: 'bctt', label: 'Đăng ký đề tài BCTT', icon: '📝' },
    { id: 'kltn', label: 'Đăng ký đề tài KLTN', icon: '🎓' },
    { id: 'theodoi', label: 'Theo dõi trạng thái', icon: '⏱️' },
    { section: 'Tài khoản' },
    { id: 'profile', label: 'Hồ sơ cá nhân', icon: '👤' },
  ],
  gv: [
    { section: 'Giảng viên' },
    { id: 'dashboard', label: 'Thông tin chung', icon: '🏠' },
    { id: 'huongdan', label: 'Hướng dẫn', icon: '✅', badge: true },
    { id: 'phanbien', label: 'Phản biện', icon: '🧾' },
    { id: 'hoidong', label: 'Hội đồng', icon: '🏛️' },
    { id: 'thongbao', label: 'Thông báo', icon: '📣' },
    { id: 'chutich', label: 'Chủ tịch', icon: '👨‍⚖️' },
    { id: 'thuky', label: 'Thư ký', icon: '📝' },
    { id: 'goiy', label: 'Gợi ý đề tài', icon: '💡' },
    { id: 'nhapDiem', label: 'Chấm điểm đề tài', icon: '📊' },
    { section: 'Tài khoản' },
    { id: 'profile', label: 'Hồ sơ cá nhân', icon: '👤' },
  ],
  bm: [
    { section: 'Trưởng Bộ Môn' },
    { id: 'dashboard', label: 'Thông tin chung', icon: '🏠' },
    { id: 'duyetde', label: 'Mở slot GVHD', icon: '🎯', badge: true },
    { id: 'phancong', label: 'Phân công PB/HĐ', icon: '👥' },
    { id: 'detai', label: 'Danh sách đề tài', icon: '📋' },
    { id: 'huongdan', label: 'Hướng dẫn', icon: '✅' },
    { id: 'phanbien', label: 'Phản biện', icon: '🧾' },
    { id: 'hoidong', label: 'Hội đồng', icon: '🏛️' },
    { id: 'thongbao', label: 'Thông báo', icon: '📣' },
    { id: 'chutich', label: 'Chủ tịch', icon: '👨‍⚖️' },
    { id: 'thuky', label: 'Thư ký', icon: '📝' },
    { id: 'goiy', label: 'Gợi ý đề tài', icon: '💡' },
    { id: 'nhapDiem', label: 'Chấm điểm', icon: '📊' },
    { id: 'thongke', label: 'Thống kê', icon: '📈' },
    { section: 'Tài khoản' },
    { id: 'profile', label: 'Hồ sơ cá nhân', icon: '👤' },
  ],
  admin: [
    { section: 'Quản trị' },
    { id: 'dashboard', label: 'Tổng quan', icon: '🏠' },
    { id: 'users', label: 'Quản lý người dùng', icon: '👥' },
    { id: 'detai', label: 'Tất cả đề tài', icon: '📋' },
    { id: 'phancong', label: 'Phân công', icon: '🗂️' },
  ],
};

const ROLE_LABELS = { sv: 'Sinh viên', gv: 'Giảng viên', bm: 'Trưởng Bộ Môn', admin: 'Quản trị viên' };
const TOPIC_TYPE_LABELS = {
  ung_dung: 'Đề tài ứng dụng',
  nghien_cuu: 'Đề tài nghiên cứu',
  default: 'Đề tài chung',
};
const SCORE_ROLE_LABELS = {
  HD: 'Giảng viên hướng dẫn',
  PB: 'Giảng viên phản biện',
  CT: 'Chủ tịch hội đồng',
  TV: 'Thành viên hội đồng',
};
const SCORE_TEMPLATE_MAP = {
  default: {
    HD: [
      ['Đặt vấn đề-Lý do chọn đề tài', 1],
      ['Nội dung – Cơ sở lý thuyết', 1],
      ['Nội dung – Phân tích, đánh giá', 2],
      ['Nội dung – Giải pháp', 2],
      ['Hình thức - Cấu trúc, câu văn và từ ngữ', 2],
      ['Hình thức-Trích dẫn và tài liệu tham khảo', 1],
      ['Thái độ', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    PB: [
      ['Đặt vấn đề-Lý do chọn đề tài', 1],
      ['Nội dung – Cơ sở lý thuyết', 1],
      ['Nội dung – Phân tích, đánh giá', 2],
      ['Nội dung – Giải pháp', 2],
      ['Hình thức - Cấu trúc, câu văn và từ ngữ', 2],
      ['Hình thức-Trích dẫn và tài liệu tham khảo', 1],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    CT: [
      ['Slide trình chiếu', 1],
      ['Phong thái thuyết trình', 1.5],
      ['Thời gian', 0.5],
      ['Nội dung', 4],
      ['Trả lời câu hỏi', 2],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    TV: [
      ['Slide trình chiếu', 1],
      ['Phong thái thuyết trình', 1.5],
      ['Thời gian', 0.5],
      ['Nội dung', 4],
      ['Trả lời câu hỏi', 2],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
  },
  ung_dung: {
    HD: [
      ['Đặt vấn đề-Lý do chọn đề tài', 1],
      ['Nội dung – Cơ sở lý thuyết', 1],
      ['Nội dung – Phân tích, đánh giá', 2],
      ['Nội dung – Giải pháp', 2],
      ['Hình thức - Cấu trúc, câu văn và từ ngữ', 2],
      ['Hình thức-Trích dẫn và tài liệu tham khảo', 1],
      ['Thái độ', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    PB: [
      ['Đặt vấn đề-Lý do chọn đề tài', 1],
      ['Nội dung – Cơ sở lý thuyết', 1],
      ['Nội dung – Phân tích, đánh giá', 2],
      ['Nội dung – Giải pháp', 2],
      ['Hình thức - Cấu trúc, câu văn và từ ngữ', 2],
      ['Hình thức-Trích dẫn và tài liệu tham khảo', 1],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    CT: [
      ['Slide trình chiếu', 1],
      ['Phong thái thuyết trình', 1.5],
      ['Thời gian', 0.5],
      ['Nội dung', 4],
      ['Trả lời câu hỏi', 2],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    TV: [
      ['Slide trình chiếu', 1],
      ['Phong thái thuyết trình', 1.5],
      ['Thời gian', 0.5],
      ['Nội dung', 4],
      ['Trả lời câu hỏi', 2],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
  },
  nghien_cuu: {
    HD: [
      ['Tổng quan luận văn -Giới thiệu', 1],
      ['Cơ sở lý thuyết -Lược khảo và mô hình NC', 2],
      ['Phương pháp nghiên cứu', 1],
      ['Kết quả nghiên cứu và thảo luận', 2],
      ['Kết luận và hàm ý quản trị (chính sách)', 1],
      ['Hình thức trình bày, Trích dẫn và tài liệu tham khảo', 2],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    PB: [
      ['Tổng quan luận văn -Giới thiệu', 1],
      ['Cơ sở lý thuyết -Lược khảo và mô hình NC', 2],
      ['Phương pháp nghiên cứu', 1],
      ['Kết quả nghiên cứu và thảo luận', 2],
      ['Kết luận và hàm ý quản trị (chính sách)', 1],
      ['Hình thức trình bày, Trích dẫn và tài liệu tham khảo', 2],
      ['Thái độ', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    CT: [
      ['Slide trình chiếu', 1],
      ['Phong thái thuyết trình', 1.5],
      ['Thời gian', 0.5],
      ['Nội dung', 4],
      ['Trả lời câu hỏi', 2],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
    TV: [
      ['Slide trình chiếu', 1],
      ['Phong thái thuyết trình', 1.5],
      ['Thời gian', 0.5],
      ['Nội dung', 4],
      ['Trả lời câu hỏi', 2],
      ['Tính sáng tạo - tính mới', 1],
      ['Điểm cộng-Viết bằng tiếng Anh (Max 1đ), Viết bài báo khoa học (Max 1đ)', 2],
    ],
  },
};

function normalizeTopicType(topicType) {
  return topicType === 'ung_dung' || topicType === 'nghien_cuu' ? topicType : 'default';
}

function getTopicTypeLabel(topicType) {
  return TOPIC_TYPE_LABELS[normalizeTopicType(topicType)] || TOPIC_TYPE_LABELS.default;
}

function getScoreTemplate(topicType, vaiTro) {
  const normalized = normalizeTopicType(topicType);
  return (SCORE_TEMPLATE_MAP[normalized] && SCORE_TEMPLATE_MAP[normalized][vaiTro]) || SCORE_TEMPLATE_MAP.default[vaiTro] || [];
}

function getScoreSheetTitle(topicType, vaiTro) {
  const normalized = normalizeTopicType(topicType);
  if (vaiTro === 'HD') {
    return normalized === 'nghien_cuu'
      ? 'BIÊN BẢN GIÁO VIÊN HƯỚNG DẪN'
      : 'BIÊN BẢN GIÁO VIÊN HƯỚNG DẪN';
  }
  if (vaiTro === 'PB') {
    return normalized === 'nghien_cuu'
      ? 'BIÊN BẢN GIÁO VIÊN PHẢN BIỆN '
      : 'BIÊN BẢN GIÁO VIÊN PHẢN BIỆN';
  }
  if (vaiTro === 'CT' || vaiTro === 'TV') {
    return 'BIÊN BẢN HỘI ĐỒNG';
  }
  return 'BIÊN BẢN CHẤM ĐIỂM';
}

function mapApiUserToCurrentUser(user) {
  return {
    id: user.id,
    ma: user.ma,
    email: user.email,
    name: user.ho_ten,
    role: user.role,
    role_raw: user.role_raw,
    heDaoTao: user.heDaoTao || "",
    password: "",
    mssv: user.role === "sv" ? user.ma : undefined,
    msgv: user.role !== "sv" ? user.ma : undefined,
  };
}

function openAppScreen() {
  document.getElementById("screen-login").classList.remove("active");
  document.getElementById("screen-app").classList.add("active");
}

function toOauthErrorMessage(code) {
  const mapping = {
    google_oauth_not_configured: "Google OAuth chưa được cấu hình.",
    google_auth_failed: "Đăng nhập Google thất bại.",
    google_userinfo_failed: "Không lấy được thông tin tài khoản Google.",
    google_access_denied: "Không có quyền truy cập hệ thống",
  };
  return mapping[code] || "Đăng nhập OAuth thất bại.";
}

function clearAuthQueryParams() {
  const url = new URL(window.location.href);
  ["oauth", "error", "page"].forEach((key) => url.searchParams.delete(key));
  const next = url.pathname + (url.search ? url.search : "") + (url.hash || "");
  window.history.replaceState({}, document.title, next);
}

async function establishSessionFromApi() {
  const out = await apiRequest("/api/me", { method: "GET" });
  const mapped = mapApiUserToCurrentUser(out.data.user);
  DB.currentUser = mapped;
  localStorage.setItem("currentUser", JSON.stringify(mapped));
  openAppScreen();
  await initApp();
  return mapped;
}

function startGoogleLogin() {
  window.location.href = `${API_BASE}/api/auth/google/login`;
}

async function doLogin() {
  try {
    const ma = toMaFromLoginInput(document.getElementById("login-email").value);
    const mat_khau = document.getElementById("login-password").value.trim();
    const out = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ ma, mat_khau }),
    });
    const mapped = mapApiUserToCurrentUser(out.data.user);
    DB.currentUser = mapped;
    localStorage.setItem("currentUser", JSON.stringify(mapped));
    openAppScreen();
    await initApp();
    if (mapped.role === "sv") navigateTo("dashboard");
    if (mapped.role === "gv") navigateTo("huongdan");
    if (mapped.role === "bm") navigateTo("duyetde");
    toast("Đăng nhập thành công");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function doLogout() {
  try {
    await apiRequest("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } catch (_) {}
  DB.currentUser = null;
  localStorage.removeItem("currentUser");
  document.getElementById("screen-app").classList.remove("active");
  document.getElementById("screen-login").classList.add("active");
  document.getElementById("notif-panel").classList.remove("open");
  toast("Đăng xuất thành công");
}

async function changePassword() {
  const oldEl = document.getElementById("pw-old");
  const newEl = document.getElementById("pw-new");
  const confirmEl = document.getElementById("pw-confirm");
  if (!oldEl || !newEl || !confirmEl) {
    toast("Không tìm thấy form đổi mật khẩu", "error");
    return;
  }

  const old_password = oldEl.value.trim();
  const new_password = newEl.value.trim();
  const confirm_password = confirmEl.value.trim();

  if (!old_password || !new_password) {
    toast("Thiếu mật khẩu hiện tại hoặc mật khẩu mới", "error");
    return;
  }
  if (new_password.length < 6) {
    toast("Mật khẩu tối thiểu 6 ký tự", "error");
    return;
  }
  if (new_password !== confirm_password) {
    toast("Mật khẩu xác nhận không khớp", "error");
    return;
  }

  try {
    await apiRequest("/api/me/password", {
      method: "POST",
      body: JSON.stringify({ old_password, new_password, confirm_password }),
    });
    oldEl.value = "";
    newEl.value = "";
    confirmEl.value = "";
    toast("Cập nhật mật khẩu thành công");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function initApp() {
  await syncFromServer();
  await loadNotifications();
  const u = DB.currentUser;
  document.getElementById('sb-name').textContent = u.name;
  document.getElementById('sb-email').textContent = u.email;
  document.getElementById('sb-role').textContent = ROLE_LABELS[u.role] || u.role;
  document.getElementById('topbar-user').textContent = u.name;
  buildSidebar(u.role);
  try {
    updateNotifDot();
  } catch (err) {
    console.error('updateNotifDot failed', err);
  }
  try {
    await buildNotifPanel();
  } catch (err) {
    console.error('buildNotifPanel failed', err);
  }
  navigateTo('dashboard');
}

function buildSidebar(role) {
  const nav = document.getElementById('sidebar-nav');
  const items = NAV_CONFIG[role] || NAV_CONFIG.gv;
  nav.innerHTML = items.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    const pending = item.badge ? getPendingCount() : 0;
    const badge = pending > 0 ? `<span class="nav-item-badge">${pending}</span>` : '';
    return `<div class="nav-item" id="nav-${item.id}" onclick="navigateTo('${item.id}')">
      <span class="nav-item-icon">${item.icon}</span>${item.label}${badge}
    </div>`;
  }).join('');
  applyIconsToDom(nav);
}

function getPendingCount() {
  const u = DB.currentUser;
  if (u.role === 'sv') return 0;
  if (u.role === 'gv') return DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_duyet').length;
  if (u.role === 'bm') return DB.bcttList.filter(b => b.trangThai === 'gv_xac_nhan').length;
  return 0;
}

function navigateTo(page) {
  DB.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  ['page-nhapDiem', 'page-phanbien', 'page-hoidong'].forEach((id) => {
    if (id !== `page-${page}`) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    }
  });
  // Hide all pages
  document.querySelectorAll('[id^="page-"]').forEach(el => el.style.display = 'none');
  const currentPageEl = document.getElementById('page-' + page);
  if (currentPageEl) currentPageEl.style.display = 'block';

  const titles = {
    dashboard: 'Tổng quan', bctt: 'Đăng ký BCTT', kltn: 'Đăng ký KLTN',
    detai: 'Quản lý đề tài', duyetde: 'Duyệt đề tài', phancong: 'Phân công PB / Hội đồng',
    nhapDiem: 'Nhập điểm', hoithuong: 'Hội đồng', users: 'Quản lý người dùng', profile: 'Hồ sơ cá nhân',
    theodoi: 'Theo dõi trạng thái', huongdan: 'Hướng dẫn', phanbien: 'Phản biện', hoidong: 'Hội đồng',
    thongbao: 'Thông báo',
    chutich: 'Chủ tịch hội đồng', thuky: 'Thư ký hội đồng', goiy: 'Gợi ý đề tài', thongke: 'Thống kê',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const renders = {
    dashboard: renderDashboard, bctt: renderBCTT, kltn: renderKLTN,
    detai: renderDeTai, duyetde: renderDuyetDe, phancong: renderPhanCong,
    nhapDiem: renderNhapDiem, users: renderUsers, profile: renderProfile,
    theodoi: renderTheoDoi, huongdan: renderHuongDan, phanbien: renderPhanBien, hoidong: renderHoiDong,
    thongbao: renderThongBao,
    chutich: renderChuTich, thuky: renderThuKy, goiy: renderGoiY, thongke: renderThongKe,
  };
  if (!renders[page]) return;
  try {
    renders[page]();
  } catch (err) {
    console.error(`Render failed for page "${page}"`, err);
    if (currentPageEl) {
      currentPageEl.innerHTML = `
        <div class="card" style="border:1px solid #FF8F73;background:#FFEBE6">
          <div style="font-size:18px;font-weight:800;color:#BF2600;margin-bottom:8px">Không tải được nội dung tab</div>
          <div style="font-size:13px;color:#7a1f10;line-height:1.6">
            <div><strong>Tab:</strong> ${escapeHtml(titles[page] || page)}</div>
            <div><strong>Lỗi:</strong> ${escapeHtml(err?.message || String(err))}</div>
          </div>
        </div>`;
    }
    toast(`Lỗi hiển thị tab: ${err?.message || err}`, "error");
  }
  applyIconsToDom(currentPageEl);
}

function navigateToDetaiTab(tabId) {
  DB.nextDetaiTab = tabId;
  navigateTo('detai');
}

// ============================================================
// NOTIF PANEL
// ============================================================
async function toggleNotif() {
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    await loadNotifications();
    await buildNotifPanel();
    // Với GV vẫn mark read trong RAM như cũ
    if (DB.currentUser && DB.currentUser.role !== 'sv') {
      DB.notifications.filter(n => n.toEmail === DB.currentUser.email).forEach(n => n.read = true);
      updateNotifDot();
    }
  }
}
async function buildNotifPanel() {
  const el = document.getElementById('notif-list');
  el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Đang tải...</div>';

  const u = DB.currentUser;
  if (u && u.role === 'sv') {
    try {
      const res = await apiRequest("/api/thong-bao", { method: "GET" });
      const list = res.data?.thong_bao || [];
      if (!list.length) {
        el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Không có thông báo</div>';
        return;
      }
      const unreadCount = list.filter(n => !n.da_doc).length;
      el.innerHTML = `
        <div class="notif-panel-header">
          <div>
            <div class="notif-panel-title">Thông báo của bạn</div>
            <div class="notif-panel-subtitle">${unreadCount} thông báo chưa đọc</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm${unreadCount === 0 ? ' btn-disabled' : ''}" onclick="markAllNotifRead()" ${unreadCount === 0 ? 'disabled' : ''}>✓ Đánh dấu tất cả đã đọc</button>
        </div>
      ` + list.map(n => {
        const chuaDoc = !n.da_doc;
        const tieuDe = n.loai === 'tu_choi_gvhd'
          ? 'Giảng viên HD yêu cầu chỉnh sửa lại'
          : n.loai === 'tu_choi_cthd'
            ? 'Chủ tịch HĐ không đồng ý báo cáo'
            : n.loai === 'gui_role'
              ? 'Thông báo chung'
              : 'Thông báo mới';
        const contentLabel = n.loai === 'gui_role' ? 'Nội dung thông báo' : 'Lý do / Yêu cầu';
        return `
          <div class="notif-item ${chuaDoc ? 'unread' : 'read'}" onclick="openNotifDetail('${n.id}')">
            <div class="notif-item-title">${tieuDe}</div>
            <div class="notif-item-meta">Từ <strong>${escapeHtml(n.ten_nguoi_gui) || 'Giảng viên'}</strong> · ${escapeHtml(n.tao_luc)}</div>
            <div class="notif-item-body notif-item-highlight">
              <strong>${contentLabel}:</strong>
              <div class="notif-message-box">${escapeHtml(n.noi_dung) || '(Không có nội dung)'}</div>
            </div>
          </div>`;
      }).join('');

      const chuaDocCount = unreadCount;
      document.getElementById('notif-dot').style.display = chuaDocCount > 0 ? 'block' : 'none';
    } catch (err) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--accent);font-size:13px">Lỗi tải thông báo</div>';
    }
    return;
  }

  const list = DB.notifications.filter(n => n.toEmail === u.email);
  if (!list.length) { el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Không có thông báo</div>'; return; }
  el.innerHTML = list.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="openNotifDetail('${n.id}')">
      <div class="notif-item-title">${escapeHtml(n.title)}</div>
      <div class="notif-item-body">${escapeHtml(n.body)}</div>
      <div class="notif-item-time">${escapeHtml(n.time)}</div>
    </div>`).join('');
}

async function markOneNotifRead(id) {
  try {
    await apiRequest('/api/thong-bao/doc', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    await loadNotifications();
    await buildNotifPanel();
    updateNotifDot();
  } catch (err) {
    console.error('Không thể đánh dấu thông báo đã đọc', err);
  }
}

async function markAllNotifRead() {
  try {
    await apiRequest('/api/thong-bao/doc', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await loadNotifications();
    await buildNotifPanel();
    updateNotifDot();
    toast('Đã đánh dấu tất cả thông báo là đã đọc', 'success');
  } catch (err) {
    console.error('Không thể đánh dấu tất cả thông báo đã đọc', err);
    toast('Không thể đánh dấu tất cả thông báo đã đọc', 'error');
  }
}

function openNotifDetail(id) {
  const note = DB.notifications.find((n) => String(n.id) === String(id));
  if (!note) return;
  const title = note.loai === 'tu_choi_gvhd'
    ? 'Giảng viên HD yêu cầu chỉnh sửa lại'
    : note.loai === 'tu_choi_cthd'
      ? 'Chủ tịch HĐ không đồng ý báo cáo'
      : note.loai === 'gui_role'
        ? 'Thông báo chung'
        : 'Thông báo mới';
  const contentLabel = note.loai === 'gui_role' ? 'Nội dung thông báo' : 'Lý do / Yêu cầu';
  showModal(`
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(title)}</div>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>
      <div class="modal-body">
        <div class="notif-detail-meta"><strong>Người gửi:</strong> ${escapeHtml(note.ten_nguoi_gui || 'Giảng viên')}</div>
        <div class="notif-detail-meta"><strong>Thời gian:</strong> ${escapeHtml(note.tao_luc)}</div>
        <div class="notif-detail-content">
          <h4>${contentLabel}</h4>
          <p>${escapeHtml(note.noi_dung || '(Không có nội dung)')}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="closeModalForce()">Đóng</button>
      </div>
    </div>`);
  if (!note.da_doc) {
    markOneNotifRead(id);
  }
}

function getStudentUploadMa() {
  const u = DB.currentUser || {};
  return u.ma || u.mssv || "";
}

function findBcttRecord(recordId) {
  return DB.bcttList.find((b) => String(b.id) === String(recordId));
}

function findKltnRecord(recordId) {
  return DB.kltnList.find((k) => String(k.id) === String(recordId));
}

async function refreshCurrentView() {
  await syncFromServer();
  navigateTo(DB.currentPage || "dashboard");
}

async function submitBCTT() {
  const ten = (document.getElementById("f-tenDeTai")?.value || "").trim();
  const cong_ty = (document.getElementById("f-congty")?.value || "").trim();
  const linh_vuc = (document.getElementById("f-mang")?.value || "").trim();
  const loai_de_tai = (document.getElementById("f-topicType")?.value || "").trim();
  const gv_id = document.getElementById("f-gv")?.value || "";
  const dot_id = document.getElementById("f-dot")?.value || "";
  if (!ten || !cong_ty || !linh_vuc || !loai_de_tai || !gv_id || !dot_id) {
    toast("Vui lòng nhập đủ thông tin đăng ký BCTT", "error");
    return;
  }
  try {
    await apiRequest("/api/bctt/register", {
      method: "POST",
      body: JSON.stringify({ ten_de_tai: ten, ten_cong_ty: cong_ty, linh_vuc, loai_de_tai, gv_id, dot_id }),
    });
    toast("Gửi đăng ký BCTT thành công");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function submitKLTN() {
  const ten = (document.getElementById("fk-ten")?.value || "").trim();
  const linh_vuc = (document.getElementById("fk-mang")?.value || "").trim();
  const loai_de_tai = (document.getElementById("fk-topicType")?.value || "").trim();
  const gvEmail = document.getElementById("fk-gvhd")?.value || "";
  const dot_id = document.getElementById("fk-dot")?.value || "";
  const gv = getUser(gvEmail);
  const gv_id = gv ? gv.id : "";
  if (loai_de_tai !== "ung_dung" && loai_de_tai !== "nghien_cuu") {
    toast("BCTT của bạn chưa có loại đề tài hợp lệ để kế thừa sang KLTN", "error");
    return;
  }
  if (!ten || !linh_vuc || !loai_de_tai || !gv_id || !dot_id) {
    toast("Vui lòng nhập đủ thông tin đăng ký KLTN", "error");
    return;
  }
  try {
    await apiRequest("/api/kltn/register", {
      method: "POST",
      body: JSON.stringify({ ten_de_tai: ten, linh_vuc, loai_de_tai, gv_id, dot_id }),
    });
    toast("Gửi đăng ký KLTN thành công");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderTopicTypesByField() {
  const fieldSelect = document.getElementById('f-mang');
  const typeSelect = document.getElementById('f-topicType');
  if (!fieldSelect || !typeSelect) return;
  
  const selectedField = fieldSelect.value;
  const types = selectedField ? getTopicTypesForField(selectedField) : ['ung_dung', 'nghien_cuu'];
  
  typeSelect.innerHTML = '<option value="">-- Chọn loại đề tài --</option>';
  if (types.includes('ung_dung')) typeSelect.innerHTML += '<option value="ung_dung">Đề tài ứng dụng</option>';
  if (types.includes('nghien_cuu')) typeSelect.innerHTML += '<option value="nghien_cuu">Đề tài nghiên cứu</option>';
  typeSelect.value = '';
}

function renderKLTNTopicTypesByField() {
  const fieldSelect = document.getElementById('fk-mang');
  const typeSelect = document.getElementById('fk-topicType');
  if (!fieldSelect || !typeSelect) return;
  
  const selectedField = fieldSelect.value;
  const types = selectedField ? getTopicTypesForField(selectedField) : ['ung_dung', 'nghien_cuu'];
  
  const currentValue = typeSelect.value;
  typeSelect.innerHTML = '<option value="">-- Chọn loại đề tài --</option>';
  if (types.includes('ung_dung')) typeSelect.innerHTML += '<option value="ung_dung">Đề tài ứng dụng</option>';
  if (types.includes('nghien_cuu')) typeSelect.innerHTML += '<option value="nghien_cuu">Đề tài nghiên cứu</option>';
  if (types.includes(currentValue)) {
    typeSelect.value = currentValue;
  }
}

function renderGVOptionsByField() {
  const gvSelect = document.getElementById("f-gv");
  const dotSelect = document.getElementById("f-dot");
  if (!gvSelect || !dotSelect) return;

  const dotId = dotSelect.value;
  const major = (document.getElementById("f-mang")?.value || "").trim();
  const he = normalizeStudentSlotHe(DB.currentUser);

  if (!dotId) {
    gvSelect.innerHTML = `<option value="">-- Chọn đợt trước --</option>`;
    return;
  }

  const studentMajor = getCurrentStudentMajor();
  const nganhSelect = document.getElementById('f-nganh');
  if (nganhSelect) {
    const nganhText = (studentMajor || '').trim();
    nganhSelect.innerHTML = nganhText
      ? `<option value="${escapeHtml(nganhText)}">${escapeHtml(nganhText)}</option>`
      : '<option value="">-- Chưa có ngành --</option>';
  }

  const candidates = DB.users.filter((u) => {
    if (u.role !== "gv" && u.role !== "bm") return false;
    const primaryFields = String(u.linhVucPhuTrach || u.linh_vuc_phu_trach || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (major) {
      if (!primaryFields.length || !primaryFields.some((field) => majorMatches(field, major))) {
        return false;
      }
    }
    const slot = (DB.gvSlots || []).find(
      (s) => Number(s.gvId) === Number(u.id) && String(s.dotId) === String(dotId) && String(s.heDaoTao || "DaiTra") === he
    );
    return Boolean(slot && slot.duyetTbm && Number(slot.slotConLai || 0) > 0);
  });

  if (!candidates.length) {
    gvSelect.innerHTML = `<option value="">-- Không có GV phù hợp cho đợt này --</option>`;
    return;
  }

  gvSelect.innerHTML =
    `<option value="">-- Chọn giảng viên hướng dẫn --</option>` +
    candidates
      .map((u) => {
        const slot = gvBcttSlotRow(u.id, dotId);
        const primaryField = String(u.linhVucPhuTrach || u.linh_vuc_phu_trach || '').trim();
        const majors = primaryField || (u.chuyenMon || []).join(", ");
        const quota = slot ? slot.slotConLai : 0;
        return `<option value="${u.id}">${escapeHtml(u.name)}${majors ? ` - ${escapeHtml(majors)}` : ""} (${quota} slot)</option>`;
      })
      .join("");
}

async function uploadRegistrationFile(dangKyId, loaiFile, file) {
  const u = DB.currentUser || {};
  const authHeaders = {};
  if (u.id) authHeaders["X-User-Id"] = String(u.id);
  if (u.role_raw || u.role) authHeaders["X-User-Role"] = String(u.role_raw || toApiRole(u.role));

  const formData = new FormData();
  formData.append("dang_ky_id", String(dangKyId));
  formData.append("loai_file", loaiFile);
  formData.append("ma_sv", getStudentUploadMa());
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders,
    body: formData,
  });
  const body = await res.json().catch(() => ({ success: false, message: "Upload thất bại" }));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || "Upload thất bại");
  }
  return body.data || {};
}

function chooseFileAndUpload(recordId, loaiFile) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.doc,.docx";
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      await uploadRegistrationFile(recordId, loaiFile, file);
      toast("Upload file thành công");
      await refreshCurrentView();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  input.click();
}

function fakeUpload(kind, recordId) {
  const record = findBcttRecord(recordId);
  if (!record) {
    toast("Không tìm thấy hồ sơ BCTT", "error");
    return;
  }
  const loaiFileMap = {
    "bctt-bc": "bctt_baocao",
    "bctt-xn": "bctt_xacnhan",
    "bctt-turnitin": "turnitin_bctt",
  };
  const loaiFile = loaiFileMap[kind];
  if (!loaiFile) {
    toast("Loại file upload không hợp lệ", "error");
    return;
  }
  chooseFileAndUpload(record.dangKyId || extractId(record.id), loaiFile);
}

function fakeUploadKLTN(recordId, field) {
  const record = findKltnRecord(recordId);
  if (!record) {
    toast("Không tìm thấy hồ sơ KLTN", "error");
    return;
  }
  const loaiFileMap = {
    fileBaiWord: "kltn_bai_word",
    fileBai: "kltn_bai_pdf",
    fileBaiChinhSua: "kltn_chinhsua",
    fileGiaiTrinh: "bien_ban_giai_trinh",
  };
  const loaiFile = loaiFileMap[field];
  if (!loaiFile) {
    toast("Loại file upload không hợp lệ", "error");
    return;
  }
  chooseFileAndUpload(record.dangKyId || extractId(record.id), loaiFile);
}

async function hoanTatBCTT(recordId) {
  const record = findBcttRecord(recordId);
  if (!record) {
    toast("Không tìm thấy hồ sơ BCTT", "error");
    return;
  }
  try {
    await apiRequest("/api/bctt/submit", {
      method: "POST",
      body: JSON.stringify({ dang_ky_id: record.dangKyId || extractId(record.id) }),
    });
    toast("Đã nộp hồ sơ BCTT");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function hoanTatKLTN(recordId) {
  const record = findKltnRecord(recordId);
  if (!record) {
    toast("Không tìm thấy hồ sơ KLTN", "error");
    return;
  }
  try {
    await apiRequest("/api/kltn/submit", {
      method: "POST",
      body: JSON.stringify({ dang_ky_id: record.dangKyId || extractId(record.id) }),
    });
    toast("Đã nộp bài KLTN");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function duyetBCTT(recordId, dongY) {
  const record = findBcttRecord(recordId);
  if (!record) {
    toast("Không tìm thấy đề tài BCTT", "error");
    return;
  }
  const dangKyId = record.dangKyId || extractId(record.id);
  if (!dangKyId) {
    toast("Mã đăng ký không hợp lệ", "error");
    return;
  }
  try {
    await apiRequest("/api/bctt/approve", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_ids: [dangKyId],
        action: dongY ? "dong_y" : "tu_choi",
      }),
    });
    toast(dongY ? "Đã duyệt đề tài BCTT" : "Đã từ chối đề tài BCTT");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function duyetKLTN(recordId, dongY) {
  const record = findKltnRecord(recordId);
  if (!record) {
    toast("Không tìm thấy đề tài KLTN", "error");
    return;
  }
  const dangKyId = record.dangKyId || extractId(record.id);
  if (!dangKyId) {
    toast("Mã đăng ký không hợp lệ", "error");
    return;
  }
  try {
    await apiRequest("/api/kltn/approve", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_ids: [dangKyId],
        action: dongY ? "dong_y" : "tu_choi",
      }),
    });
    toast(dongY ? "Đã duyệt đề tài KLTN" : "Đã từ chối đề tài KLTN");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function chamDiemBCTT(bcttRecord) {
  const diem = document.getElementById('bctt-diem').value;
  const nhanXet = document.getElementById('bctt-nhanxet').value;
  
  // Validate điểm
  if (!diem) {
    toast('Vui lòng nhập điểm', 'error');
    return;
  }
  const diemNum = parseFloat(diem);
  if (isNaN(diemNum) || diemNum < 0 || diemNum > 10) {
    toast('Điểm phải từ 0 đến 10', 'error');
    return;
  }
  
  // Get dang_ky_id
  const dangKyId = bcttRecord.dangKyId || extractId(bcttRecord.id);
  if (!dangKyId) {
    toast('Mã đăng ký không hợp lệ', 'error');
    return;
  }
  
  try {
    await apiRequest("/api/bctt/grade", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_id: dangKyId,
        diem: diemNum,
        nhan_xet: nhanXet,
      }),
    });
    toast('✅ Lưu điểm BCTT thành công');
    await refreshCurrentView();
    closeModalForce();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function chamBCTT(recordId) {
  const record = findBcttRecord(recordId);
  if (!record) {
    toast('Không tìm thấy hồ sơ BCTT', 'error');
    return;
  }

  const diem = document.getElementById(`bctt-diem-${recordId}`)?.value || '';
  const nhanXet = document.getElementById(`bctt-nhanxet-${recordId}`)?.value || '';

  if (!diem) {
    toast('Vui lòng nhập điểm', 'error');
    return;
  }

  const diemNum = parseFloat(diem);
  if (isNaN(diemNum) || diemNum < 0 || diemNum > 10) {
    toast('Điểm phải từ 0 đến 10', 'error');
    return;
  }

  const dangKyId = record.dangKyId || extractId(record.id);
  if (!dangKyId) {
    toast('Mã đăng ký không hợp lệ', 'error');
    return;
  }

  try {
    await apiRequest('/api/bctt/grade', {
      method: 'POST',
      body: JSON.stringify({
        dang_ky_id: dangKyId,
        diem: diemNum,
        nhan_xet: nhanXet,
      }),
    });
    toast('✅ Lưu điểm BCTT thành công');
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function saveScore(vaiTro, dangKyId) {
  const kltnObj = DB.kltnList.find(k => k.dangKyId == dangKyId);
  if (!kltnObj) {
    toast('Không tìm thấy KLTN', 'error');
    return;
  }
  const inputId = `diem-${vaiTro.toLowerCase()}-${kltnObj.id}`;
  const nhanXetId = `nhanxet-${vaiTro.toLowerCase()}-${kltnObj.id}`;
  const diem = document.getElementById(inputId).value;
  const nhanXetText = document.getElementById(nhanXetId).value;
  
  if (!diem) {
    toast('Vui lòng nhập điểm', 'error');
    return;
  }
  const diemNum = parseFloat(diem);
  if (isNaN(diemNum) || diemNum < 0 || diemNum > 10) {
    toast('Điểm phải từ 0 đến 10', 'error');
    return;
  }
  
  // Parse nhan_xet and cau_hoi from textarea
  let nhan_xet = nhanXetText;
  let cau_hoi = '';
  const cauHoiMarker = '\n\n— Câu hỏi —\n';
  const idx = nhanXetText.indexOf(cauHoiMarker);
  if (idx !== -1) {
    nhan_xet = nhanXetText.substring(0, idx);
    cau_hoi = nhanXetText.substring(idx + cauHoiMarker.length);
  }
  
  try {
    await apiRequest("/api/kltn/grade", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_id: dangKyId,
        vai_tro: vaiTro,
        diem: diemNum,
        nhan_xet: nhan_xet,
        cau_hoi: cau_hoi,
      }),
    });
    toast(`✅ Lưu điểm ${vaiTro} thành công`);
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function saveScoreHD(dangKyId) {
  return saveScore('HD', dangKyId);
}

async function saveScorePB(dangKyId) {
  return saveScore('PB', dangKyId);
}

async function saveScoreCT(dangKyId) {
  return saveScore('CT', dangKyId);
}

// ============================================================
// PAGES RENDER (BCTT, KLTN, DUYỆT, ... )
// ============================================================

function renderDashboard() {
  const u = DB.currentUser;
  const el = document.getElementById('page-dashboard');
  let html = `<div class="page-header"><h1>Xin chào, ${u.name} 👋</h1><p>Hệ thống quản lý BCTT & KLTN – Khoa FE, UTE</p></div>`;

  if (u.role === 'sv') {
    const myBCTT = getBCTTBySV(u.email);
    const myKLTN = getKLTNBySV(u.email);
    html += `<div class="stats-grid">
      <div class="stat-card" onclick="navigateTo('bctt')" style="cursor:pointer"><div class="stat-icon blue">📝</div><div><div class="stat-value">${myBCTT.length}</div><div class="stat-label">BCTT đã đăng ký</div></div></div>
      <div class="stat-card" onclick="navigateTo('kltn')" style="cursor:pointer"><div class="stat-icon green">🎓</div><div><div class="stat-value">${myKLTN.length}</div><div class="stat-label">KLTN đã đăng ký</div></div></div>
      <div class="stat-card" onclick="toggleNotif()" style="cursor:pointer"><div class="stat-icon orange">📬</div><div><div class="stat-value">${getUnreadNotifs(u.email).length}</div><div class="stat-label">Thông báo mới</div></div></div>
      <div class="stat-card" onclick="navigateTo('theodoi')" style="cursor:pointer"><div class="stat-icon red">📅</div><div><div class="stat-value">${DB.dotDangKy.filter(d => d.trangThai === 'dang_mo').length}</div><div class="stat-label">Đợt đang mở</div></div></div>
    </div>`;

    const bctt = myBCTT[0];
    const kltn = myKLTN[0];
    html += `<div class="grid-2">
      <div class="card"><div class="card-header"><div><div class="card-title">🗺️ Tiến độ BCTT</div></div></div>`;
    if (bctt) {
      const ST = bctt.trangThai;
      const steps = [
        { label: 'Đăng ký',    done: true },
        { label: 'GV duyệt',   done: ['gv_xac_nhan','cho_cham','pass','fail'].includes(ST) },
        { label: 'Nộp hồ sơ',  done: ['cho_cham','pass','fail'].includes(ST) },
        { label: 'GV chấm',    done: ['pass','fail'].includes(ST) },
        { label: 'Hoàn tất',   done: ST === 'pass' },
      ];
      html += `<div style="margin-bottom:16px">${statusBadge(ST)}</div>`;
      html += `<div class="progress-steps">${steps.map((s,i) => `
        <div class="step">
          <div class="step-circle ${s.done ? 'done' : i === steps.findIndex(x=>!x.done) ? 'active' : ''}">${s.done ? '✓' : i+1}</div>
          <span class="step-label">${s.label}</span>
        </div>${i < steps.length-1 ? `<div class="step-line ${s.done ? 'done' : ''}"></div>` : ''}`).join('')}</div>`;
      html += `<div class="timeline">
        <div class="tl-item"><div class="tl-dot done"></div><div class="tl-title">Đăng ký đề tài</div><div class="tl-desc">${escapeHtml(bctt.tenDeTai)}</div></div>
        ${['gv_xac_nhan','cho_cham','pass','fail'].includes(ST) ? `<div class="tl-item"><div class="tl-dot done"></div><div class="tl-title">GV xác nhận</div><div class="tl-desc">${escapeHtml(getUser(bctt.gvEmail)?.name||'')}</div></div>` : ''}
        ${['cho_cham','pass','fail'].includes(ST) ? `<div class="tl-item"><div class="tl-dot done"></div><div class="tl-title">Đã nộp hồ sơ</div><div class="tl-desc">Chờ GV chấm điểm</div></div>` : ''}
        ${ST === 'pass' ? `<div class="tl-item"><div class="tl-dot done"></div><div class="tl-title">BCTT đạt ✅</div><div class="tl-desc">Đủ điều kiện đăng ký KLTN</div></div>` : ''}
        ${ST === 'fail' ? `<div class="tl-item"><div class="tl-dot" style="background:var(--accent);border-color:var(--accent)"></div><div class="tl-title">BCTT chưa đạt ❌</div><div class="tl-desc">Cần nộp lại hồ sơ</div></div>` : ''}
      </div>`;
    } else { html += `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Chưa đăng ký BCTT</div><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="navigateTo('bctt')">Đăng ký ngay</button></div>`; }
    html += `</div>`;

    html += `<div class="card"><div class="card-header"><div><div class="card-title">📅 Đợt đăng ký</div></div></div>`;
    html += DB.dotDangKy.map(d => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <div><div style="font-size:13px;font-weight:600">${d.ten}</div><div style="font-size:11px;color:var(--text3)">${d.batDau} → ${d.ketThuc}</div></div>
      <span class="badge ${d.trangThai === 'dang_mo' ? 'badge-green' : 'badge-gray'}">${d.trangThai === 'dang_mo' ? '🟢 Đang mở' : '🔒 Sắp mở'}</span>
    </div>`).join('');
    html += `</div></div>`;

    if (kltn && ['bao_ve', 'hoan_thanh', 'pass', 'fail'].includes(kltn.trangThai)) {
      const gvhdStatus = kltn.xacNhanGVHD
        ? '<span style="color:#16a34a;font-weight:700">✅ Đã đồng ý</span>'
        : '<span style="color:#d97706;font-weight:700">⏳ Chưa đồng ý</span>';
      const cthdStatus = kltn.xacNhanCTHD
        ? '<span style="color:#16a34a;font-weight:700">✅ Đã đồng ý</span>'
        : '<span style="color:#d97706;font-weight:700">⏳ Chưa đồng ý</span>';
      html += `<div class="card" style="margin-top:20px">
        <div class="card-header"><div><div class="card-title">🛠️ Trạng thái duyệt chỉnh sửa KLTN</div></div><button class="btn btn-ghost btn-sm" onclick="navigateTo('kltn')">Xem chi tiết</button></div>
        <div class="grid-2" style="margin-top:8px">
          <div style="padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg)">
            <div style="font-size:12px;color:var(--text3);margin-bottom:6px">GVHD</div>
            <div style="font-size:15px">${gvhdStatus}</div>
          </div>
          <div style="padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg)">
            <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Chủ tịch hội đồng</div>
            <div style="font-size:15px">${cthdStatus}</div>
          </div>
        </div>
        ${(kltn.tuChoiGVHD !== undefined && kltn.tuChoiGVHD !== null) || (kltn.tuChoiCTHD !== undefined && kltn.tuChoiCTHD !== null) ? `
          <div style="margin-top:14px;padding:12px 16px;border-radius:var(--radius);background:#FFF7D6;border:1px solid #F5CD47">
            <div style="font-size:13px;font-weight:700;color:#974F0C;margin-bottom:6px">Yêu cầu chỉnh sửa hiện tại</div>
            ${kltn.tuChoiGVHD !== undefined && kltn.tuChoiGVHD !== null ? `<div style="font-size:13px;color:#974F0C;margin-bottom:4px">GVHD: ${escapeHtml(kltn.tuChoiGVHD || 'Cần chỉnh sửa và nộp lại.')}</div>` : ''}
            ${kltn.tuChoiCTHD !== undefined && kltn.tuChoiCTHD !== null ? `<div style="font-size:13px;color:#974F0C">Chủ tịch HĐ: ${escapeHtml(kltn.tuChoiCTHD || 'Cần chỉnh sửa và nộp lại.')}</div>` : ''}
          </div>
        ` : ''}
      </div>`;
    }

  } else if (u.role === 'gv') {
    const pending = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_duyet').length;
    const total = DB.bcttList.filter(b => b.gvEmail === u.email).length;
    const kltnHD = DB.kltnList.filter(k => k.gvHDEmail === u.email).length;
    html += `<div class="stats-grid">
      <div class="stat-card" onclick="navigateTo('huongdan')" style="cursor:pointer"><div class="stat-icon orange">⏳</div><div><div class="stat-value">${pending}</div><div class="stat-label">Chờ duyệt BCTT</div></div></div>
      <div class="stat-card" onclick="navigateTo('detai')" style="cursor:pointer"><div class="stat-icon blue">📝</div><div><div class="stat-value">${total}</div><div class="stat-label">BCTT đang HD</div></div></div>
      <div class="stat-card" onclick="navigateToDetaiTab('tab-kltn-list')" style="cursor:pointer"><div class="stat-icon green">🎓</div><div><div class="stat-value">${kltnHD}</div><div class="stat-label">KLTN đang HD</div></div></div>
      <div class="stat-card" onclick="navigateTo('profile')" style="cursor:pointer"><div class="stat-icon red">📊</div><div><div class="stat-value">${u.quota || 0}</div><div class="stat-label">Quota còn lại</div></div></div>
    </div>`;
    html += `<div class="card"><div class="card-header"><div class="card-title">📋 BCTT chờ duyệt</div><button class="btn btn-primary btn-sm" onclick="navigateTo('duyetde')">Xem tất cả</button></div>`;
    const pendingList = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_duyet');
    if (pendingList.length) {
      html += `<div class="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Đề tài</th><th>Ngày đăng ký</th><th>Thao tác</th></tr></thead><tbody>`;
      html += pendingList.map(b => {
        const sv = getUser(b.svEmail);
        return `<tr><td><div style="font-weight:600">${sv?.name}</div><div style="font-size:11px;color:var(--text3)">${b.svEmail}</div></td>
          <td><div style="font-weight:500;max-width:240px;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div><div style="font-size:11px;color:var(--text3)">${escapeHtml(b.mangDeTai)}</div></td>
          <td style="font-size:12px;color:var(--text3)">${b.ngayDangKy}</td>
          <td><div class="action-row">
            <button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁</button>
            <button class="btn btn-success btn-sm" onclick="duyetBCTT('${b.id}',true)">✓ Duyệt</button>
            <button class="btn btn-danger btn-sm" onclick="duyetBCTT('${b.id}',false)">✗ Từ chối</button>
          </div></td></tr>`;
      }).join('');
      html += `</tbody></table></div>`;
    } else { html += `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Không có BCTT chờ duyệt</div></div>`; }
    html += `</div>`;

  } else if (u.role === 'bm') {
    const needPB = DB.bcttList.filter(b => b.trangThai === 'gv_xac_nhan').length;
    const needHD = DB.kltnList.filter(k => !k.hoiDong && k.trangThai !== 'hoan_thanh').length;
    html += `<div class="stats-grid">
      <div class="stat-card" onclick="navigateTo('phancong')" style="cursor:pointer"><div class="stat-icon orange">⏳</div><div><div class="stat-value">${needPB}</div><div class="stat-label">Cần phân công PB</div></div></div>
      <div class="stat-card" onclick="navigateTo('phancong')" style="cursor:pointer"><div class="stat-icon blue">👥</div><div><div class="stat-value">${needHD}</div><div class="stat-label">Cần lập HĐ KLTN</div></div></div>
      <div class="stat-card" onclick="navigateToDetaiTab('tab-bctt-list')" style="cursor:pointer"><div class="stat-icon green">📝</div><div><div class="stat-value">${DB.bcttList.length}</div><div class="stat-label">Tổng BCTT</div></div></div>
      <div class="stat-card" onclick="navigateToDetaiTab('tab-kltn-list')" style="cursor:pointer"><div class="stat-icon red">🎓</div><div><div class="stat-value">${DB.kltnList.length}</div><div class="stat-label">Tổng KLTN</div></div></div>
    </div>`;
  } else {
    html += `<div class="stats-grid">
      <div class="stat-card" onclick="navigateTo('users')" style="cursor:pointer"><div class="stat-icon blue">👤</div><div><div class="stat-value">${DB.users.length}</div><div class="stat-label">Người dùng</div></div></div>
      <div class="stat-card" onclick="navigateTo('detai')" style="cursor:pointer"><div class="stat-icon green">📝</div><div><div class="stat-value">${DB.bcttList.length}</div><div class="stat-label">BCTT</div></div></div>
      <div class="stat-card" onclick="navigateTo('detai')" style="cursor:pointer"><div class="stat-icon orange">🎓</div><div><div class="stat-value">${DB.kltnList.length}</div><div class="stat-label">KLTN</div></div></div>
      <div class="stat-card" onclick="navigateTo('detai')" style="cursor:pointer"><div class="stat-icon red">📅</div><div><div class="stat-value">${DB.dotDangKy.length}</div><div class="stat-label">Đợt đăng ký</div></div></div>
    </div>`;
  }
  el.innerHTML = html;
}

function renderBCTT() {
  const u = DB.currentUser;
  const myBCTT = getBCTTBySV(u.email);
  const el = document.getElementById('page-bctt');
  let html = `<div class="page-header"><h1>📝 Đăng ký Báo cáo Thực tập</h1><p>Đăng ký và theo dõi tiến độ thực tập doanh nghiệp</p></div>`;

  if (myBCTT.length > 0) {
    const b = myBCTT[0];
    const gv = getUser(b.gvEmail);
    const dot = DB.dotDangKy.find(d => d.id === b.dotId);
    html += `<div class="card" style="margin-bottom:20px">
      <div class="card-header"><div><div class="card-title">📋 Thông tin đăng ký BCTT</div></div>${statusBadge(b.trangThai)}</div>
      <div class="info-row"><span class="info-label">Tên đề tài:</span><span class="info-value" style="font-weight:700">${b.tenDeTai}</span></div>
      <div class="info-row"><span class="info-label">Công ty:</span><span class="info-value">${b.tenCongTy}</span></div>
      <div class="info-row"><span class="info-label">Giảng viên HD:</span><span class="info-value">${gv?.name || b.gvEmail}</span></div>
      <div class="info-row"><span class="info-label">Đợt đăng ký:</span><span class="info-value">${DB.dotDangKy.find(d=>d.id===b.dotId)?.ten || b.dotId}</span></div>
      <div class="info-row"><span class="info-label">Hạn nộp BCTT:</span><span class="info-value">${dot?.ketThuc || 'Chưa cấu hình'}</span></div>
      <div class="info-row"><span class="info-label">Ngày đăng ký:</span><span class="info-value">${b.ngayDangKy}</span></div>
    </div>`;

    if (b.trangThai === 'gv_xac_nhan' || b.trangThai === 'cho_cham') {
      html += `<div class="card"><div class="card-title" style="margin-bottom:16px">📤 Nộp hồ sơ BCTT</div>
        <div class="grid-2">
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">📄 Báo cáo Thực tập (PDF)</label>
            <div class="upload-area ${b.fileBC ? 'has-file' : ''}" onclick="fakeUpload('bctt-bc','${b.id}','fileBC')">
              <div class="upload-icon">${b.fileBC ? '✅' : '📁'}</div>
              <div class="upload-text">${b.fileBC ? b.fileBC : 'Click để chọn file PDF'}</div>
            </div>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">📋 Giấy xác nhận TT (PDF)</label>
            <div class="upload-area ${b.fileXacNhan ? 'has-file' : ''}" onclick="fakeUpload('bctt-xn','${b.id}','fileXacNhan')">
              <div class="upload-icon">${b.fileXacNhan ? '✅' : '📁'}</div>
              <div class="upload-text">${b.fileXacNhan ? b.fileXacNhan : 'Click để chọn file PDF'}</div>
            </div>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">📊 File Turnitin BCTT (PDF/DOC/DOCX)</label>
            <div class="upload-area ${b.fileTurnitinBCTT ? 'has-file' : ''}" onclick="fakeUpload('bctt-turnitin','${b.id}','fileTurnitinBCTT')">
              <div class="upload-icon">${b.fileTurnitinBCTT ? '✅' : '📁'}</div>
              <div class="upload-text">${b.fileTurnitinBCTT ? b.fileTurnitinBCTT : 'Click để chọn file Turnitin'}</div>
            </div>
          </div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--text3)">
          Lưu ý: GVHD chỉ chấm được khi đã có file Turnitin BCTT.
        </div>
        ${b.fileBC && b.fileXacNhan ? `<button class="btn btn-success" style="margin-top:16px;width:100%" onclick="hoanTatBCTT('${b.id}')">✅ Hoàn tất nộp hồ sơ BCTT</button>` : ''}
      </div>`;
    }
    if (b.trangThai === 'cho_duyet') {
      html += `<div class="card" style="background:#FFF7D6;border:1px solid var(--accent3)"><div style="font-size:13px;font-weight:600;color:#974F0C">⏳ Đang chờ giảng viên xác nhận đề tài...</div></div>`;
    }
    if (b.trangThai === 'cho_cham') {
      html += `<div class="card" style="background:#E9F2FF;border:1px solid var(--primary)"><div style="font-size:13px;font-weight:600;color:var(--primary)">🧑‍🏫 GV đang xem file và chấm điểm BCTT (điểm + nhận xét).</div></div>`;
    }
    if (b.trangThai === 'pass') {
      html += `<div class="card" style="background:#E3FCEF;border:1px solid #57D9A3"><div style="font-size:13px;font-weight:700;color:#006644">✅ BCTT đạt yêu cầu. Bạn có thể đăng ký KLTN.</div></div>`;
    }
    if (b.trangThai === 'fail') {
      html += `<div class="card" style="background:#FFEBE6;border:1px solid #FF8F73"><div style="font-size:13px;font-weight:700;color:#BF2600">❌ BCTT chưa đạt (&lt; 4). Vui lòng cập nhật và nộp lại hồ sơ.</div></div>`;
    }
  } else {
      const fieldOptions = getCurrentStudentFields();
      html += `<div class="card">
      <div class="card-title" style="margin-bottom:20px">📋 Form đăng ký BCTT</div>
      <div class="grid-2">
        <div class="form-group" style="grid-column:1/-1"><label>Đợt đăng ký *</label><select id="f-dot" onchange="renderGVOptionsByField()"><option value="">-- Chọn đợt --</option>${DB.dotDangKy.filter(d => d.trangThai === 'dang_mo' && d.loai === 'BCTT' && dotMatchesStudentHeAndMajor(d)).map(d => `<option value="${d.id}">${d.ten}</option>`).join('')}</select></div>
        <div class="form-group"><label>Tên đề tài *</label><input type="text" id="f-tenDeTai" placeholder="Nhập tên đề tài thực tập..."></div>
        <div class="form-group"><label>Tên công ty *</label><input type="text" id="f-congty" placeholder="Tên doanh nghiệp thực tập..."></div>
        <div class="form-group"><label>Ngành *</label><select id="f-nganh" disabled><option value="${escapeHtml(getCurrentStudentMajor())}">${escapeHtml(getCurrentStudentMajor() || '-- Chưa có ngành --')}</option></select></div>
        <div class="form-group"><label>Lĩnh vực *</label><select id="f-mang" onchange="renderTopicTypesByField();renderGVOptionsByField();"><option value="">-- Chọn lĩnh vực --</option>${fieldOptions.map((field) => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Loại đề tài *</label><select id="f-topicType"><option value="">-- Chọn loại đề tài --</option></select></div>
        <div class="form-group"><label>Giảng viên hướng dẫn *</label><select id="f-gv"><option value="">-- Chọn giảng viên hướng dẫn --</option></select></div>
      </div>
      <button class="btn btn-primary" style="margin-top:20px;min-width:200px" onclick="submitBCTT()">Gửi đăng ký</button>
    </div>`;
  }
  el.innerHTML = html;
  if (document.getElementById('f-gv') && document.getElementById('f-dot')) {
    queueMicrotask(() => {
      renderTopicTypesByField();
      renderGVOptionsByField();
    });
  }
}

function renderKLTN() {
  const u = DB.currentUser;
  const myKLTN = getKLTNBySV(u.email);
  const myBCTT = getBCTTBySV(u.email).find(b => b.trangThai === 'pass');
  const el = document.getElementById('page-kltn');
  let html = `<div class="page-header"><h1>🎓 Đăng ký Khóa Luận Tốt Nghiệp</h1><p>Đăng ký và theo dõi tiến độ KLTN</p></div>`;

  if (myKLTN.length > 0) {
    const k = myKLTN[0];
    const gvHD = getUser(k.gvHDEmail);
    const gvPB = k.gvPBEmail ? getUser(k.gvPBEmail) : null;
    html += `<div class="card" style="margin-bottom:20px">
      <div class="card-header"><div><div class="card-title">📋 Thông tin KLTN</div></div>${statusBadge(k.trangThai)}</div>
      <div class="info-row"><span class="info-label">Tên đề tài:</span><span class="info-value" style="font-weight:700">${k.tenDeTai}</span></div>
      <div class="info-row"><span class="info-label">Loại đề tài:</span><span class="info-value">${getTopicTypeLabel(k.topicType)}</span></div>
      <div class="info-row"><span class="info-label">Mảng đề tài:</span><span class="info-value">${k.mangDeTai}</span></div>
      <div class="info-row"><span class="info-label">GV Hướng dẫn:</span><span class="info-value">${gvHD?.name || k.gvHDEmail}</span></div>
      <div class="info-row"><span class="info-label">GV Phản biện:</span><span class="info-value">${gvPB ? gvPB.name : '<span style="color:var(--text3)">Chưa phân công</span>'}</span></div>
      ${k.hoiDong ? `
      <div class="info-row"><span class="info-label">Chủ tịch HĐ:</span><span class="info-value">${getUser(k.hoiDong.ct)?.name || k.hoiDong.ct}</span></div>
      <div class="info-row"><span class="info-label">Thư ký HĐ:</span><span class="info-value">${getUser(k.hoiDong.tk)?.name || k.hoiDong.tk}</span></div>
      <div class="info-row"><span class="info-label">Ủy viên HĐ:</span><span class="info-value">${k.hoiDong.tv.map(email => getUser(email)?.name || email).join(', ')}</span></div>
      ` : '<div class="info-row"><span class="info-label">Hội đồng:</span><span class="info-value" style="color:var(--text3)">Chưa phân công</span></div>'}
    </div>`;

    if (k.trangThai === 'thuc_hien') {
      const hasAssignments = k.gvPBEmail && k.hoiDong;
      html += `<div class="card"><div class="card-title" style="margin-bottom:16px">📤 Nộp bài KLTN</div>
        ${!hasAssignments ? `<div style="background:#FFF7D6;border:1px solid var(--accent3);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;color:#974F0C">
            ⏳ Vui lòng chờ Trưởng bộ môn phân công Giảng viên phản biện và Hội đồng trước khi nộp bài.
           </div>` : ''}
        <div class="grid-2">
          <div><label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">📄 File bài KLTN (PDF/ZIP)</label>
        <div class="upload-area ${k.fileBaiWord ? 'has-file' : ''}" onclick="fakeUploadKLTN('${k.id}','fileBaiWord')">
          <div class="upload-icon">${k.fileBaiWord ? '✅' : '📁'}</div>
          <div class="upload-text">${k.fileBaiWord || 'Click để chọn file Word'}</div>
        </div>
        <div class="upload-area ${k.fileBai ? 'has-file' : ''}" onclick="fakeUploadKLTN('${k.id}','fileBai')">
          <div class="upload-icon">${k.fileBai ? '✅' : '📁'}</div>
          <div class="upload-text">${k.fileBai || 'Click để chọn file PDF'}</div>
        </div>
          </div>
          <div><label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">📅 Hạn nộp</label><div class="uploaded-file">Hạn nộp KLTN: 23:59 ngày 15/06/2026</div></div>
        </div>
        ${k.fileBai && hasAssignments ? `<button class="btn btn-success" style="margin-top:16px;width:100%" onclick="hoanTatKLTN('${k.id}')">✅ Hoàn tất nộp KLTN</button>` : ''}
      </div>`;
    }

    const hoiDongScores = getKLTNCouncilScores(k);
    if (k.diemHD !== null && k.diemPB !== null && hoiDongScores.length) {
      const fa = computeKLTNFinalAvg(k);
      const avgHoiDong = hoiDongScores.reduce((sum, score) => sum + score, 0) / hoiDongScores.length;
      const councilLine = getKLTNCouncilBreakdown(k)
        .map((row) => `${escapeHtml(row.role === 'CT' ? 'Chủ tịch HĐ' : row.name)}: ${row.score != null ? row.score : '–'}`)
        .join(' • ');
      html += `<div class="card"><div class="card-title" style="margin-bottom:16px">📊 Kết quả điểm</div>
        <div class="score-grid">
          <div class="score-item"><label>Điểm GV HD (20%)</label><input type="text" value="${k.diemHD ?? '–'}" readonly style="background:var(--bg)"></div>
          <div class="score-item"><label>Điểm GV PB (20%)</label><input type="text" value="${k.diemPB ?? '–'}" readonly style="background:var(--bg)"></div>
          <div class="score-item"><label>Điểm trung bình Hội đồng (60%)</label><input type="text" value="${avgHoiDong.toFixed(2)}" readonly style="background:var(--bg)"></div>
        </div>
        ${councilLine ? `<div style="font-size:12px;color:var(--text2);margin-top:8px"><strong>Điểm hội đồng:</strong> ${councilLine}</div>` : ''}
        <div class="score-total">
          <div class="score-total-label">Điểm tổng hợp (20% HD + 20% PB + 60% TB HĐ)</div>
          <div class="score-total-value">${fa != null ? Math.min(fa, 10).toFixed(2) : '–'}</div>
        </div>
      </div>`;
    }
    if (k.trangThai === 'bao_ve' || k.trangThai === 'hoan_thanh') {
      html += `<div class="card"><div class="card-title" style="margin-bottom:16px">🛠️ Sau bảo vệ: nộp bài chỉnh sửa</div>
      ${k.tuChoiGVHD !== undefined && k.tuChoiGVHD !== null
      ? `<div style="background:#FFEBE6;border:1px solid #FF8F73;border-radius:var(--radius);padding:12px 16px;margin-bottom:12px;font-size:13px">
          ❌ <strong>GVHD yêu cầu chỉnh sửa lại:</strong> ${escapeHtml(k.tuChoiGVHD || 'Vui lòng xem lại và nộp bài mới.')}
          <div style="font-size:12px;color:#BF2600;margin-top:4px">Hãy upload lại bài chỉnh sửa bên dưới.</div>
         </div>` : ''}
      ${k.tuChoiCTHD !== undefined && k.tuChoiCTHD !== null
      ? `<div style="background:#FFEBE6;border:1px solid #FF8F73;border-radius:var(--radius);padding:12px 16px;margin-bottom:12px;font-size:13px">
          ❌ <strong>Chủ tịch HĐ không đồng ý báo cáo:</strong> ${escapeHtml(k.tuChoiCTHD || 'Vui lòng xem lại nội dung báo cáo theo góp ý của hội đồng.')}
          <div style="font-size:12px;color:#BF2600;margin-top:4px">Bạn cần điều chỉnh theo góp ý trước khi thực hiện bước tiếp theo.</div>
         </div>` : ''}
      ${k.tkBienBan
        ? `<div style="background:#E3FCEF;border:1px solid #57D9A3;border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px">
            📋 <strong>Biên bản hội đồng:</strong>
            <a href="${uploadFileHref(k.tkBienBan)}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;margin-left:8px">📥 Tải biên bản (.docx)</a>
            <div style="font-size:12px;color:#006644;margin-top:4px">Đọc yêu cầu chỉnh sửa trong file này trước khi nộp lại bài.</div>
           </div>`
        : `<div style="background:#FFF7D6;border:1px solid var(--accent3);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;color:#974F0C">
            ⏳ Thư ký chưa xuất biên bản hội đồng.
           </div>`}
      <div class="grid-2">
      <div>
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">📄 Bài KLTN đã chỉnh sửa (PDF)</label>
        <div class="upload-area ${k.fileBaiChinhSua ? 'has-file' : ''}" onclick="fakeUploadKLTN('${k.id}','fileBaiChinhSua')">
          <div class="upload-icon">${k.fileBaiChinhSua ? '✅' : '📁'}</div>
          <div class="upload-text">${k.fileBaiChinhSua || 'Click để chọn file'}</div>
        </div>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">📑 Biên bản giải trình chỉnh sửa (PDF)</label>
        <div class="upload-area ${k.fileGiaiTrinh ? 'has-file' : ''}" onclick="fakeUploadKLTN('${k.id}','fileGiaiTrinh')">
          <div class="upload-icon">${k.fileGiaiTrinh ? '✅' : '📁'}</div>
          <div class="upload-text">${k.fileGiaiTrinh || 'Click để chọn file'}</div>
        </div>
      </div>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--text3)">Trạng thái sau bảo vệ: GVHD ${k.xacNhanGVHD ? 'Đã duyệt bài chỉnh sửa' : 'Chờ duyệt bài chỉnh sửa'} • CTHĐ ${k.xacNhanCTHD ? 'Đã xác nhận đồng ý báo cáo' : 'Chờ xác nhận đồng ý/không đồng ý báo cáo'}</div>
      </div>`;
    }
  } else {
    if (!myBCTT) {
      html += `<div class="card" style="background:#FFEBE6;border:1px solid #FF8F73">
        <div style="font-weight:700;color:#BF2600;margin-bottom:4px">⚠️ Chưa hoàn tất BCTT</div>
        <div style="font-size:13px;color:#BF2600">Bạn cần hoàn tất Báo cáo Thực tập trước khi đăng ký KLTN.</div>
        <button class="btn btn-danger btn-sm" style="margin-top:12px" onclick="navigateTo('bctt')">Đến trang BCTT</button>
      </div>`;
    } else {
      html += `<div class="card" style="background:#E3FCEF;border:1px solid #57D9A3;margin-bottom:16px">
        <div style="font-weight:700;color:#006644">✅ BCTT đã hoàn tất – Bạn đủ điều kiện đăng ký KLTN</div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:20px">📋 Form đăng ký KLTN</div>
        <div class="grid-2">
          <div class="form-group" style="grid-column:1/-1"><label>Tên đề tài *</label><input type="text" id="fk-ten" value="${myBCTT.tenDeTai}" placeholder="Tên đề tài KLTN..."></div>
          <div class="form-group" style="grid-column:1/-1"><label>Đợt đăng ký *</label><select id="fk-dot"><option value="">-- Chọn đợt --</option>${DB.dotDangKy.filter(d => d.trangThai === 'dang_mo' && d.loai === 'KLTN' && dotMatchesStudentHeAndMajor(d)).map(d => `<option value="${d.id}">${d.ten}</option>`).join('')}</select></div>
          <div class="form-group"><label>Ngành *</label><select id="fk-nganh" disabled><option value="TMĐT">Thương mại điện tử</option></select></div>
          <div class="form-group"><label>Lĩnh vực *</label><select id="fk-mang"><option value="">-- Chọn lĩnh vực --</option>${getCurrentStudentFields().map((field) => `<option value="${escapeHtml(field)}" ${myBCTT.mangDeTai === field ? 'selected' : ''}>${escapeHtml(field)}</option>`).join('')}</select></div>
          <div class="form-group">
            <label>Loại đề tài *</label>
            <input type="text" value="${escapeHtml(getTopicTypeLabel(myBCTT.topicType))}" readonly style="background:var(--bg)">
            <input type="hidden" id="fk-topicType" value="${escapeHtml(normalizeTopicType(myBCTT.topicType))}">
          </div>
          <div class="form-note" style="font-size:13px;color:var(--text3);margin-top:8px;margin-bottom:0;line-height:1.5">Loại đề tài KLTN được giữ nguyên theo BCTT đã đạt của bạn.</div>
          <div class="form-group" style="grid-column:1/-1" ><label>GV Hướng dẫn</label><input type="text" value="${getUser(myBCTT.gvEmail)?.name || myBCTT.gvEmail}" readonly style="background:var(--bg)" id="fk-gvhd-display"><input type="hidden" id="fk-gvhd" value="${myBCTT.gvEmail}"></div>
        </div>
        <button class="btn btn-primary" style="margin-top:8px;min-width:200px" onclick="submitKLTN()">📤 Gửi đăng ký KLTN</button>
      </div>`;
    }
  }
  el.innerHTML = html;
}

function renderDeTai() {
  const u = DB.currentUser;
  const el = document.getElementById('page-detai');
  let bcttData = DB.bcttList.filter((b) => isBCTTVisibleForCurrentUser(b));
  let kltnData = DB.kltnList.filter((k) => isKLTNVisibleForCurrentUser(k));
  const activeTab = DB.nextDetaiTab === 'tab-kltn-list' ? 'tab-kltn-list' : 'tab-bctt-list';
  DB.nextDetaiTab = null;

  let html = `<div class="page-header"><h1>📋 Quản lý đề tài</h1></div>
    <div class="tabs">
      <button class="tab-btn ${activeTab === 'tab-bctt-list' ? 'active' : ''}" onclick="switchTab(event,'tab-bctt-list')">📝 Báo cáo Thực tập (${bcttData.length})</button>
      <button class="tab-btn ${activeTab === 'tab-kltn-list' ? 'active' : ''}" onclick="switchTab(event,'tab-kltn-list')">🎓 Khóa Luận Tốt Nghiệp (${kltnData.length})</button>
    </div>
    <div id="tab-bctt-list" class="tab-content ${activeTab === 'tab-bctt-list' ? 'active' : ''}">`;

  if (bcttData.length) {
    html += `<div class="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Đề tài</th><th>Lĩnh vực</th><th>Giảng viên hướng dẫn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>`;
    bcttData.forEach(b => {
      const sv = getUser(b.svEmail); const gv = getUser(b.gvEmail);
      html += `<tr>
        <td><div style="font-weight:600">${sv?.name || b.svEmail}</div><div style="font-size:11px;color:var(--text3)">${b.svEmail}</div></td>
        <td style="max-width:200px"><div style="font-weight:500;cursor:pointer;color:var(--primary)" title="Xem chi tiết" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div></td>
        <td><span class="badge badge-blue" style="white-space:nowrap">${b.mangDeTai}</span></td>
        <td style="font-size:12px">${gv?.name || b.gvEmail}</td>
        <td>${statusBadge(b.trangThai)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁 Chi tiết</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  } else { html += `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Chưa có BCTT nào</div></div>`; }

  html += `</div><div id="tab-kltn-list" class="tab-content ${activeTab === 'tab-kltn-list' ? 'active' : ''}">`;

  if (kltnData.length) {
    html += `<div class="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Đề tài</th><th>GV HD</th><th>GV PB</th><th>GVHD duyệt sửa</th><th>CT.HĐ duyệt sửa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>`;
    kltnData.forEach(k => {
      const sv = getUser(k.svEmail); const gvhd = getUser(k.gvHDEmail); const gvpb = k.gvPBEmail ? getUser(k.gvPBEmail) : null;
      const gvhdApprove = k.xacNhanGVHD
        ? '<span class="badge badge-green">Đã đồng ý</span>'
        : '<span class="badge badge-orange">Chưa đồng ý</span>';
      const cthdApprove = k.xacNhanCTHD
        ? '<span class="badge badge-green">Đã đồng ý</span>'
        : '<span class="badge badge-orange">Chưa đồng ý</span>';
      html += `<tr>
        <td><div style="font-weight:600">${sv?.name || k.svEmail}</div><div style="font-size:11px;color:var(--text3)">${k.svEmail}</div></td>
        <td style="max-width:220px"><div style="font-weight:500;cursor:pointer;color:var(--primary)" title="Xem chi tiết" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div></td>
        <td style="font-size:12px">${gvhd?.name || k.gvHDEmail}</td>
        <td style="font-size:12px">${gvpb ? gvpb.name : '<span style="color:var(--text3)">Chưa PB</span>'}</td>
        <td>${gvhdApprove}</td>
        <td>${cthdApprove}</td>
        <td>${statusBadge(k.trangThai)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  } else { html += `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Chưa có KLTN nào</div></div>`; }
  html += `</div>`;
  el.innerHTML = html;
}

function renderNhapDiem() {
  const u = DB.currentUser;
  const el = document.getElementById('page-nhapDiem');
  if (!el) return;
  let html = `<div class="page-header"><h1>📊 Chấm điểm</h1><p>Trang quản lý chấm điểm KLTN theo vai trò của bạn</p></div>`;
  if (!u || (u.role !== 'gv' && u.role !== 'bm')) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">🚫</div><div class="empty-state-title">Bạn không có quyền truy cập trang này</div><div style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="navigateTo('dashboard')">Về trang chính</button></div></div></div>`;
    el.innerHTML = html;
    return;
  }

  const list = getKLTNRoleRecords((assignment) => assignment.canGrade);
  if (!list.length) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Không có đề tài KLTN nào để chấm</div><div style="margin-top:8px;color:var(--text3)">Kiểm tra lại phân công hội đồng, vai trò GV hoặc PB.</div></div></div>`;
    el.innerHTML = html;
    return;
  }

  list.forEach((k) => {
    const assignment = getKLTNAssignment(u, k);
    html += renderKLTNRoleCardStart(k);
    if (assignment.isAdvisor) {
      html += renderKLTNScoreBlock(
        k,
        'HD',
        '🎯 Giảng viên hướng dẫn — phiếu chấm',
        'Nhập điểm và nhận xét theo mẫu chấm HD.',
        { existingScore: k.diemHD, noteValue: k.hdNote || '' }
      );
    }
    if (assignment.isReviewer) {
      html += renderKLTNScoreBlock(
        k,
        'PB',
        '🧾 Giảng viên phản biện — phiếu chấm',
        'Nhập điểm, nhận xét và câu hỏi phản biện.',
        { existingScore: k.diemPB, noteValue: k.pbNote || '', questionValue: k.pbCauHoi || '', showQuestion: true }
      );
    }
    if (assignment.isCommitteeMember) {
      const myTVScore = getCurrentTVScore(k);
      html += renderKLTNScoreBlock(
        k,
        'TV',
        '🏛️ Thành viên hội đồng — phiếu chấm',
        'Nhập điểm và nhận xét riêng cho hội đồng.',
        { existingScore: myTVScore?.diem, noteValue: myTVScore?.nhanXet || '' }
      );
    }
    if (!assignment.isAdvisor && !assignment.isReviewer && !assignment.isCommitteeMember) {
      html += `<div style="font-size:13px;color:var(--text3);margin-top:12px">Bạn chưa được phân công vai trò chấm điểm cho đề tài này.</div>`;
    }
    html += renderKLTNRoleCardEnd();
  });

  el.innerHTML = html;
  list.forEach((k) => {
    if (getKLTNAssignment(u, k).isAdvisor) recalcKLTNRoleTotal(k.id, 'HD');
    if (getKLTNAssignment(u, k).isReviewer) recalcKLTNRoleTotal(k.id, 'PB');
    if (getKLTNAssignment(u, k).isCommitteeMember) recalcKLTNRoleTotal(k.id, 'TV');
  });
}

function viewBCTTDetail(id) {
  const b = DB.bcttList.find((x) => x.id === id);
  if (!b) return toast('Không tìm thấy đề tài BCTT', 'error');
  if (!isBCTTVisibleForCurrentUser(b)) return toast('Bạn không có quyền xem đề tài này', 'error');
  const sv = getUser(b.svEmail);
  const gv = getUser(b.gvEmail);
  const u = DB.currentUser;
  
  // Cho phép GV của BCTT đó và TBM chấm điểm
  const isGVOfThis = u.email === b.gvEmail && u.role === 'gv';
  const isTBM = u.role === 'bm';
  const canScore = (isGVOfThis || isTBM) && b.trangThai === 'cho_cham';
  
  const fileRow = (label, path) =>
    path
      ? `<a href="${uploadFileHref(path)}" target="_blank" rel="noopener" style="color:var(--accent2)">📥 Tải xuống</a> <span style="font-size:11px;color:var(--text3)">${escapeHtml(path.split(/[/\\\\]/).pop() || '')}</span>`
      : '<span style="color:var(--text3)">Chưa nộp</span>';
  let scoreForm = '';
  let nhanXetSection = '';
  
  console.log('BCTT Debug:', { id, 'trangThai': b.trangThai, 'gvEmail': b.gvEmail, 'userEmail': u.email, 'userRole': u.role, 'isGVOfThis': isGVOfThis, 'isTBM': isTBM, 'canScore': canScore });
  
  if (canScore) {
    // Khi đang chấm điểm, hiển thị form nhập điểm
    scoreForm = `
      <div class="form-group" style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px;background:#f0f9ff;padding:12px;border-radius:6px">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px">🎯 Chấm điểm BCTT</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <div style="flex:1"><label style="font-size:12px;font-weight:600">Điểm (0-10)</label><input type="number" id="bctt-diem" min="0" max="10" step="0.1" value="${b.diemBCTT || ''}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px"></div>
        </div>
        <div style="margin-bottom:8px"><label style="font-size:12px;font-weight:600">Nhận xét</label><textarea id="bctt-nhanxet" style="width:100%;min-height:80px;padding:8px;border:1px solid var(--border);border-radius:4px">${escapeHtml(b.nhanXetBCTT || '')}</textarea></div>
        <button class="btn btn-primary" onclick="chamDiemBCTT({dangKyId: '${b.dangKyId}', id: '${b.id}'})">💾 Lưu điểm</button>
      </div>`;
    nhanXetSection = ''; // Ẩn textarea readonly khi đang chấm điểm
  } else {
    // Khi chỉ xem, hiển thị textarea readonly
    nhanXetSection = `<div class="form-group" style="margin-top:8px"><label style="font-size:12px">Nhận xét BCTT</label><textarea readonly style="width:100%;background:var(--bg);min-height:72px;font-size:13px;padding:8px;border:1px solid var(--border);border-radius:4px">${escapeHtml(b.nhanXetBCTT || '')}</textarea></div>`;
  }
  
  showModal(`<div class="modal-header"><div class="modal-title">📋 Chi tiết BCTT</div><button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="info-row"><span class="info-label">Sinh viên:</span><span class="info-value">${escapeHtml(sv?.name || '')}</span></div>
    <div class="info-row"><span class="info-label">MSSV:</span><span class="info-value">${escapeHtml(sv?.mssv || sv?.ma || '–')}</span></div>
    <div class="info-row"><span class="info-label">Tên đề tài:</span><span class="info-value" style="font-weight:700">${escapeHtml(b.tenDeTai)}</span></div>
    <div class="info-row"><span class="info-label">Ngành:</span><span class="info-value">${escapeHtml(b.mangDeTai)}</span></div>
    <div class="info-row"><span class="info-label">Công ty:</span><span class="info-value">${escapeHtml(b.tenCongTy)}</span></div>
    <div class="info-row"><span class="info-label">GV HD:</span><span class="info-value">${escapeHtml(gv?.name || '')}</span></div>
    <div class="info-row"><span class="info-label">Trạng thái:</span><span class="info-value">${statusBadge(b.trangThai)}</span></div>
    <div class="info-row"><span class="info-label">File báo cáo:</span><span class="info-value">${fileRow('bc', b.fileBC)}</span></div>
    <div class="info-row"><span class="info-label">Giấy xác nhận:</span><span class="info-value">${fileRow('xn', b.fileXacNhan)}</span></div>
    <div class="info-row"><span class="info-label">Turnitin BCTT:</span><span class="info-value">${fileRow('ti', b.fileTurnitinBCTT)}</span></div>
    <div class="info-row"><span class="info-label">Điểm BCTT:</span><span class="info-value">${b.diemBCTT != null && b.diemBCTT !== '' ? escapeHtml(String(b.diemBCTT)) : '–'}</span></div>
    ${nhanXetSection}
    ${scoreForm}
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Đóng</button></div>`);
}

function viewKLTNDetail(id) {
  const k = DB.kltnList.find((x) => x.id === id);
  if (!k) return toast('Không tìm thấy đề tài KLTN', 'error');
  if (!isKLTNVisibleForCurrentUser(k)) return toast('Bạn không có quyền xem đề tài này', 'error');

  const sv = getUser(k.svEmail);
  const gvhd = getUser(k.gvHDEmail);
  const gvpb = k.gvPBEmail ? getUser(k.gvPBEmail) : null;
  const mssv = sv?.mssv || sv?.ma || '–';

  const linkFile = (path, label) =>
    path
      ? `<a href="${uploadFileHref(path)}" target="_blank" rel="noopener" style="color:var(--accent, #0284c7); font-weight: 600; text-decoration: none; padding: 4px 8px; background: var(--bg-alt, #f3f4f6); border-radius: 4px; font-size: 13px; white-space: nowrap;">${label}</a>`
      : '<span style="color:var(--text3, #9ca3af); font-style: italic; font-size: 13px;">Chưa có</span>';

  let hdBlock = '';
  if (k.hoiDong) {
    const h = k.hoiDong;
    const tvs = (Array.isArray(h.tv) ? h.tv : []).map((e) => escapeHtml(getUser(e)?.name || e)).join(', ');
    hdBlock = `
      <div class="kltn-row" style="align-items: flex-start; margin-top: 8px;">
        <span class="kltn-label" style="padding-top: 4px;">Hội đồng:</span>
        <div class="kltn-value" style="background: var(--bg, #fff); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border, #e5e7eb); line-height: 1.6;">
          <div><span style="color: var(--text3, #6b7280); display: inline-block; width: 75px;">Chủ tịch:</span> <b style="color: var(--text1, #111);">${escapeHtml(getUser(h.ct)?.name || h.ct || '–')}</b></div>
          <div><span style="color: var(--text3, #6b7280); display: inline-block; width: 75px;">Thư ký:</span> <b style="color: var(--text1, #111);">${escapeHtml(getUser(h.tk)?.name || h.tk || '–')}</b></div>
         ${tvs ? `<div><span style="color: var(--text3, #6b7280); display: inline-block; width: 85px; white-space: nowrap;">Thành viên:</span> <b style="color: var(--text1, #111);">${tvs}</b></div>` : ''}
        </div>
      </div>`;
  }

  const councilScores = getKLTNCouncilScores(k);
  const hasAnyScore = k.diemHD != null || k.diemPB != null || councilScores.length > 0;
  const avgHoiDongDetail = councilScores.length
    ? (councilScores.reduce((sum, score) => sum + score, 0) / councilScores.length)
    : null;
  const faDetail = computeKLTNFinalAvg(k);
 
  const scoreBlock = hasAnyScore
    ? `<div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div class="kltn-score-box"><span class="kltn-score-label">Điểm GVHD</span><div class="kltn-score-val">${k.diemHD != null ? escapeHtml(String(k.diemHD)) : '–'}</div></div>
        <div class="kltn-score-box"><span class="kltn-score-label">Điểm GVPB</span><div class="kltn-score-val">${k.diemPB != null ? escapeHtml(String(k.diemPB)) : '–'}</div></div>
        <div class="kltn-score-box"><span class="kltn-score-label">TB Hội đồng</span><div class="kltn-score-val">${avgHoiDongDetail != null ? escapeHtml(avgHoiDongDetail.toFixed(2)) : '–'}</div></div>
        ${faDetail != null ? `<div class="kltn-score-box" style="background: #fff1f2; border-color: #fecdd3;"><span class="kltn-score-label" style="color: #9f1239;">Tổng hợp</span><div class="kltn-score-val" style="color: #e11d48; font-size: 22px;">${Math.min(faDetail, 10).toFixed(2)}</div></div>` : ''}
       </div>`
    : '<div style="font-size:13.5px; color:var(--text3); font-style: italic; margin-bottom: 15px;">Chưa có điểm chấm.</div>';

  const textareaStyle = "background:var(--bg, #fff); width:100%; border: 1px solid var(--border, #d1d5db); border-radius: 6px; padding: 10px; font-size: 13.5px; resize: none; color: var(--text1, #1f2937); line-height: 1.5;";
  const noteTitleStyle = "font-weight: bold; font-size: 14px; color: var(--text1, #111827); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;";
 
  const u = DB.currentUser;
  const hdBlockDetail = u.role !== 'bm' && k.hdNote ? `<div style="margin-bottom: 16px;"><div style="${noteTitleStyle}">📝 Nhận xét GVHD</div><textarea readonly style="${textareaStyle}" rows="4">${escapeHtml(k.hdNote)}</textarea></div>` : '';
  const pbBlockDetail = u.role !== 'bm' && (k.pbNote || k.pbCauHoi) ? `<div style="margin-bottom: 16px;"><div style="${noteTitleStyle}">📝 Nhận xét & câu hỏi GVPB</div><textarea readonly style="${textareaStyle}" rows="5">${escapeHtml((k.pbNote || '') + (k.pbCauHoi ? '\n\n— Câu hỏi —\n' + k.pbCauHoi : ''))}</textarea></div>` : '';
  const ctBlockDetail = (k.ctNote || k.ctCauHoi) ? `<div style="margin-bottom: 16px;"><div style="${noteTitleStyle}">📝 Nhận xét / câu hỏi Chủ tịch HĐ</div><textarea readonly style="${textareaStyle}" rows="5">${escapeHtml((k.ctNote || '') + (k.ctCauHoi ? '\n\n— Câu hỏi —\n' + k.ctCauHoi : ''))}</textarea></div>` : '';

  const bienBanChamDiemDetail = k.bienBanChamDiem ? `<div class="kltn-row" style="margin-top: 15px; border-top: 1px dashed var(--border, #ccc); padding-top: 15px;"><span class="kltn-label">Biên bản chấm điểm:</span><span class="kltn-value"><a href="${uploadFileHref(k.bienBanChamDiem)}" target="_blank" rel="noopener" style="color:var(--accent, #0284c7); font-weight: bold; font-size: 14px;">📥 Tải biên bản chấm điểm</a></span></div>` : '';
  const tkBbDetail = k.tkBienBan ? `<div class="kltn-row" style="margin-top: 15px; border-top: 1px dashed var(--border, #ccc); padding-top: 15px;"><span class="kltn-label">Biên bản HĐ (TK):</span><span class="kltn-value"><a href="${uploadFileHref(k.tkBienBan)}" target="_blank" rel="noopener" style="color:var(--accent, #0284c7); font-weight: bold; font-size: 14px;">📥 Tải biên bản (.docx)</a></span></div>` : '';

  const customStyles = `
    <style>
      .kltn-section { border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 16px; margin-bottom: 16px; background: var(--bg-alt, #fafafa); box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
      .kltn-sec-title { font-weight: 700; font-size: 14px; text-transform: uppercase; color: var(--text1, #111827); margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid var(--border, #e5e7eb); padding-bottom: 8px; letter-spacing: 0.3px; }
      .kltn-row { display: flex; margin-bottom: 12px; line-height: 1.5; align-items: baseline; }
      .kltn-label { font-weight: 600; min-width: 135px; color: var(--text2, #4b5563); font-size: 13.5px; }
      .kltn-value { flex: 1; font-size: 14px; color: var(--text1, #1f2937); }
      .kltn-score-box { border: 1px solid var(--border, #d1d5db); border-radius: 8px; padding: 10px; text-align: center; flex: 1; background: var(--bg, #fff); display: flex; flex-direction: column; justify-content: center; }
      .kltn-score-label { font-size: 11px; font-weight: 700; color: var(--text3, #6b7280); display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .kltn-score-val { font-size: 20px; font-weight: 800; color: var(--accent, #d97706); }
      .kltn-grid-files { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; background: var(--bg, #fff); padding: 12px; border-radius: 6px; border: 1px solid var(--border, #e5e7eb); }
    </style>
  `;

  showModal(`
    ${customStyles}
    <div class="modal-header">
      <div class="modal-title">Chi tiết Khóa Luận Tốt Nghiệp</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
   
    <div class="kltn-section">
      <div class="kltn-sec-title">Thông tin chung</div>
      <div class="kltn-row"><span class="kltn-label">MSSV:</span><span class="kltn-value" style="font-weight: 600;">${escapeHtml(mssv)}</span></div>
      <div class="kltn-row"><span class="kltn-label">Sinh viên:</span><span class="kltn-value">${escapeHtml(sv?.name || '')}</span></div>
      <div class="kltn-row"><span class="kltn-label">Tên đề tài:</span><span class="kltn-value" style="font-weight:700; color: var(--accent, #0284c7); font-size: 15px;">${escapeHtml(k.tenDeTai)}</span></div>
      <div class="kltn-row"><span class="kltn-label">Ngành:</span><span class="kltn-value">Thương mại Điện tử</span></div>
      <div class="kltn-row"><span class="kltn-label">Lĩnh vực:</span><span class="kltn-value">${escapeHtml(k.mangDeTai)}</span></div>
      <div class="kltn-row"><span class="kltn-label">Trạng thái:</span><span class="kltn-value">${statusBadge(k.trangThai)}</span></div>
    </div>

    <div class="kltn-section">
      <div class="kltn-sec-title">Phân công & Hội đồng</div>
      <div class="kltn-row"><span class="kltn-label">GV Hướng dẫn:</span><span class="kltn-value" style="font-weight: 600;">${escapeHtml(gvhd?.name || '')}</span></div>
      <div class="kltn-row"><span class="kltn-label">GV Phản biện:</span><span class="kltn-value" style="font-weight: 600;">${gvpb ? escapeHtml(gvpb.name) : '<span style="color:var(--text3); font-style:italic; font-weight: normal;">Chưa phân công</span>'}</span></div>
      ${hdBlock}
    </div>

    <div class="kltn-section">
      <div class="kltn-sec-title">Tài liệu & Hồ sơ</div>
      <div class="kltn-grid-files">
        <div class="kltn-row" style="margin:0; align-items: center;"><span class="kltn-label" style="min-width: 90px;">File Word:</span><span class="kltn-value">${linkFile(k.fileBaiWord, '📄 Tải Word')}</span></div>
        <div class="kltn-row" style="margin:0; align-items: center;"><span class="kltn-label" style="min-width: 90px;">File PDF:</span><span class="kltn-value">${linkFile(k.fileBai, '📕 Tải PDF')}</span></div>
        <div class="kltn-row" style="margin:0; align-items: center;"><span class="kltn-label" style="min-width: 90px;">Turnitin:</span><span class="kltn-value">${linkFile(k.fileTurnitin, '📑 Tải Turnitin')}</span></div>
        <div class="kltn-row" style="margin:0; align-items: center;"><span class="kltn-label" style="min-width: 90px;">Bản sửa:</span><span class="kltn-value">${linkFile(k.fileBaiChinhSua, '📄 Tải bản sửa')}</span></div>
        <div class="kltn-row" style="margin:0; grid-column: 1 / -1; align-items: center;"><span class="kltn-label" style="min-width: 90px;">Giải trình:</span><span class="kltn-value">${linkFile(k.fileGiaiTrinh, '📑 Tải biên bản giải trình')}</span></div>
      </div>
     
      <div class="kltn-row" style="margin-top: 15px; background: var(--bg, #fff); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border, #e5e7eb);">
        <span class="kltn-label" style="min-width: 130px;">Xác nhận sau bảo vệ:</span>
        <span class="kltn-value">
          <span style="display:inline-block; margin-right: 15px;"><b>GVHD:</b> ${k.xacNhanGVHD ? '<span style="color:#16a34a; font-weight:bold;">✅ Đã duyệt bài chỉnh sửa</span>' : '<span style="color:#d97706;">⏳ Chờ duyệt bài chỉnh sửa</span>'}</span>
          <span><b>Chủ tịch:</b> ${k.xacNhanCTHD ? '<span style="color:#16a34a; font-weight:bold;">✅ Đã xác nhận đồng ý báo cáo</span>' : '<span style="color:#d97706;">⏳ Chờ xác nhận báo cáo sau bảo vệ</span>'}</span>
        </span>
      </div>
     
      ${k.tomTat ? `<div class="kltn-row" style="margin-top: 15px; align-items: flex-start;"><span class="kltn-label">Tóm tắt (AI):</span><span class="kltn-value" style="font-size:13px; color:var(--text2, #4b5563); font-style:italic; background:var(--bg, #fff); padding:10px 12px; border-radius:6px; border:1px dashed #ccc; line-height: 1.5;">${escapeHtml(k.tomTat)}</span></div>` : ''}
    </div>

    <div class="kltn-section" style="margin-bottom: 0;">
      <div class="kltn-sec-title">Kết quả Đánh giá</div>
      ${scoreBlock}
      ${hdBlockDetail}
      ${pbBlockDetail}
      ${ctBlockDetail}
      ${bienBanChamDiemDetail}
      ${tkBbDetail}
    </div>

    <div class="modal-footer" style="margin-top: 20px; text-align: right; border-top: none;">
      <button class="btn btn-ghost" style="padding: 8px 24px; font-weight: 700; cursor: pointer; background: var(--border, #e5e7eb); border-radius: 6px; border: none; color: var(--text1, #111);" onclick="closeModalForce()">Đóng</button>
    </div>
  `);
}

function renderDuyetDe() {
  const u = DB.currentUser;
  if (u.role === 'bm') {
    const el = document.getElementById('page-duyetde');
    const managedMajors = (u.chuyenMon || []).filter(Boolean);
    const managedDots = DB.dotDangKy
      .filter((d) => !managedMajors.length || managedMajors.some((major) => majorMatches(major, d.nganh)))
      .sort((a, b) => Number(a.id) - Number(b.id));
    const selectedDotId = managedDots.some((d) => String(d.id) === String(DB.tbmSelectedDotId))
      ? String(DB.tbmSelectedDotId)
      : (managedDots[0]?.id || '');
    DB.tbmSelectedDotId = selectedDotId;
    const selectedDot = managedDots.find((d) => String(d.id) === String(selectedDotId));
    const gvList = DB.users
      .filter((g) => (g.role === 'gv' || g.role === 'bm') && (!selectedDot?.nganh || (g.chuyenMon || []).some((major) => majorMatches(major, selectedDot.nganh))))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    let html = `<div class="page-header"><h1>🎯 Quản lý đợt đăng ký và slot GVHD</h1><p>TBM có thể mở đồng thời nhiều đợt, thêm/xóa đợt và chỉnh slot giảng viên theo từng đợt.</p></div>`;

    html += `<div class="grid-2">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">➕ Thêm đợt mới</div>
        <div class="grid-2">
          <div class="form-group"><label>Tên đợt *</label><input id="tbm-dot-ten" type="text" placeholder="Ví dụ: Đợt 3 HK1 26-27 - TMĐT"></div>
          <div class="form-group"><label>Loại *</label><select id="tbm-dot-loai"><option value="BCTT">BCTT</option><option value="KLTN">KLTN</option></select></div>
          <div class="form-group"><label>Ngành *</label><select id="tbm-dot-nganh">${managedMajors.map((major) => `<option value="${escapeHtml(major)}">${escapeHtml(major)}</option>`).join('')}</select></div>
          <div class="form-group"><label>Hệ đào tạo</label><select id="tbm-dot-he"><option value="">Tất cả</option><option value="DaiTra">Đại trà</option><option value="CLC">CLC</option></select></div>
          <div class="form-group"><label>Hạn đăng ký</label><input id="tbm-dot-han-dk" type="date"></div>
          <div class="form-group"><label>Hạn nộp</label><input id="tbm-dot-han-nop" type="date"></div>
          <div class="form-group"><label>Trạng thái</label><select id="tbm-dot-status"><option value="dong">Đóng</option><option value="mo">Mở</option></select></div>
          <div class="form-group"><label>Copy slot từ đợt cũ</label><select id="tbm-dot-copy"><option value="">Không copy</option>${managedDots.map((d) => `<option value="${d.id}">${escapeHtml(d.ten)} (${escapeHtml(d.loai)})</option>`).join('')}</select></div>
        </div>
        <div class="action-row" style="margin-top:12px"><button class="btn btn-primary" onclick="createManagedDot()">Tạo đợt</button></div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">🗂️ Chọn đợt để chỉnh slot</div>
        ${managedDots.length ? `<div class="form-group"><label>Đợt đang thao tác</label><select id="tbm-selected-dot" onchange="selectDotForSlotAdmin(this.value)">${managedDots.map((d) => `<option value="${d.id}" ${String(d.id) === String(selectedDotId) ? 'selected' : ''}>${escapeHtml(d.ten)} • ${escapeHtml(d.loai)} • ${d.trangThai === 'dang_mo' ? 'Đang mở' : 'Đang đóng'}</option>`).join('')}</select></div>` : `<div class="empty-state"><div class="empty-state-title">Chưa có đợt nào trong ngành bạn quản lý</div></div>`}
        <div class="form-note" style="font-size:13px;color:var(--text3);line-height:1.5">Mỗi đợt có bộ slot riêng cho từng giảng viên theo Đại trà và CLC. Khi tạo đợt mới, hệ thống có thể copy toàn bộ slot từ một đợt cũ để tránh phải sửa tay trong database.</div>
      </div>
    </div>`;

    html += `<div class="card" style="margin-top:20px"><div class="card-title" style="margin-bottom:12px">📅 Danh sách đợt đang quản lý</div>`;
    if (!managedDots.length) {
      html += `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Chưa có đợt nào</div></div>`;
    } else {
      html += `<div class="table-wrap"><table><thead><tr><th>Tên đợt</th><th>Loại</th><th>Ngành</th><th>Hệ</th><th>Hạn đăng ký</th><th>Hạn nộp</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>`;
      managedDots.forEach((d) => {
        const isOpen = d.trangThai === 'dang_mo';
        html += `<tr>
          <td><div style="font-weight:700">${escapeHtml(d.ten)}</div></td>
          <td>${escapeHtml(d.loai)}</td>
          <td>${escapeHtml(d.nganh || '')}</td>
          <td>${escapeHtml(d.heDaoTao || 'Tất cả')}</td>
          <td>${escapeHtml(d.batDau || '')}</td>
          <td>${escapeHtml(d.ketThuc || '')}</td>
          <td>${isOpen ? '<span class="badge badge-green">Đang mở</span>' : '<span class="badge badge-red">Đang đóng</span>'}</td>
          <td><div class="action-row">
            <button class="btn btn-ghost btn-sm" onclick="selectDotForSlotAdmin('${d.id}')">Chỉnh slot</button>
            <button class="btn btn-sm ${isOpen ? 'btn-danger' : 'btn-success'}" onclick="toggleManagedDotStatus('${d.id}','${isOpen ? 'dong' : 'mo'}')">${isOpen ? 'Khóa đợt' : 'Mở đợt'}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteManagedDot('${d.id}')">Xóa</button>
          </div></td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;

    html += `<div class="card" style="margin-top:20px"><div class="card-title" style="margin-bottom:12px">👨‍🏫 Slot giảng viên theo đợt${selectedDot ? `: ${escapeHtml(selectedDot.ten)}` : ''}</div>`;
    if (!selectedDot) {
      html += `<div class="empty-state"><div class="empty-state-title">Chọn hoặc tạo đợt để chỉnh slot</div></div>`;
    } else if (!gvList.length) {
      html += `<div class="empty-state"><div class="empty-state-title">Không có giảng viên cùng ngành với đợt này</div></div>`;
    } else {
      html += `<div class="table-wrap"><table><thead><tr><th>Giảng viên</th><th>Hệ</th><th>Quota</th><th>Slot còn lại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>`;
      gvList.forEach((g) => {
        ['DaiTra', 'CLC'].forEach((he) => {
          const slot = (DB.gvSlots || []).find((s) => Number(s.gvId) === Number(g.id) && String(s.dotId) === String(selectedDot.id) && String(s.heDaoTao || 'DaiTra') === he);
          if (!slot) return;
          html += `<tr>
            <td><div style="font-weight:600">${escapeHtml(g.name)}</div><div style="font-size:12px;color:var(--text3)">${escapeHtml((g.chuyenMon || []).join(', '))}</div></td>
            <td>${he === 'DaiTra' ? 'Đại trà' : 'CLC'}</td>
            <td><input id="slot-quota-${slot.id}" type="number" min="0" value="${Number(slot.quota || 0)}" style="width:90px"></td>
            <td><input id="slot-conlai-${slot.id}" type="number" min="0" value="${Number(slot.slotConLai || 0)}" style="width:90px"></td>
            <td>${slot.duyetTbm ? '<span class="badge badge-green">Đang mở</span>' : '<span class="badge badge-red">Đang khóa</span>'}</td>
            <td><div class="action-row">
              <button class="btn btn-primary btn-sm" onclick="saveGVSlotForDot('${g.id}','${selectedDot.id}','${he}','${slot.id}')">Lưu slot</button>
              <button class="btn btn-sm ${slot.duyetTbm ? 'btn-danger' : 'btn-success'}" onclick="toggleGVSlotForDot('${slot.id}', ${slot.duyetTbm ? 'false' : 'true'})">${slot.duyetTbm ? 'Khóa' : 'Mở'}</button>
            </div></td>
          </tr>`;
        });
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;

    const bcttList = DB.bcttList.filter((b) => b.trangThai === 'cho_duyet' && (!managedMajors.length || managedMajors.some((major) => (b.tenDot || '').includes(major))));
    html += `<div class="card" style="margin-top: 20px;"><div class="card-title">✅ Duyệt đề tài BCTT</div>`;
    if (!bcttList.length) {
      html += `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Không có đề tài BCTT nào cần duyệt</div></div>`;
    } else {
      bcttList.forEach(b => {
        html += `<div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div style="flex:1">
              <div style="font-size:16px;font-weight:700;margin-bottom:6px;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:8px">${escapeHtml(b.mangDeTai)} • ${escapeHtml(b.tenCongTy)} • ${escapeHtml(b.tenDot || '')}</div>
            </div>
            <div class="action-row">
              <button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁 Chi tiết</button>
              <button class="btn btn-success btn-sm" onclick="duyetBCTT('${b.id}',true)">✓ Xác nhận</button>
              <button class="btn btn-danger btn-sm" onclick="duyetBCTT('${b.id}',false)">✗ Từ chối</button>
            </div>
          </div>
        </div>`;
      });
    }
    html += `</div>`;
    el.innerHTML = html;
    return;
  }
  let bcttList = [];
  let kltnList = [];
  if (u.role === 'gv') {
    bcttList = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_duyet');
    kltnList = DB.kltnList.filter(k => k.trangThai === 'cho_duyet'); // GV có thể duyệt tất cả KLTN chờ duyệt
  }
  const el = document.getElementById('page-duyetde');
  const activeTab = DB.nextDetaiTab === 'tab-kltn-duyet' ? 'tab-kltn-duyet' : 'tab-bctt-duyet';
  DB.nextDetaiTab = null;
  let html = `<div class="page-header"><h1>${u.role === 'bm' ? '👥 Duyệt & phân công PB' : '✅ Duyệt đề tài'}</h1><p>Duyệt đề tài chờ xử lý</p></div>`;

  if (u.role === 'gv') {
    html += `<div class="tabs">
      <button class="tab-btn ${activeTab === 'tab-bctt-duyet' ? 'active' : ''}" onclick="switchTab(event,'tab-bctt-duyet')">📝 BCTT (${bcttList.length})</button>
      <button class="tab-btn ${activeTab === 'tab-kltn-duyet' ? 'active' : ''}" onclick="switchTab(event,'tab-kltn-duyet')">🎓 KLTN (${kltnList.length})</button>
    </div>`;
  }

  html += `<div id="tab-bctt-duyet" class="tab-content ${activeTab === 'tab-bctt-duyet' ? 'active' : ''}">`;
  if (!bcttList.length) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Không có đề tài BCTT nào cần duyệt</div></div></div>`;
  } else {
    html += `<div class="form-group" style="margin-bottom:12px"><label><input type="checkbox" id="select-all-bctt" onchange="toggleSelectAll('bctt')"> Chọn tất cả</label></div>`;
    bcttList.forEach(b => {
      const sv = getUser(b.svEmail);
      html += `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div style="flex:1">
            <label style="display:flex;align-items:flex-start;gap:8px">
              <input type="checkbox" class="select-bctt" value="${b.dangKyId || extractId(b.id)}">
              <div>
                <div style="font-size:16px;font-weight:700;margin-bottom:6px;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div>
                <div style="font-size:12px;color:var(--text3);margin-bottom:8px">${escapeHtml(b.mangDeTai)} • ${escapeHtml(b.tenCongTy)}</div>
              </div>
            </label>
          </div>
          <div class="action-row">
            <button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁 Chi tiết</button>
            <button class="btn btn-success btn-sm" onclick="duyetBCTT('${b.id}',true)">✓ Xác nhận</button>
            <button class="btn btn-danger btn-sm" onclick="duyetBCTT('${b.id}',false)">✗ Từ chối</button>
          </div>
        </div>
      </div>`;
    });
    html += `<div class="action-row" style="margin-top:16px">
      <button class="btn btn-success" onclick="duyetSelectedBCTT(true)">✓ Duyệt các đề tài đã chọn</button>
      <button class="btn btn-danger" onclick="duyetSelectedBCTT(false)">✗ Từ chối các đề tài đã chọn</button>
    </div>`;
  }
  html += `</div>`;

  html += `<div id="tab-kltn-duyet" class="tab-content ${activeTab === 'tab-kltn-duyet' ? 'active' : ''}">`;
  if (!kltnList.length) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Không có đề tài KLTN nào cần duyệt</div></div></div>`;
  } else {
    html += `<div class="form-group" style="margin-bottom:12px"><label><input type="checkbox" id="select-all-kltn" onchange="toggleSelectAll('kltn')"> Chọn tất cả</label></div>`;
    kltnList.forEach(k => {
      const sv = getUser(k.svEmail);
      html += `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div style="flex:1">
            <label style="display:flex;align-items:flex-start;gap:8px">
              <input type="checkbox" class="select-kltn" value="${k.dangKyId || extractId(k.id)}">
              <div>
                <div style="font-size:16px;font-weight:700;margin-bottom:6px;cursor:pointer;color:var(--primary)" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div>
                <div style="font-size:12px;color:var(--text3);margin-bottom:8px">${escapeHtml(k.mangDeTai)} • ${escapeHtml(k.tenDot || '')}</div>
              </div>
            </label>
          </div>
          <div class="action-row">
            <button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button>
            <button class="btn btn-success btn-sm" onclick="duyetKLTN('${k.id}',true)">✓ Xác nhận</button>
            <button class="btn btn-danger btn-sm" onclick="duyetKLTN('${k.id}',false)">✗ Từ chối</button>
          </div>
        </div>
      </div>`;
    });
    html += `<div class="action-row" style="margin-top:16px">
      <button class="btn btn-success" onclick="duyetSelectedKLTN(true)">✓ Duyệt các đề tài đã chọn</button>
      <button class="btn btn-danger" onclick="duyetSelectedKLTN(false)">✗ Từ chối các đề tài đã chọn</button>
    </div>`;
  }
  html += `</div>`;

  el.innerHTML = html;
}

function selectDotForSlotAdmin(dotId) {
  DB.tbmSelectedDotId = String(dotId || '');
  renderDuyetDe();
}

async function createManagedDot() {
  const ten_dot = document.getElementById('tbm-dot-ten')?.value.trim();
  const loai = document.getElementById('tbm-dot-loai')?.value || 'BCTT';
  const nganh = document.getElementById('tbm-dot-nganh')?.value || '';
  const he_dao_tao = document.getElementById('tbm-dot-he')?.value || '';
  const han_dang_ky = document.getElementById('tbm-dot-han-dk')?.value || '';
  const han_nop = document.getElementById('tbm-dot-han-nop')?.value || '';
  const trang_thai = document.getElementById('tbm-dot-status')?.value || 'dong';
  const copy_from_dot_id = document.getElementById('tbm-dot-copy')?.value || '';
  if (!ten_dot || !nganh) {
    toast('Vui lòng nhập tên đợt và ngành', 'error');
    return;
  }
  try {
    await apiRequest('/api/dot/create', {
      method: 'POST',
      body: JSON.stringify({
        ten_dot,
        loai,
        nganh,
        he_dao_tao,
        han_dang_ky,
        han_nop,
        trang_thai,
        copy_from_dot_id: copy_from_dot_id || null,
      }),
    });
    toast('Tạo đợt thành công');
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleManagedDotStatus(dotId, trang_thai) {
  try {
    await apiRequest('/api/dot/update-status', {
      method: 'POST',
      body: JSON.stringify({ dot_id: dotId, trang_thai }),
    });
    toast(trang_thai === 'mo' ? 'Đã mở đợt' : 'Đã khóa đợt');
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteManagedDot(dotId) {
  if (!window.confirm('Xóa đợt này? Hệ thống sẽ xóa cả cấu hình slot của đợt nếu chưa có sinh viên đăng ký.')) return;
  try {
    await apiRequest('/api/dot/delete', {
      method: 'POST',
      body: JSON.stringify({ dot_id: dotId }),
    });
    toast('Đã xóa đợt');
    if (String(DB.tbmSelectedDotId) === String(dotId)) DB.tbmSelectedDotId = '';
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function saveGVSlotForDot(gvId, dotId, heDaoTao, slotId) {
  const quota = Number(document.getElementById(`slot-quota-${slotId}`)?.value || 0);
  const slot_con_lai = Number(document.getElementById(`slot-conlai-${slotId}`)?.value || 0);
  if (Number.isNaN(quota) || Number.isNaN(slot_con_lai)) {
    toast('Quota hoặc slot còn lại không hợp lệ', 'error');
    return;
  }
  try {
    await apiRequest('/api/gv-slot/update', {
      method: 'POST',
      body: JSON.stringify({
        slot_id: slotId,
        gv_id: gvId,
        dot_id: dotId,
        he_dao_tao: heDaoTao,
        quota,
        slot_con_lai,
      }),
    });
    toast('Đã cập nhật slot giảng viên');
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleGVSlotForDot(slotId, duyet) {
  try {
    await apiRequest('/api/gv-slot/duyet', {
      method: 'POST',
      body: JSON.stringify({ slot_id: slotId, duyet }),
    });
    toast(duyet ? 'Đã mở slot' : 'Đã khóa slot');
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}
// Phân công hội đồng 
function renderPhanCong() {
  const u = DB.currentUser;
  if (u.role !== 'bm') {
    document.getElementById('page-phancong').innerHTML = `<div class="page-header"><h1>🚫 Truy cập bị từ chối</h1><p>Chỉ trưởng bộ môn mới có quyền phân công.</p></div>`;
    return;
  }
  const el = document.getElementById('page-phancong');
  const needPB = DB.kltnList.filter(k => !k.gvPBEmail);
  const needHD = DB.kltnList.filter(k => !k.hoiDong);
  const needAction = DB.kltnList.filter(k => !k.gvPBEmail || !k.hoiDong);

 let html = `<div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <h1>👥 Phân công KLTN</h1>
          <p>${needPB.length} KLTN cần phân công PB • ${needHD.length} KLTN cần lập HĐ</p>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn-sm" style="background:#f97316;color:#fff;border:none" onclick="taoDuLieuTest()">🛠️ Tạo Data Test</button>
          
          <button class="btn btn-primary" onclick="showHoiDongModal()">➕ Thêm hội đồng</button>
        </div>
      </div>
    </div>`;

  // === KHỐI 1: DANH SÁCH HỘI ĐỒNG BẠN ĐÃ TẠO ===
  html += `<div class="card" style="margin-bottom:14px">
    <div class="card-title" style="margin-bottom:10px">🏛️ Danh sách Hội đồng bạn đã tạo</div>`;
    
  const currentUser = DB.currentUser || {};
  let myHoiDongList = [];
  
  if (DB.hoiDongList) {
    if (currentUser.role === 'admin') myHoiDongList = DB.hoiDongList;
    else myHoiDongList = DB.hoiDongList.filter(hd => hd.nguoiTaoEmail === currentUser.email);
  }

  if (myHoiDongList.length === 0) {
    html += `<div class="empty-state" style="padding:16px"><div class="empty-state-title" style="font-size:14px">Bạn chưa tạo hội đồng nào</div></div>`;
  } else {
    html += `<div class="table-wrap"><table>
      <thead><tr><th>Tên Hội đồng</th><th>Chủ tịch</th><th>Thư ký</th><th>Thời gian</th><th>Phòng</th><th>Thao tác</th></tr></thead>
      <tbody>`;
    myHoiDongList.forEach(hd => {
      const ctName = getUser(hd.ct)?.name || hd.ct;
      const tkName = getUser(hd.tk)?.name || hd.tk;
      let timeStr = hd.thoiGian ? new Date(hd.thoiGian).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'}) : 'Chưa xếp';

      html += `<tr>
        <td style="font-weight:600;color:var(--primary)">${escapeHtml(hd.ten)}</td>
        <td>${escapeHtml(ctName)}</td>
        <td>${escapeHtml(tkName)}</td>
        <td style="font-size:13px">${timeStr}</td>
        <td><span class="badge badge-gray">${escapeHtml(hd.phong || 'Chưa xếp')}</span></td>
        <td style="display:flex;gap:4px">
          <button class="btn btn-sm" style="background:#0284c7;color:#fff;border:none" onclick="showPhanCongSinhVienModal('${hd.id}')">👥 Thêm SV bảo vệ</button>
          <button class="btn btn-ghost btn-sm" onclick="showHoiDongModal('${hd.id}')">✏️ Sửa</button>
          <button class="btn btn-danger btn-sm" onclick="deleteHoiDong('${hd.id}')">🗑️ Xóa</button>
        </td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }
  html += `</div>`;

  // === KHỐI 2: DANH SÁCH KLTN ===
  html += `<div class="card" style="margin-bottom:14px"><div class="card-title" style="margin-bottom:10px">🧾 Danh sách KLTN cần phân công</div>`;
  if (!needAction.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Tất cả KLTN đã được phân công đầy đủ PB và HĐ</div></div>`;
  } else {
    needAction.forEach(k => {
      const missingTags = [];
      if (!k.gvPBEmail) missingTags.push('<span class="badge badge-orange">Thiếu PB</span>');
      if (!k.hoiDong) missingTags.push('<span class="badge badge-red">Thiếu HĐ</span>');

      html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;cursor:pointer;color:var(--primary)" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div>
          <div style="margin-top:4px">${missingTags.join(' ')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button>
          <button class="btn btn-primary btn-sm" onclick="phanCongPBKLTN('${k.id}')">Phân công PB</button>
        </div>
      </div>`;
    });
  }
  html += `</div>`;
  el.innerHTML = html;
}


function showHoiDongModal(editId = null) {
  const gvList = DB.users.filter(u => u.role === 'gv' || u.role === 'bm');
  let hd = null;
  
  if (editId) {
    hd = DB.hoiDongList.find(x => x.id === editId);
  }

  // Hàm helper để tạo option list và tự động chọn đúng người cũ
  const getGvOptions = (selectedValue) => {
    return gvList.map(g => `<option value="${g.email}" ${g.email === selectedValue ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
  };

  // Render danh sách thành viên cũ (nếu có)
  let tvHtml = '';
  if (hd && hd.tv && hd.tv.length > 0) {
    hd.tv.forEach(tvEmail => {
      tvHtml += `<div class="hd-member-row" style="display:flex;gap:8px;margin-bottom:8px">
        <select class="hd-tv" style="flex:1"><option value="">-- Chọn Thành viên --</option>${getGvOptions(tvEmail)}</select>
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">Xóa</button>
      </div>`;
    });
  } else {
    tvHtml = `<div class="hd-member-row" style="display:flex;gap:8px;margin-bottom:8px">
        <select class="hd-tv" style="flex:1"><option value="">-- Chọn Thành viên --</option>${getGvOptions('')}</select>
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">Xóa</button>
      </div>`;
  }

  let html = `<div class="modal-header">
      <div class="modal-title">${hd ? '✏️ Chỉnh sửa Hội Đồng' : '🏛️ Thêm Hội Đồng Mới'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    
    <input type="hidden" id="hd-id" value="${hd ? hd.id : ''}">
    
    <div class="form-group">
      <label>Tên hội đồng *</label>
      <input type="text" id="hd-ten" value="${hd ? escapeHtml(hd.ten) : ''}" placeholder="VD: Hội đồng Kỹ thuật phần mềm 1">
    </div>
    
    <div class="grid-2">
      <div class="form-group">
        <label>Ngày giờ bảo vệ</label>
        <input type="datetime-local" id="hd-thoigian" value="${hd ? hd.thoiGian : ''}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px">
      </div>
      <div class="form-group">
        <label>Mã phòng</label>
        <input type="text" id="hd-phong" value="${hd ? escapeHtml(hd.phong || '') : ''}" placeholder="VD: A1-202">
      </div>
    </div>
    
    <div class="grid-2">
      <div class="form-group">
        <label>Chủ tịch hội đồng *</label>
        <select id="hd-ct"><option value="">-- Chọn Chủ tịch --</option>${getGvOptions(hd ? hd.ct : '')}</select>
      </div>
      <div class="form-group">
        <label>Thư ký hội đồng *</label>
        <select id="hd-tk"><option value="">-- Chọn Thư ký --</option>${getGvOptions(hd ? hd.tk : '')}</select>
      </div>
    </div>

    <div class="form-group">
      <label>Thành viên hội đồng</label>
      <div id="hd-members-container">
        ${tvHtml}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="addHoiDongMemberSelect()" style="margin-top:4px">➕ Thêm thành viên</button>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Hủy</button>
      <button class="btn btn-primary" onclick="saveHoiDong()">💾 Lưu Hội Đồng</button>
    </div>`;

  showModal(html);
}
// Hiển thị Modal để chọn danh sách sinh viên cho một hội đồng
function showPhanCongSinhVienModal(hdId) {
  const hd = DB.hoiDongList.find(x => x.id === hdId);
  if (!hd) return;

  // Lọc ra các sinh viên KLTN CHƯA có hội đồng, HOẶC ĐANG nằm trong hội đồng này
  const dsKLTN = DB.kltnList.filter(k => !k.hoiDong || k.hoiDong.id === hdId);

  let timeStr = hd.thoiGian ? new Date(hd.thoiGian).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'}) : 'Chưa xếp';

  let svHtml = '';
  if (dsKLTN.length === 0) {
    svHtml = '<div style="padding:16px; color:var(--text3); font-style:italic; text-align:center">Không có sinh viên nào chờ phân công hội đồng.</div>';
  } else {
    svHtml = dsKLTN.map(k => {
      const sv = getUser(k.svEmail);
      // Đánh dấu check nếu sinh viên này đã thuộc hội đồng đang xem
      const isChecked = (k.hoiDong && k.hoiDong.id === hdId) ? 'checked' : '';
      return `
        <label style="display:flex; align-items:flex-start; gap:12px; padding:12px; border-bottom:1px solid var(--border); cursor:pointer">
          <input type="checkbox" class="chk-sv-hoidong" value="${k.id}" ${isChecked} style="margin-top:4px; transform:scale(1.2)">
          <div>
            <div style="font-weight:600; color:var(--primary)">${escapeHtml(k.tenDeTai)}</div>
            <div style="font-size:12px; color:var(--text2); margin-top:2px">SV: ${escapeHtml(sv?.name || k.svEmail)} • Ngành: ${escapeHtml(k.mangDeTai)}</div>
          </div>
        </label>
      `;
    }).join('');
  }

  let html = `
    <div class="modal-header">
      <div class="modal-title">👥 Phân công Sinh viên bảo vệ</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    
    <div style="background:var(--bg); padding:16px; border-radius:6px; border:1px solid var(--border); margin-bottom:16px; font-size:13.5px">
      <div style="font-weight:800; font-size:15px; margin-bottom:12px; color:var(--primary); text-transform:uppercase">${escapeHtml(hd.ten)}</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
        <div><strong>Chủ tịch:</strong> ${escapeHtml(getUser(hd.ct)?.name || hd.ct)}</div>
        <div><strong>Thư ký:</strong> ${escapeHtml(getUser(hd.tk)?.name || hd.tk)}</div>
        <div style="grid-column:1/-1"><strong>Thành viên:</strong> ${escapeHtml((hd.tv || []).map(e => getUser(e)?.name || e).join(', '))}</div>
        <div><strong>🕒 Thời gian:</strong> ${timeStr}</div>
        <div><strong>🚪 Phòng:</strong> ${escapeHtml(hd.phong || 'Chưa xếp')}</div>
      </div>
    </div>

    <div style="font-weight:700; margin-bottom:8px">Chọn sinh viên tham gia hội đồng này:</div>
    <div style="max-height:300px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; margin-bottom:16px; background:#fff">
      ${svHtml}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Hủy</button>
      <button class="btn btn-primary" onclick="submitBulkPhanCong('${hdId}')">💾 Lưu phân công</button>
    </div>
  `;
  showModal(html);
}

// Lưu các checkbox được chọn
async function submitBulkPhanCong(hdId) {
  const hd = DB.hoiDongList.find(x => x.id === hdId);
  if (!hd) return;

  const checkboxes = document.querySelectorAll('.chk-sv-hoidong');
  const selectedKltnIds = Array.from(checkboxes).filter(chk => chk.checked).map(chk => chk.value);
  const unselectedKltnIds = Array.from(checkboxes).filter(chk => !chk.checked).map(chk => chk.value);

  // Phân tích người dùng ra ID để gửi lên server (nếu cần)
  const ctUser = DB.users.find(u => u.email === hd.ct);
  const tkUser = DB.users.find(u => u.email === hd.tk);
  const tvUsers = (hd.tv || []).map(email => DB.users.find(u => u.email === email)).filter(Boolean);

  try {
    // 1. Thêm hội đồng cho các SV được CHECK
    for (const kId of selectedKltnIds) {
      const k = DB.kltnList.find(x => x.id === kId);
      if (k && (!k.hoiDong || k.hoiDong.id !== hdId)) {
        
        // Gọi API lên backend nếu có
        await apiRequest("/api/phan-cong/hoi-dong", {
          method: "POST",
          body: JSON.stringify({ dang_ky_id: k.dangKyId || extractId(k.id), ct_id: ctUser ? ctUser.id : null, tk_id: tkUser ? tkUser.id : null, tv_ids: tvUsers.map(u => u.id) })
        }).catch(() => {});

        // Cập nhật ở giao diện
        k.hoiDong = { id: hd.id, ct: hd.ct, tk: hd.tk, tv: hd.tv, tenHD: hd.ten, phong: hd.phong, thoiGian: hd.thoiGian };
      }
    }

    // 2. Gỡ bỏ hội đồng cho các SV bị BỎ CHECK (UNCHECK)
    for (const kId of unselectedKltnIds) {
       const k = DB.kltnList.find(x => x.id === kId);
       if (k && k.hoiDong && k.hoiDong.id === hdId) {
         k.hoiDong = null; // Gỡ hội đồng
       }
    }

    toast('✅ Đã cập nhật danh sách sinh viên bảo vệ!');
    closeModalForce();
    if (DB.currentPage === 'phancong') renderPhanCong();
  } catch (err) {
    toast(err.message, 'error');
  }
}
// Hàm render thêm 1 ô chọn Giảng viên khi bấm nút "Thêm thành viên"
function addHoiDongMemberSelect() {
  const container = document.getElementById('hd-members-container');
  const gvList = DB.users.filter(u => u.role === 'gv' || u.role === 'bm');
  const gvOptions = gvList.map(g => `<option value="${g.email}">${escapeHtml(g.name)}</option>`).join('');

  const row = document.createElement('div');
  row.className = 'hd-member-row';
  row.style = 'display:flex;gap:8px;margin-bottom:8px';
  row.innerHTML = `
    <select class="hd-tv" style="flex:1"><option value="">-- Chọn Thành viên --</option>${gvOptions}</select>
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">Xóa</button>
  `;
  container.appendChild(row);
}

// Hàm lưu chung cho cả việc Tạo mới và Cập nhật
function saveHoiDong() {
  const id = document.getElementById('hd-id').value;
  const ten = document.getElementById('hd-ten').value.trim();
  const thoiGian = document.getElementById('hd-thoigian').value;
  const phong = document.getElementById('hd-phong').value.trim();
  const ct = document.getElementById('hd-ct').value;
  const tk = document.getElementById('hd-tk').value;

  const tvSelects = document.querySelectorAll('.hd-tv');
  const tvs = Array.from(tvSelects).map(s => s.value).filter(val => val !== "");
  const uniqueTvs = [...new Set(tvs)];

  if (!ten || !ct || !tk) {
    toast('Vui lòng nhập Tên hội đồng, Chủ tịch và Thư ký', 'error');
    return;
  }

  // Check 1: Không trùng nhiệm vụ trong cùng 1 hội đồng
  const allSelected = [ct, tk, ...uniqueTvs].filter(Boolean);
  const uniqueAll = new Set(allSelected); 
  if (allSelected.length !== uniqueAll.size) {
    toast('Mỗi giáo viên chỉ được đảm nhận 1 nhiệm vụ trong cùng một hội đồng!', 'error');
    return;
  }

  if (!DB.hoiDongList) DB.hoiDongList = [];

  // Check 2: Không trùng giáo viên với hội đồng khác
  let gvBiTrung = null;
  let tenHoiDongTrung = "";
  for (const hdCu of DB.hoiDongList) {
    if (id && hdCu.id === id) continue;
    const thanhVienHdCu = [hdCu.ct, hdCu.tk, ...(hdCu.tv || [])].filter(Boolean);
    for (const emailGv of allSelected) {
      if (thanhVienHdCu.includes(emailGv)) {
        gvBiTrung = emailGv;
        tenHoiDongTrung = hdCu.ten;
        break;
      }
    }
    if (gvBiTrung) break;
  }

  if (gvBiTrung) {
    const thongTinGv = getUser(gvBiTrung);
    const tenGv = thongTinGv ? thongTinGv.name : gvBiTrung;
    toast(`Lỗi: Giảng viên ${tenGv} đã tham gia "${tenHoiDongTrung}"!`, 'error');
    return;
  }

function deleteHoiDong(id) {
  if (!window.confirm("Bạn có chắc chắn muốn xóa hội đồng này không? Thao tác này không thể hoàn tác.")) {
    return;
  }
  // Lọc bỏ hội đồng có id trùng với id cần xóa
  if (DB.hoiDongList) {
    DB.hoiDongList = DB.hoiDongList.filter(hd => hd.id !== id);
  }
  // Cập nhật lại Local Storage
  localStorage.setItem('hoiDongList', JSON.stringify(DB.hoiDongList));
  // Thông báo và tải lại giao diện
  toast("🗑️ Đã xóa hội đồng thành công!");
  if (DB.currentPage === 'phancong') {
    renderPhanCong();
  }
}
  // Tiến hành lưu
  const currentUser = DB.currentUser || {};
  if (id) {
    const hdIndex = DB.hoiDongList.findIndex(x => x.id === id);
    if (hdIndex > -1) {
      const hdCu = DB.hoiDongList[hdIndex];
      DB.hoiDongList[hdIndex] = { 
        id, ten, thoiGian, phong, ct, tk, tv: uniqueTvs,
        nguoiTaoEmail: hdCu.nguoiTaoEmail,
        nguoiTaoTen: hdCu.nguoiTaoTen,
        nguoiTaoMa: hdCu.nguoiTaoMa
      };
      toast('✅ Đã cập nhật hội đồng thành công!');
    }
  } else {
    const newHD = {
      id: 'hd_' + Date.now(),
      ten, thoiGian, phong, ct, tk, tv: uniqueTvs,
      nguoiTaoEmail: currentUser.email,
      nguoiTaoTen: currentUser.name,
      nguoiTaoMa: currentUser.ma || currentUser.msgv || 'Không có mã'
    };
    DB.hoiDongList.push(newHD); 
    toast('✅ Đã tạo hội đồng thành công!');
  }
  
  // Lưu cứng vào bộ nhớ trình duyệt
  localStorage.setItem('hoiDongList', JSON.stringify(DB.hoiDongList));
  closeModalForce();
  if (DB.currentPage === 'phancong') renderPhanCong();
}
// phân công hội đồng 
function renderNhapDiem() {
  const u = DB.currentUser;
  const el = document.getElementById('page-nhapDiem');
  let list = [];
  if (u.role === 'gv') list = gvKLTNListForNhapDiem(u);
  else if (u.role === 'bm') list = DB.kltnList.filter((k) => ['cham_diem', 'bao_ve'].includes(k.trangThai));

  let html = `<div class="page-header"><h1>📊 Nhập điểm & bảo vệ KLTN</h1><p>${list.length} đề tài</p></div>`;

  if (!list.length) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-title">Không có KLTN nào</div></div></div>`;
  } else {
    list.forEach((k) => {
      const sv = getUser(k.svEmail);
      const assignment = getKLTNAssignment(u, k);
      
      const isHD = Boolean(assignment.isAdvisor);
      const isPB = Boolean(assignment.isReviewer);
      const isCT = Boolean(assignment.isChair);
      const isTK = Boolean(assignment.isSecretary);
      const isTVMember = Boolean(assignment.isCommitteeMember);
      const canReviewRevision = Boolean(k.fileBaiChinhSua && k.fileGiaiTrinh);

      html += `<div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <div>
            <div class="card-title" onclick="viewKLTNDetail('${k.id}')" style="cursor:pointer;color:var(--primary)">${escapeHtml(k.tenDeTai)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:4px">${escapeHtml(sv?.name || k.svEmail)}</div>
          </div>
          ${statusBadge(k.trangThai)}
        </div>`;

      // Hàm nội bộ để render từng phần điểm
      const renderScoreSection = (roleLabel, roleId, score, note, saveFunc) => {
        const hasScore = score !== null && score !== undefined && score !== '';
        const isEditing = k[`isEditing_${roleId}`]; // Kiểm tra xem có đang bật chế độ sửa không
        
        if (hasScore && !isEditing) {
          // GIAO DIỆN NGẮN GỌN
          return `
            <div class="score-summary" style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight: 700; color: var(--primary);">${roleLabel}:</span> 
                <b style="font-size: 16px; margin-left: 8px;">${score} điểm</b>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #666; font-style: italic;">"${escapeHtml(note || 'Không có nhận xét')}"</p>
              </div>
              <button class="btn btn-outline btn-sm" onclick="enableEditScore('${k.id}', '${roleId}')">✏️ Sửa</button>
            </div>`;
        } else {
          // GIAO DIỆN ĐẦY ĐỦ (Mở form khi chưa có điểm, hoặc khi bấm Sửa)
          return `
            <div id="form-${roleId}-${k.id}" style="margin-top: 12px; border-top: 1px dashed #ddd; padding-top: 12px;">
              <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:8px">${roleLabel} — chấm điểm</div>
              <div class="form-group">
                <label>Điểm</label>
                <input type="number" step="0.1" id="diem-${roleId}-${k.id}" value="${score ?? ''}">
              </div>
              <div class="form-group">
                <label>Nhận xét</label>
                <textarea id="note-${roleId}-${k.id}" rows="3" placeholder="Nhập nhận xét...">${escapeHtml(note || '')}</textarea>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary btn-sm" onclick="${saveFunc}('${k.dangKyId}', '${k.id}')">💾 Lưu điểm</button>
                ${isEditing ? `<button class="btn btn-outline btn-sm" onclick="cancelEditScore('${k.id}', '${roleId}')">❌ Hủy</button>` : ''}
              </div>
            </div>`;
        }
      };
      if (isHD) {
        html += `<div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:8px">🎯 GV hướng dẫn — chấm điểm</div>
          <div class="form-group"><label>Điểm HD</label><input type="number" id="diem-hd-${k.id}" value="${k.diemHD ?? ''}"></div>
          <div class="form-group"><label>Nhận xét & câu hỏi</label><textarea id="nhanxet-hd-${k.id}" rows="4" placeholder="Nhập nhận xét và câu hỏi...">${escapeHtml(k.hdNote || '')}</textarea></div>
          <button class="btn btn-primary btn-sm" onclick="saveScoreHD('${k.dangKyId}')">💾 Lưu điểm</button>`;
        html += `<div style="margin-top:12px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg)">
          <div style="font-size:13px;font-weight:700;color:var(--primary-dark);margin-bottom:6px">🛠️ Duyệt chỉnh sửa sau bảo vệ</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
            Trạng thái hiện tại: ${k.xacNhanGVHD ? '<span style="color:#16a34a;font-weight:700">✅ Đã duyệt</span>' : '<span style="color:#d97706;font-weight:700">⏳ Chưa duyệt</span>'}
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">
            ${canReviewRevision ? 'Sinh viên đã nộp đủ bài chỉnh sửa và biên bản giải trình. GVHD có thể duyệt hoặc từ chối.' : 'Nút duyệt chỉ hiện khi sinh viên đã nộp đủ bài chỉnh sửa và biên bản giải trình.'}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${canReviewRevision ? `<button class="btn btn-success btn-sm" onclick="approveKLTNRevision('${k.id}','gvhd',true)">Duyệt chỉnh sửa</button>` : ''}
            ${canReviewRevision ? `<button class="btn btn-danger btn-sm" onclick="approveKLTNRevision('${k.id}','gvhd',false)">Từ chối chỉnh sửa</button>` : ''}
            ${canReviewRevision ? `<button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">Xem file chỉnh sửa</button>` : ''}
          </div>
        </div>`;
      }

      if (assignment.isAdvisor) html += renderScoreSection('🎯 Hướng dẫn', 'hd', k.diemHD, k.hdNote, 'handleSaveScoreHD');
      if (assignment.isReviewer) html += renderScoreSection('📋 Phản biện', 'pb', k.diemPB, k.pbNote, 'handleSaveScorePB');
      if (assignment.isChair) html += renderScoreSection('👔 Chủ tịch', 'ct', k.diemBB, k.ctNote, 'handleSaveScoreCT');

      html += `</div>`;
    });
  }
  el.innerHTML = html;
}
// Bật chế độ sửa điểm
function enableEditScore(kltnId, roleId) {
  const k = DB.kltnList.find(x => x.id === kltnId);
  if (!k) return;
  k[`isEditing_${roleId}`] = true; // Bật cờ edit lên
  renderNhapDiem(); // Vẽ lại giao diện, form sẽ mở ra cùng dữ liệu cũ
}

// Hủy chế độ sửa (đóng form lại như cũ)
function cancelEditScore(kltnId, roleId) {
  const k = DB.kltnList.find(x => x.id === kltnId);
  if (!k) return;
  k[`isEditing_${roleId}`] = false; // Tắt cờ edit
  renderNhapDiem();
}

// --- CÁC HÀM XỬ LÝ LƯU ĐIỂM GỌI API ---

function handleSaveScoreHD(dangKyId, kltnId) {
  saveScoreToAPI(dangKyId, kltnId, 'HD', 'diemHD', 'hdNote');
}

function handleSaveScorePB(dangKyId, kltnId) {
  saveScoreToAPI(dangKyId, kltnId, 'PB', 'diemPB', 'pbNote');
}

function handleSaveScoreCT(dangKyId, kltnId) {
  saveScoreToAPI(dangKyId, kltnId, 'CT', 'diemBB', 'ctNote');
}

// Hàm dùng chung để gọi API, code cực kỳ gọn gàng
function saveScoreToAPI(dangKyId, kltnId, vaiTro, ramScoreKey, ramNoteKey) {
  const suffix = vaiTro.toLowerCase();
  const score = document.getElementById(`diem-${suffix}-${kltnId}`).value;
  const note = document.getElementById(`note-${suffix}-${kltnId}`).value;

  if (!score) return alert("Vui lòng nhập điểm!");

  const payload = {
    dang_ky_id: dangKyId,
    vai_tro: vaiTro,
    diem: parseFloat(score),
    nhan_xet: note
  };

  apiRequest('/api/kltn/grade', 'POST', payload).then(res => {
    if (res.ok) {
      // Cập nhật lại Database cục bộ (RAM)
      const k = DB.kltnList.find(x => x.id === kltnId);
      k[ramScoreKey] = payload.diem;
      k[ramNoteKey] = payload.nhan_xet;
      k[`isEditing_${suffix}`] = false; // Tắt chế độ sửa sau khi lưu thành công

      toast(`✅ Đã lưu điểm ${vaiTro} thành công!`);
      renderNhapDiem(); // Chuyển sang dạng ngắn gọn ngay lập tức
    } else {
      alert("Lỗi khi lưu điểm: " + (res.message || "Unkown error"));
    }
  });
}

function handleSaveScoreCT(dangKyId, kltnId) {
  const score = document.getElementById(`diem-ct-${kltnId}`).value;
  const note = document.getElementById(`note-ct-${kltnId}`).value;

  if (!score) return alert("Vui lòng nhập điểm!");

  const payload = {
    dang_ky_id: dangKyId,
    vai_tro: 'CT',
    diem: parseFloat(score),
    nhan_xet: note
  }
}
function renderHuongDan() {
  const u = DB.currentUser;
  const list = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_duyet');
  const chamList = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_cham');
  const el = document.getElementById('page-huongdan');
  let html = `<div class="page-header"><h1>✅ Hướng dẫn</h1><p>Duyệt BCTT và chấm BCTT theo quy trình</p></div>`;

  html += `<div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div class="card-title">🟡 BCTT chờ duyệt</div>
      <div style="font-size:12px;color:var(--text3)">${list.length} hồ sơ</div>
    </div>`;
  if (!list.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Không có đề tài chờ duyệt</div></div>`;
  } else {
    html += `<div class="form-group" style="margin-bottom:12px"><label><input type="checkbox" id="select-all-bctt-huongdan" onchange="toggleSelectAllHuongDan('bctt')"> Chọn tất cả</label></div>`;
    list.forEach(b => {
      const sv = getUser(b.svEmail);
      html += `<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:160px">
        <label style="display:flex;align-items:flex-start;gap:8px">
          <input type="checkbox" class="select-bctt-huongdan" value="${b.dangKyId || extractId(b.id)}">
          <div>
            <div style="font-weight:700;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:4px">${escapeHtml(sv?.name || b.svEmail)} • ${escapeHtml(b.tenCongTy || '')}</div>
          </div>
        </label>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁 Chi tiết</button><button class="btn btn-success btn-sm" onclick="duyetBCTT('${b.id}',true)">Đồng ý</button> <button class="btn btn-danger btn-sm" onclick="duyetBCTT('${b.id}',false)">Không đồng ý</button></div></div></div>`;
    });
    html += `<div class="action-row" style="margin-top:16px">
      <button class="btn btn-success" onclick="duyetSelectedBCTTHuongDan(true)">✓ Duyệt các đề tài đã chọn</button>
      <button class="btn btn-danger" onclick="duyetSelectedBCTTHuongDan(false)">✗ Từ chối các đề tài đã chọn</button>
    </div>`;
  }

  html += `</div>`;

  html += `<div class="card">
    <div class="card-header">
      <div class="card-title">🧑‍🏫 BCTT chờ chấm</div>
      <div style="font-size:12px;color:var(--text3)">${chamList.length} hồ sơ</div>
    </div>`;
  if (!chamList.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">Chưa có hồ sơ BCTT nào chờ chấm</div></div>`;
  } else {
    chamList.forEach(b => {
      const sv = getUser(b.svEmail);
      html += `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:220px">
            <div style="font-weight:700;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:4px">${escapeHtml(sv?.name || b.svEmail)} • ${escapeHtml(b.mangDeTai || '')}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:4px">${escapeHtml(b.tenCongTy || '')}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:8px">
              Báo cáo:
              ${b.fileBC ? `<a href="${uploadFileHref(b.fileBC)}" target="_blank" rel="noopener">Mở file</a>` : "Chưa có"}
              &nbsp;•&nbsp;
              Xác nhận:
              ${b.fileXacNhan ? `<a href="${uploadFileHref(b.fileXacNhan)}" target="_blank" rel="noopener">Mở file</a>` : "Chưa có"}
              &nbsp;•&nbsp;
              Turnitin:
              ${b.fileTurnitinBCTT ? `<a href="${uploadFileHref(b.fileTurnitinBCTT)}" target="_blank" rel="noopener">Mở file</a>` : "Chưa có"}
            </div>
          </div>
          <div style="width:320px;max-width:100%">
            <div class="form-group">
              <label>Điểm BCTT</label>
              <input type="number" id="bctt-diem-${b.id}" min="0" max="10" step="0.1" value="${b.diemBCTT ?? ''}" placeholder="Nhập điểm từ 0 đến 10">
            </div>
            <div class="form-group">
              <label>Nhận xét</label>
              <textarea id="bctt-nhanxet-${b.id}" placeholder="Nhập nhận xét cho sinh viên" style="min-height:88px">${escapeHtml(b.nhanXetBCTT || '')}</textarea>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁 Chi tiết</button>
              <button class="btn btn-primary btn-sm" onclick="chamBCTT('${b.id}')">💾 Lưu điểm BCTT</button>
            </div>
          </div>
        </div>
      </div>`;
    });
  }

  html += `</div>`;
  el.innerHTML = html;
}

function renderNhapDiem() {
  const u = DB.currentUser;
  const el = document.getElementById('page-nhapDiem');
  const list = gvKLTNListForNhapDiem(u);
  let html = `<div class="page-header"><h1>📊 Chấm điểm đề tài</h1><p>Danh sách KLTN bạn đang được phân công chấm điểm</p></div>`;

  if (!list.length) {
    el.innerHTML = `${html}<div class="card"><div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Hiện chưa có đề tài nào cần bạn chấm điểm</div></div></div>`;
    return;
  }

  list.sort((a, b) => String(a.tenDeTai || '').localeCompare(String(b.tenDeTai || ''), 'vi'));
  list.forEach((k) => {
    const sv = getUser(k.svEmail);
    const assignment = getKLTNAssignment(u, k);
    const roles = [];
    if (assignment.isAdvisor) roles.push('Hướng dẫn');
    if (assignment.isReviewer) roles.push('Phản biện');
    if (assignment.isChair) roles.push('Chủ tịch');
    if (assignment.isSecretary) roles.push('Thư ký');
    if (assignment.isCommitteeMember) roles.push('Thành viên HĐ');
    const isHD = Boolean(assignment.isAdvisor);
    const isPB = Boolean(assignment.isReviewer);
    const isCT = Boolean(assignment.isChair);
    const isTK = Boolean(assignment.isSecretary);
    const isTVMember = Boolean(assignment.isCommitteeMember);

    html += `<div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <div>
          <div class="card-title" style="cursor:pointer;color:var(--primary)" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">${escapeHtml(sv?.name || k.svEmail)} • ${escapeHtml(getTopicTypeLabel(k.topicType))}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:6px">Vai trò chấm: ${escapeHtml(roles.join(', ') || 'Được phân công')}</div>
        </div>
        ${statusBadge(k.trangThai)}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button>
      </div>`;

    if (isHD) {
      html += renderKLTNScoreBlock(
        k,
        'HD',
        '🎯 Giảng viên hướng dẫn — phiếu chấm',
        'Phiếu chấm thay đổi theo loại đề tài mà sinh viên đã đăng ký.',
        { existingScore: k.diemHD, noteValue: k.hdNote || '' }
      );
    }

    if (isPB) {
      html += renderKLTNScoreBlock(
        k,
        'PB',
        '🧾 Giảng viên phản biện — phiếu chấm',
        'Vai trò phản biện cần nhập đủ nhận xét và câu hỏi để đưa vào biên bản.',
        { existingScore: k.diemPB, noteValue: k.pbNote || '', questionValue: k.pbCauHoi || '', showQuestion: true }
      );
    }

    if (isCT) {
      html += `<div style="font-size:13px;color:var(--text3);margin-top:12px">👨‍⚖️ Bạn đang là Chủ tịch hội đồng. Ở tab này, bạn chỉ xác nhận đồng ý hoặc không đồng ý buổi báo cáo/bảo vệ sau khi hội đồng đã chấm; đây không phải bước duyệt bài chỉnh sửa của sinh viên.</div>`;
    }

    if (isTK) {
      html += `<div style="font-size:13px;color:var(--text3);margin-top:12px">📝 Bạn đang là Thư ký hội đồng. Vai trò này không chấm điểm riêng, nhưng sẽ tổng hợp nội dung và xuất biên bản ở tab Thư ký.</div>`;
    }

    if (isTVMember) {
      const myTVScore = getCurrentTVScore(k);
      html += renderKLTNScoreBlock(
        k,
        'TV',
        '🏛️ Thành viên hội đồng — phiếu chấm riêng',
        'Mỗi thành viên hội đồng có một phiếu chấm riêng theo loại đề tài.',
        { existingScore: myTVScore?.diem, noteValue: myTVScore?.nhanXet || '' }
      );
    }

    html += `</div>`;
  });

  el.innerHTML = html;
  list.forEach((k) => {
    ['HD', 'PB', 'TV'].forEach((vaiTro) => {
      if (document.getElementById(totalInputId(k.id, vaiTro))) {
        recalcKLTNRoleTotal(k.id, vaiTro);
      }
    });
  });
}

function renderUsers() {
  const el = document.getElementById('page-users');
  let html = `<div class="page-header"><h1>👥 Quản lý Người dùng</h1><p>Tổng cộng ${DB.users.length} tài khoản</p></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary btn-sm" onclick="addUserModal()">➕ Thêm người dùng</button>
    </div>
    <div class="card">
    <div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>`;
  DB.users.forEach(u => {
    const roleColors = { sv: 'badge-purple', gv: 'badge-green', bm: 'badge-blue', admin: 'badge-red' };
    const roleNames = { sv: 'Sinh viên', gv: 'Giảng viên', bm: 'Trưởng BM', admin: 'Admin' };
    html += `<tr>
      <td><div style="font-weight:600">${u.name}</div></td>
      <td style="font-size:12px;font-family:'JetBrains Mono'">${u.email}</td>
      <td><span class="badge ${roleColors[u.role]}">${roleNames[u.role]}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="editUserModal('${u.email}')">✏️ Sửa</button></td>
    </tr>`;
  });
  html += `</tbody></table></div></div>`;
  el.innerHTML = html;
}

function renderProfile() {
  const u = DB.currentUser;
  const roleNames = { sv: 'Sinh viên', gv: 'Giảng viên', bm: 'Trưởng Bộ Môn', admin: 'Quản trị viên' };
  const idLabel = u.role === 'sv' ? 'Mã số sinh viên' : u.role === 'gv' || u.role === 'bm' ? 'Mã giảng viên' : 'Mã số';
  const idValue = u.role === 'sv' ? (u.mssv || u.ma) : (u.msgv || u.ma || '–');
  const majorValue = Array.isArray(u.chuyenMon) ? u.chuyenMon.join(', ') : (u.chuyenMon || '–');
  const departmentValue = u.khoa || 'Kinh tế';
  const trainingValue = u.heDaoTao === 'CLC' ? 'CLC' : u.heDaoTao === 'DaiTra' ? 'Đại trà' : (u.heDaoTao || '–');
  const el = document.getElementById('page-profile');
  el.innerHTML = `<div class="page-header"><h1>👤 Hồ sơ cá nhân</h1></div>
    <div class="grid-2">
      <div class="card">
        <div style="text-align:center;padding:20px 0">
          <div style="width:80px;height:80px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;margin:0 auto 12px">${u.name ? u.name.charAt(0) : ''}</div>
          <div style="font-size:20px;font-weight:700">${escapeHtml(u.name || '')}</div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px">${escapeHtml(u.email || '')}</div>
          <span class="badge badge-blue" style="margin-top:8px">${roleNames[u.role] || 'Người dùng'}</span>
        </div>
        <div style="padding:0 20px 20px">
          <div class="info-row"><span class="info-label">${escapeHtml(idLabel)}:</span><span class="info-value">${escapeHtml(idValue)}</span></div>
          <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${escapeHtml(u.email || '–')}</span></div>
          <div class="info-row"><span class="info-label">Khoa:</span><span class="info-value">${escapeHtml(departmentValue)}</span></div>
          <div class="info-row"><span class="info-label">Ngành:</span><span class="info-value">${escapeHtml(majorValue)}</span></div>
          ${['gv','bm'].includes(u.role) ? '' : `<div class="info-row"><span class="info-label">Hệ đào tạo:</span><span class="info-value">${escapeHtml(trainingValue)}</span></div>`}
          <div class="info-row no-divider"><span class="info-label">Vai trò:</span><span class="info-value">${escapeHtml(roleNames[u.role] || 'Người dùng')}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">🔑 Đổi mật khẩu</div>
        <div class="form-group"><label>Mật khẩu hiện tại</label><input type="password" id="pw-old" placeholder="••••••••"></div>
        <div class="form-group"><label>Mật khẩu mới</label><input type="password" id="pw-new" placeholder="••••••••"></div>
        <div class="form-group"><label>Xác nhận mật khẩu mới</label><input type="password" id="pw-confirm" placeholder="••••••••"></div>
        <button class="btn btn-primary btn-sm" onclick="changePassword()">🔑 Cập nhật mật khẩu</button>
      </div>
    </div>`;
}

// ============================================================
// CÁC HÀM XỬ LÝ KHÁC (Phản biện, Thống kê, Gợi ý, Theo dõi)
// ============================================================
function isUploadPath(value) {
  return /^uploads[\\/]/i.test(String(value || ''));
}

function getSecretaryDraftValue(k) {
  return isUploadPath(k?.tkBienBan) ? '' : (k?.tkBienBan || '');
}

function getKLTNRoleRecords(selector) {
  const u = DB.currentUser;
  if (!u) return [];
  return DB.kltnList
    .filter((k) => selector(getKLTNAssignment(u, k), k))
    .sort((a, b) => Number(b.dangKyId || 0) - Number(a.dangKyId || 0));
}

function renderKLTNRoleHeader(title, subtitle, count) {
  return `<div class="page-header"><h1>${title}</h1><p>${count} đề tài ${subtitle}</p></div>`;
}

function renderKLTNFileLinks(k, options = {}) {
  const items = [
    { label: 'Bài PDF', path: k.fileBai },
    { label: 'Bài Word', path: k.fileBaiWord },
    { label: 'Turnitin', path: k.fileTurnitin },
    { label: 'Biên bản HĐ', path: isUploadPath(k.tkBienBan) ? k.tkBienBan : '' },
    { label: 'Bài chỉnh sửa', path: k.fileBaiChinhSua },
    { label: 'Giải trình', path: k.fileGiaiTrinh },
  ].filter((item) => item.path || !options.onlyAvailable);

  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
    ${items.map((item) => item.path
      ? `<a class="btn btn-ghost btn-sm" href="${uploadFileHref(item.path)}" target="_blank" rel="noopener">📎 ${escapeHtml(item.label)}</a>`
      : `<span class="badge badge-gray">${escapeHtml(item.label)}: chưa có</span>`).join('')}
  </div>`;
}

function renderKLTNRoleMeta(k) {
  const sv = getUser(k.svEmail);
  const avg = computeKLTNFinalAvg(k);
  const studentCode = sv?.mssv || sv?.ma || '';
  return `<div class="kltn-role-meta">
    <div class="kltn-role-meta-main">
      <span>${escapeHtml(sv?.name || k.svEmail)}</span>
      ${studentCode ? `<span class="kltn-role-meta-code">MSSV ${escapeHtml(studentCode)}</span>` : ''}
    </div>
    <div class="kltn-role-meta-chips">
      <span class="kltn-role-chip kltn-role-chip-advisor">Giảng viên hướng dẫn: ${escapeHtml(getUser(k.gvHDEmail)?.name || k.gvHDEmail || '')}</span>
      ${k.hoiDong ? `<span class="kltn-role-chip">Chủ tịch hội đồng: ${escapeHtml(getUser(k.hoiDong.ct)?.name || k.hoiDong.ct || '')}</span>` : ''}
      ${avg != null ? `<span class="kltn-role-chip kltn-role-chip-score">Điểm trung bình: ${avg.toFixed(2)}</span>` : ''}
    </div>
  </div>`;
}

function renderKLTNRoleCardStart(k) {
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div>
        <div class="card-title" style="cursor:pointer;color:var(--primary)" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div>
        ${renderKLTNRoleMeta(k)}
      </div>
      ${statusBadge(k.trangThai)}
    </div>
    ${renderKLTNFileLinks(k, { onlyAvailable: false })}`;
}

function getGVNotificationRecipients() {
  const email = DB.currentUser?.email;
  if (!email) return [];
  const recipients = new Map();
  DB.bcttList
    .filter((b) => b.gvEmail === email && b.trangThai === 'gv_xac_nhan')
    .forEach((b) => {
      const user = getUser(b.svEmail) || { email: b.svEmail };
      recipients.set(user.email, { name: user.name || user.email, email: user.email });
    });
  DB.kltnList
    .filter((k) => k.gvHDEmail === email && k.trangThai === 'thuc_hien')
    .forEach((k) => {
      const user = getUser(k.svEmail) || { email: k.svEmail };
      recipients.set(user.email, { name: user.name || user.email, email: user.email });
    });
  return Array.from(recipients.values());
}

function getBMNotificationRecipients() {
  const majors = Array.isArray(DB.currentUser?.chuyenMon) ? DB.currentUser.chuyenMon : [];
  if (!majors.length) return [];
  const normalizedMajors = majors.map((m) => normalizeMajorName(String(m || ''))).filter(Boolean);

  return DB.users
    .filter((u) => u.role === 'sv' && Array.isArray(u.chuyenMon))
    .filter((u) => u.chuyenMon.some((major) => normalizedMajors.includes(normalizeMajorName(String(major || '')))))
    .map((u) => ({ name: u.name || u.email, email: u.email }));
}

function renderThongBao() {
  const u = DB.currentUser;
  const isGV = u.role === 'gv';
  const isBM = u.role === 'bm';
  const recipients = isGV ? getGVNotificationRecipients() : isBM ? getBMNotificationRecipients() : [];
  const targetLabel = isGV
    ? 'Sinh viên đã được GVHD đồng ý hướng dẫn'
    : 'Sinh viên cùng ngành của bạn';
  const recipientMessage = recipients.length
    ? `${recipients.length} sinh viên sẽ nhận thông báo.`
    : 'Hiện chưa có sinh viên phù hợp để nhận thông báo.';
  const el = document.getElementById('page-thongbao');
  el.innerHTML = `
    <div class="page-header notification-page-header">
      <div>
        <h1>Gửi thông báo</h1>
        <p class="page-subtitle">Gửi tin nhắn nhanh tới sinh viên đang hướng dẫn hoặc cùng chuyên ngành với bạn.</p>
      </div>
    </div>
    <div class="notification-grid">
      <div class="notification-card">
        <div class="notification-card-header">Thông tin mục tiêu</div>
        <div class="notification-card-row"><span>Đối tượng</span><strong>${escapeHtml(targetLabel)}</strong></div>
        <div class="notification-card-row"><span>Số người nhận</span><strong>${escapeHtml(String(recipients.length))} sinh viên</strong></div>
        <div class="notification-card-row"><span>Trạng thái</span><em>${escapeHtml(recipientMessage)}</em></div>
      </div>
      <div class="notification-card notification-card-action">
        <div class="notification-card-header">Nội dung thông báo</div>
        <textarea id="notif-message" class="notification-textarea" placeholder="Nhập nội dung thông báo..." rows="8"></textarea>
        <button class="btn btn-primary btn-notif-send" onclick="sendRoleNotification()">Gửi thông báo</button>
      </div>
    </div>
    ${!recipients.length ? `<div class="notification-alert">Không tìm thấy người nhận thông báo. Vui lòng kiểm tra lại điều kiện và trạng thái đăng ký.</div>` : ''}
  `;
}

async function sendRoleNotification() {
  const message = document.getElementById('notif-message')?.value.trim();
  if (!message) {
    return toast('Vui lòng nhập nội dung thông báo', 'error');
  }
  try {
    const res = await apiRequest('/api/thong-bao/gui', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    toast(res.message || 'Đã gửi thông báo', 'success');
    document.getElementById('notif-message').value = '';
    await loadNotifications();
    updateNotifDot();
  } catch (err) {
    toast(err.message || 'Gửi thông báo thất bại', 'error');
  }
}

function renderKLTNRoleCardEnd() {
  return `</div>`;
}

function buildSecretaryCouncilNotes(k) {
  const reviewerSection = k.pbNote || k.pbCauHoi
    ? [`Nhận xét phản biện: ${k.pbNote || ''}`, k.pbCauHoi ? `Câu hỏi phản biện: ${k.pbCauHoi}` : ''].filter(Boolean).join('\n')
    : '';
  const memberSection = (k.tvScores || [])
    .map((row) => {
      const name = getUser(row.email)?.name || row.email;
      return row.nhanXet ? `${name}: ${row.nhanXet}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return [reviewerSection, memberSection].filter(Boolean).join('\n\n');
}

function buildSecretaryScoreLines(k) {
  const lines = [];
  lines.push(`GVHD: ${k.diemHD != null ? k.diemHD : '–'}`);
  lines.push(`GVPB: ${k.diemPB != null ? k.diemPB : '–'}`);
  getKLTNCouncilBreakdown(k).forEach((row) => {
    const label = row.role === 'CT' ? 'Chủ tịch HĐ' : row.name;
    lines.push(`${label}: ${row.score != null ? row.score : '–'}`);
  });
  const councilScores = getKLTNCouncilScores(k);
  if (councilScores.length) {
    const councilAvg = councilScores.reduce((a, b) => a + b, 0) / councilScores.length;
    lines.push(`TB Hội đồng: ${councilAvg.toFixed(2)}`);
  }
  const finalAvg = computeKLTNFinalAvg(k);
  if (finalAvg != null) lines.push(`Điểm tổng hợp: ${finalAvg.toFixed(2)}`);
  return lines;
}

function buildSecretaryScoreRows(k) {
  const rows = [];
  rows.push({
    role: 'GVHD',
    name: getUser(k.gvHDEmail)?.name || k.gvHDEmail || 'Giảng viên hướng dẫn',
    score: k.diemHD != null ? String(k.diemHD) : '–',
  });
  rows.push({
    role: 'GVPB',
    name: getUser(k.gvPBEmail)?.name || k.gvPBEmail || 'Giảng viên phản biện',
    score: k.diemPB != null ? String(k.diemPB) : '–',
  });
  getKLTNCouncilBreakdown(k).forEach((row) => {
    rows.push({
      role: row.role,
      name: row.role === 'CT' ? (getUser(k.hoiDong?.ct)?.name || k.hoiDong?.ct || 'Chủ tịch hội đồng') : row.name,
      score: row.score != null ? String(row.score) : '–',
    });
  });
  const councilScores = getKLTNCouncilScores(k);
  if (councilScores.length) {
    const councilAvg = councilScores.reduce((a, b) => a + b, 0) / councilScores.length;
    rows.push({ role: 'Trung bình hội đồng', name: '', score: councilAvg.toFixed(2), emphasis: true, mergeName: true });
  }
  const finalAvg = computeKLTNFinalAvg(k);
  if (finalAvg != null) {
    rows.push({ role: 'TỔNG', name: 'Điểm tổng hợp', score: finalAvg.toFixed(2), highlight: true });
  }
  return rows;
}

function buildBienBanPayload(k, extraNotes, councilNotesOverride = null) {
  const sv = getUser(k.svEmail) || {};
  const svMajor = Array.isArray(sv.chuyenMon)
    ? (sv.chuyenMon.find((item) => String(item || '').trim()) || '')
    : '';
  const today = new Date();
  const councilScores = getKLTNCouncilScores(k);
  const councilAvg = councilScores.length ? (councilScores.reduce((a, b) => a + b, 0) / councilScores.length) : null;
  const finalAvg = computeKLTNFinalAvg(k);
  const tvNotes = (k.tvScores || [])
    .map((row) => {
      const name = getUser(row.email)?.name || row.email;
      return row.nhanXet ? `${name}: ${row.nhanXet}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const councilNotes = councilNotesOverride != null ? String(councilNotesOverride) : [k.pbNote ? `GV phản biện: ${k.pbNote}` : '', k.pbCauHoi ? `Câu hỏi PB: ${k.pbCauHoi}` : '', tvNotes].filter(Boolean).join('\n\n');

  return {
    dangKyId: k.dangKyId || extractId(k.id),
    tenKhoa: svMajor || k.mangDeTai || '',
    tenDeTai: k.tenDeTai || '',
    sinhVien: sv.name || k.svEmail,
    maSV: sv.ma || sv.mssv || '',
    tenGVHD: getUser(k.gvHDEmail)?.name || k.gvHDEmail || '',
    tenGVPB: getUser(k.gvPBEmail)?.name || k.gvPBEmail || '',
    tenChuTich: getUser(k.hoiDong?.ct)?.name || k.hoiDong?.ct || '',
    diemGVHD: k.diemHD != null ? String(k.diemHD) : '',
    diemGVPB: k.diemPB != null ? String(k.diemPB) : '',
    diemHoiDongTB: councilAvg != null ? councilAvg.toFixed(2) : '',
    diemTongHop: finalAvg != null ? finalAvg.toFixed(2) : '',
    diemThanhVien: buildSecretaryScoreLines(k).join('\n'),
    nhanXetCT: k.ctNote || '',
    nhanXetTV: councilNotes,
    yeuCauChinhSua: extraNotes || '',
    chuTichHD: getUser(k.hoiDong?.ct)?.name || k.hoiDong?.ct || '',
    thuKy: getUser(k.hoiDong?.tk)?.name || k.hoiDong?.tk || '',
    chuTichSauChinhSua: getUser(k.hoiDong?.ct)?.name || k.hoiDong?.ct || '',
    ngay: String(today.getDate()).padStart(2, '0'),
    thang: String(today.getMonth() + 1).padStart(2, '0'),
    nam: String(today.getFullYear()),
    ngay2: String(today.getDate()).padStart(2, '0'),
    thang2: String(today.getMonth() + 1).padStart(2, '0'),
    nam2: String(today.getFullYear()),
    khoaHoc: '',
  };
}

async function blobToBase64(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

async function acceptPhanBienKLTN(recordId) {
  const record = findKltnRecord(recordId);
  if (!record) return toast('Không tìm thấy hồ sơ KLTN', 'error');
  try {
    await apiRequest('/api/kltn/pb-accept', {
      method: 'POST',
      body: JSON.stringify({ dang_ky_id: record.dangKyId || extractId(record.id) }),
    });
    toast('Đã xác nhận vai trò phản biện');
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function approveKLTNRevision(recordId, step, dongY) {
  const record = findKltnRecord(recordId);
  if (!record) return toast('Không tìm thấy hồ sơ KLTN', 'error');
  let ly_do = '';
  if (!dongY) {
    ly_do = window.prompt(step === 'cthd' ? 'Nhập lý do không đồng ý báo cáo' : 'Nhập lý do từ chối chỉnh sửa', '') || '';
  }
  try {
    await apiRequest('/api/kltn/revision-approve', {
      method: 'POST',
      body: JSON.stringify({
        dang_ky_id: record.dangKyId || extractId(record.id),
        step,
        dong_y: Boolean(dongY),
        ly_do,
      }),
    });
    if (step === 'cthd') {
      toast(dongY ? 'CTHĐ đã đồng ý báo cáo' : 'CTHĐ đã không đồng ý báo cáo');
    } else {
      toast(dongY ? 'Đã duyệt chỉnh sửa' : 'Đã từ chối chỉnh sửa');
    }
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function finalizeKLTNResult(recordId) {
  const record = findKltnRecord(recordId);
  if (!record) return toast('Không tìm thấy hồ sơ KLTN', 'error');
  if (!Boolean(record.cthdApproved ?? record.xacNhanCTHD)) {
    return toast('CTHĐ cần xác nhận đồng ý báo cáo trước khi kết thúc KLTN', 'error');
  }
  if (computeKLTNFinalAvg(record) == null) {
    return toast('Chưa đủ điểm để kết thúc KLTN', 'error');
  }
  if (!window.confirm('Xác nhận kết thúc KLTN và chốt kết quả pass/fail?')) return;
  try {
    const res = await apiRequest('/api/kltn/finalize', {
      method: 'POST',
      body: JSON.stringify({ dang_ky_id: record.dangKyId || extractId(record.id) }),
    });
    const data = res.data || {};
    toast(`Đã kết thúc KLTN (${data.result || 'xong'})`);
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function exportSecretaryBienBan(recordId, saveToServer = false) {
  const record = findKltnRecord(recordId);
  if (!record) return toast('Không tìm thấy hồ sơ KLTN', 'error');
  const councilNotes = (document.getElementById(`tk-council-note-${record.id}`)?.value || '').trim();
  const extraNotes = (document.getElementById(`tk-note-${record.id}`)?.value || '').trim();
  const payload = buildBienBanPayload(record, extraNotes, councilNotes);
  const sv = getUser(record.svEmail);
  const current = DB.currentUser || {};
  const authHeaders = {};
  if (current.id) authHeaders["X-User-Id"] = String(current.id);
  if (current.role_raw || current.role) authHeaders["X-User-Role"] = String(current.role_raw || toApiRole(current.role));

  try {
    const res = await fetch(`${API_BASE}/api/bien-ban/xuat-docx`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Xuất biên bản thất bại' }));
      throw new Error(body.message || 'Xuất biên bản thất bại');
    }
    const blob = await res.blob();

    if (saveToServer) {
      const fileBase64 = await blobToBase64(blob);
      await apiRequest('/api/bien-ban/luu', {
        method: 'POST',
        body: JSON.stringify({
          dangKyId: payload.dangKyId,
          maSV: payload.maSV,
          filename: `BienBan_${payload.maSV || 'SV'}_${record.id}.docx`,
          fileBase64,
        }),
      });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BienBan_${sv?.ma || 'SV'}_${record.id}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (saveToServer) {
      toast('Đã xuất và lưu biên bản hội đồng');
      await refreshCurrentView();
      return;
    }
    toast('Đã xuất biên bản hội đồng');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderPhanBien() {
  const el = document.getElementById('page-phanbien');
  const list = getKLTNRoleRecords((assignment) => assignment.isReviewer);
  let html = renderKLTNRoleHeader('🧾 Phản biện', 'được phân công phản biện', list.length);

  if (!list.length) {
    el.innerHTML = `${html}<div class="card"><div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-title">Bạn chưa được phân công phản biện KLTN nào</div></div></div>`;
    return;
  }

  list.forEach((k) => {
    html += renderKLTNRoleCardStart(k);
    html += `<div style="margin-top:12px;font-size:13px;color:var(--text2)">
      ${k.pbAccepted ? '<span class="badge badge-green">Đã xác nhận phản biện</span>' : '<span class="badge badge-orange">Chưa xác nhận phản biện</span>'}
    </div>`;
    if (!k.pbAccepted) {
      html += `<div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="acceptPhanBienKLTN('${k.id}')">Xác nhận nhận phản biện</button></div>`;
    }
    html += renderKLTNScoreBlock(
      k,
      'PB',
      '🧾 Giảng viên phản biện — phiếu chấm',
      'Xem bài làm, Turnitin, nhập nhận xét và câu hỏi để thư ký tổng hợp vào biên bản.',
      { existingScore: k.diemPB, noteValue: k.pbNote || '', questionValue: k.pbCauHoi || '', showQuestion: true }
    );
    html += renderKLTNRoleCardEnd();
  });

  el.innerHTML = html;
  list.forEach((k) => recalcKLTNRoleTotal(k.id, 'PB'));
}

function renderHoiDong() {
  const el = document.getElementById('page-hoidong');
  const list = DB.kltnList
    .filter((k) => Boolean(k.myAssignment?.isCommitteeMember) || isUserCommitteeMemberOnRecord(DB.currentUser, k))
    .sort((a, b) => Number(b.dangKyId || 0) - Number(a.dangKyId || 0));
  let html = renderKLTNRoleHeader('🏛️ Hội đồng', 'thuộc hội đồng bạn tham gia', list.length);

  if (!list.length) {
    el.innerHTML = `${html}<div class="card"><div class="empty-state"><div class="empty-state-icon">🏛️</div><div class="empty-state-title">Bạn chưa là thành viên hội đồng của KLTN nào</div></div></div>`;
    return;
  }

  list.forEach((k) => {
    const myTVScore = getCurrentTVScore(k);
    html += renderKLTNRoleCardStart(k);
    html += `<div style="font-size:12px;color:var(--text3);margin-top:10px">Mỗi thành viên hội đồng có một phiếu chấm riêng. Hệ thống sẽ lưu điểm theo chính tài khoản của bạn.</div>`;
    html += renderKLTNScoreBlock(
      k,
      'TV',
      '🏛️ Thành viên hội đồng — phiếu chấm riêng',
      'Bạn có thể xem bài KLTN, Turnitin và chấm điểm độc lập với các thành viên khác.',
      { existingScore: myTVScore?.diem, noteValue: myTVScore?.nhanXet || '' }
    );
    html += renderKLTNRoleCardEnd();
  });

  el.innerHTML = html;
  list.forEach((k) => recalcKLTNRoleTotal(k.id, 'TV'));
}

function renderChuTich() {
  const el = document.getElementById('page-chutich');
  const list = getKLTNRoleRecords((assignment) => assignment.isChair);
  let html = renderKLTNRoleHeader('👨‍⚖️ Chủ tịch', 'do bạn làm Chủ tịch hội đồng', list.length);

  if (!list.length) {
    el.innerHTML = `${html}<div class="card"><div class="empty-state"><div class="empty-state-icon">👨‍⚖️</div><div class="empty-state-title">Bạn chưa được phân công làm Chủ tịch hội đồng</div></div></div>`;
    return;
  }

  list.forEach((k) => {
    const finalAvg = computeKLTNFinalAvg(k);
    const gvhdApproved = Boolean(k.gvhdApproved ?? k.xacNhanGVHD);
    const cthdApproved = Boolean(k.cthdApproved ?? k.xacNhanCTHD);
    const canConfirmReport = k.trangThai === 'bao_ve' && !cthdApproved;
    html += renderKLTNRoleCardStart(k);
    html += `<div style="margin-top:12px;font-size:13px;color:var(--text2)">
      Chủ tịch hội đồng xem hồ sơ, theo dõi kết quả và xác nhận đồng ý hoặc không đồng ý buổi báo cáo/bảo vệ sau khi hội đồng đã chấm. Bước này không phải duyệt bài chỉnh sửa; phần đó thuộc GVHD. Nếu hồ sơ đã có điểm Chủ tịch, điểm này cũng được tính vào trung bình hội đồng.
    </div>`;
    html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      ${finalAvg != null ? `<div class="badge badge-purple">Điểm tổng hợp: ${finalAvg.toFixed(2)}</div>` : `<div class="badge badge-orange">Chưa đủ điểm để tổng hợp</div>`}
      <div class="badge badge-blue">GVHD: ${gvhdApproved ? 'Đã duyệt bài chỉnh sửa' : 'Chưa duyệt bài chỉnh sửa'}</div>
      <div class="badge badge-blue">CT.HĐ: ${cthdApproved ? 'Đã xác nhận đồng ý báo cáo' : 'Chưa xác nhận báo cáo'}</div>
    </div>`;
    html += `<div style="margin-top:10px;font-size:12px;color:var(--text3)">
      ${k.trangThai !== 'bao_ve' && k.trangThai !== 'pass' && k.trangThai !== 'fail' && k.trangThai !== 'hoan_thanh'
        ? 'Bước xác nhận này chỉ thực hiện sau khi sinh viên đã bảo vệ/báo cáo.'
        : cthdApproved
          ? 'Chủ tịch hội đồng đã xác nhận đồng ý báo cáo cho hồ sơ này.'
          : 'Đã đủ điều kiện để CTHĐ xác nhận đồng ý hoặc không đồng ý buổi báo cáo/bảo vệ.'}
    </div>`;
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button>
      <button class="btn btn-primary btn-sm" onclick="finalizeKLTNResult('${k.id}')" ${cthdApproved ? '' : 'disabled'}>🏁 Kết thúc KLTN</button>
      <button class="btn btn-success btn-sm" onclick="approveKLTNRevision('${k.id}','cthd',true)" ${canConfirmReport ? '' : 'disabled'}>Đồng ý báo cáo</button>
      <button class="btn btn-danger btn-sm" onclick="approveKLTNRevision('${k.id}','cthd',false)" ${canConfirmReport ? '' : 'disabled'}>Không đồng ý báo cáo</button>
    </div>`;
    if (k.pbNote || k.pbCauHoi || buildSecretaryCouncilNotes(k)) {
      html += `<div class="form-group" style="margin-top:12px"><label>Nhận xét để tham chiếu khi duyệt</label><textarea readonly style="min-height:120px;background:var(--bg)">${escapeHtml([k.pbNote ? `Nhận xét PB: ${k.pbNote}` : '', k.pbCauHoi ? `Câu hỏi PB: ${k.pbCauHoi}` : '', buildSecretaryCouncilNotes(k)].filter(Boolean).join('\n\n'))}</textarea></div>`;
    }
    html += renderKLTNRoleCardEnd();
  });

  el.innerHTML = html;
}

function renderThuKy() {
  const el = document.getElementById('page-thuky');
  const list = getKLTNRoleRecords((assignment) => assignment.isSecretary);
  let html = renderKLTNRoleHeader('📝 Thư ký', 'do bạn làm Thư ký hội đồng', list.length);

  if (!list.length) {
    el.innerHTML = `${html}<div class="card"><div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">Bạn chưa được phân công làm Thư ký hội đồng</div></div></div>`;
    return;
  }

  list.forEach((k) => {
    const finalAvg = computeKLTNFinalAvg(k);
    const councilScores = getKLTNCouncilScores(k);
    const councilAvg = councilScores.length ? (councilScores.reduce((a, b) => a + b, 0) / councilScores.length) : null;
    const scoreRows = buildSecretaryScoreRows(k);
    const summaryCards = [
      {
        label: 'GVHD',
        value: k.diemHD != null ? String(k.diemHD) : 'Chưa có',
        tone: 'neutral',
        note: 'Điểm giảng viên hướng dẫn',
      },
      {
        label: 'GVPB',
        value: k.diemPB != null ? String(k.diemPB) : 'Chưa có',
        tone: 'neutral',
        note: 'Điểm giảng viên phản biện',
      },
      {
        label: 'Trung bình hội đồng',
        value: councilAvg != null ? councilAvg.toFixed(2).replace(/\.00$/, '') : 'Chưa có',
        tone: 'neutral',
        note: `${councilScores.length || 0} phiếu hội đồng`,
      },
      {
        label: 'Tổng hợp',
        value: finalAvg != null ? finalAvg.toFixed(2) : 'Chưa đủ',
        tone: finalAvg != null ? 'accent' : 'muted',
        note: '20% HD + 20% PB + 60% HĐ',
      },
    ];
    html += renderKLTNRoleCardStart(k);
    html += `<div style="margin-top:12px;font-size:13px;color:var(--text2)">
      Thư ký không chấm điểm. Bạn có thể xem điểm HD/PB/HĐ, tổng hợp góp ý và xuất biên bản hội đồng cho từng sinh viên.
    </div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:14px">
      ${summaryCards.map((card) => `
        <div style="
          border:1px solid ${card.tone === 'accent' ? '#fecdd3' : card.tone === 'muted' ? '#e5e7eb' : 'var(--border)'};
          background:${card.tone === 'accent' ? 'linear-gradient(180deg,#fff1f2 0%,#fff7f7 100%)' : card.tone === 'muted' ? '#fafafa' : 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)'};
          border-radius:12px;
          padding:14px 16px;
          min-height:110px;
          display:flex;
          flex-direction:column;
          justify-content:space-between;
          box-shadow:${card.tone === 'accent' ? '0 8px 20px rgba(244,63,94,0.08)' : '0 4px 12px rgba(15,23,42,0.04)'};
        ">
          <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${card.tone === 'accent' ? '#9f1239' : '#64748b'}">${escapeHtml(card.label)}</div>
          <div style="font-size:${card.value.length > 6 ? '18px' : '24px'};font-weight:900;color:${card.tone === 'accent' ? '#e11d48' : card.tone === 'muted' ? '#94a3b8' : '#1e3a8a'};line-height:1.1;margin:6px 0">${escapeHtml(card.value)}</div>
          <div style="font-size:12px;color:#64748b">${escapeHtml(card.note)}</div>
        </div>
      `).join('')}
    </div>`;
    html += `<div class="form-group" style="margin-top:12px">
      <label>Bảng điểm tổng hợp</label>
      <div class="table-wrap">
        <table>
          <thead class="secretary-score-head">
            <tr>
              <th style="width:110px">Vai trò</th>
              <th>Họ tên</th>
              <th style="width:120px;text-align:center">Điểm</th>
            </tr>
          </thead>
          <tbody>
            ${scoreRows.map((row) => `
              <tr ${row.highlight ? `style="background:#fff1f2"` : row.emphasis ? `style="background:#f8fbff"` : ''}>
                ${row.mergeName
                  ? `<td colspan="2" style="font-weight:${row.emphasis ? '800' : '700'};${row.emphasis ? 'color:#1e3a8a;' : ''}">${escapeHtml(row.role)}</td>`
                  : `<td style="font-weight:${row.emphasis ? '800' : '700'};${row.emphasis ? 'color:#1e3a8a;' : ''}">${escapeHtml(row.role)}</td><td style="${row.emphasis ? 'font-weight:700;color:#35507a;' : ''}">${escapeHtml(row.name)}</td>`}
                <td style="text-align:center;font-weight:${row.emphasis ? '900' : '800'};${row.highlight ? 'color:#be123c;' : row.emphasis ? 'color:#1e3a8a;' : ''}">${escapeHtml(row.score)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
    html += `<div class="form-group" style="margin-top:12px"><label>Góp ý phản biện và hội đồng</label><textarea id="tk-council-note-${k.id}" style="min-height:120px" placeholder="Nhập góp ý phản biện và hội đồng vào đây">${escapeHtml(buildSecretaryCouncilNotes(k))}</textarea></div>`;
    html += `<div class="form-group"><label>Nội dung yêu cầu chỉnh sửa / tổng hợp biên bản</label><textarea id="tk-note-${k.id}" style="min-height:120px" placeholder="Nhập thêm góp ý của hội đồng để đưa vào biên bản">${escapeHtml(getSecretaryDraftValue(k))}</textarea></div>`;
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button>
      <button class="btn btn-primary btn-sm" onclick="exportSecretaryBienBan('${k.id}', false)">📄 Xuất biên bản DOCX</button>
      <button class="btn btn-success btn-sm" onclick="exportSecretaryBienBan('${k.id}', true)">💾 Xuất và lưu biên bản</button>
    </div>`;
    html += renderKLTNRoleCardEnd();
  });

  el.innerHTML = html;
}
function renderGoiY() { document.getElementById('page-goiy').innerHTML = `<div class="page-header"><h1>💡 Gợi ý đề tài</h1></div>`; }
function renderThongKe() { document.getElementById('page-thongke').innerHTML = `<div class="page-header"><h1>📈 Thống kê</h1></div>`; }
function renderTheoDoi() {
  const u = DB.currentUser;
  const el = document.getElementById('page-theodoi');
  const myBCTT = getBCTTBySV(u.email)[0] || null;
  const myKLTN = getKLTNBySV(u.email)[0] || null;

  let html = `<div class="page-header"><h1>⏱️ Theo dõi trạng thái</h1><p>Theo dõi tiến độ BCTT, KLTN và các đợt đăng ký của bạn</p></div>`;

  const buildProgress = (steps) => `<div class="progress-steps">${steps.map((s, i) => `
    <div class="step">
      <div class="step-circle ${s.done ? 'done' : i === steps.findIndex(x => !x.done) ? 'active' : ''}">${s.done ? '✓' : i + 1}</div>
      <span class="step-label">${s.label}</span>
    </div>${i < steps.length - 1 ? `<div class="step-line ${s.done ? 'done' : ''}"></div>` : ''}`).join('')}</div>`;

  html += `<div class="grid-2">`;

  html += `<div class="card"><div class="card-header"><div><div class="card-title">📝 Báo cáo Thực tập</div></div>${myBCTT ? statusBadge(myBCTT.trangThai) : ''}</div>`;
  if (!myBCTT) {
    html += `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">Bạn chưa đăng ký BCTT</div><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="navigateTo('bctt')">Đăng ký BCTT</button></div>`;
  } else {
    const st = myBCTT.trangThai;
    const steps = [
      { label: 'Đăng ký', done: true },
      { label: 'GV duyệt', done: ['gv_xac_nhan', 'cho_cham', 'pass', 'fail'].includes(st) },
      { label: 'Nộp hồ sơ', done: ['cho_cham', 'pass', 'fail'].includes(st) },
      { label: 'Chấm điểm', done: ['pass', 'fail'].includes(st) },
      { label: 'Hoàn tất', done: ['pass', 'fail'].includes(st) },
    ];
    html += `<div class="info-row"><span class="info-label">Tên đề tài:</span><span class="info-value" style="font-weight:700">${escapeHtml(myBCTT.tenDeTai)}</span></div>
      <div class="info-row"><span class="info-label">Công ty:</span><span class="info-value">${escapeHtml(myBCTT.tenCongTy || '—')}</span></div>
      <div class="info-row"><span class="info-label">GV hướng dẫn:</span><span class="info-value">${escapeHtml(getUser(myBCTT.gvEmail)?.name || myBCTT.gvEmail)}</span></div>
      <div class="info-row"><span class="info-label">Loại đề tài:</span><span class="info-value">${escapeHtml(getTopicTypeLabel(myBCTT.topicType))}</span></div>
      <div style="margin-top:16px">${buildProgress(steps)}</div>`;
  }
  html += `</div>`;

  html += `<div class="card"><div class="card-header"><div><div class="card-title">🎓 Khóa Luận Tốt Nghiệp</div></div>${myKLTN ? statusBadge(myKLTN.trangThai) : ''}</div>`;
  if (!myKLTN) {
    html += `<div class="empty-state"><div class="empty-state-icon">🎓</div><div class="empty-state-title">Bạn chưa đăng ký KLTN</div>${myBCTT && myBCTT.trangThai === 'pass' ? `<button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="navigateTo('kltn')">Đăng ký KLTN</button>` : ''}</div>`;
  } else {
    const st = myKLTN.trangThai;
    const steps = [
      { label: 'Đăng ký', done: true },
      { label: 'Thực hiện', done: ['thuc_hien', 'cham_diem', 'bao_ve', 'hoan_thanh', 'pass', 'fail'].includes(st) },
      { label: 'Chấm điểm', done: ['cham_diem', 'bao_ve', 'hoan_thanh', 'pass', 'fail'].includes(st) },
      { label: 'Bảo vệ', done: ['bao_ve', 'hoan_thanh', 'pass', 'fail'].includes(st) },
      { label: 'CTHĐ xác nhận báo cáo', done: Boolean(myKLTN.xacNhanCTHD) || ['hoan_thanh', 'pass', 'fail'].includes(st) },
      { label: 'Hoàn tất', done: ['hoan_thanh', 'pass', 'fail'].includes(st) },
    ];
    html += `<div class="info-row"><span class="info-label">Tên đề tài:</span><span class="info-value" style="font-weight:700">${escapeHtml(myKLTN.tenDeTai)}</span></div>
      <div class="info-row"><span class="info-label">Lĩnh vực:</span><span class="info-value">${escapeHtml(myKLTN.mangDeTai || '—')}</span></div>
      <div class="info-row"><span class="info-label">Loại đề tài:</span><span class="info-value">${escapeHtml(getTopicTypeLabel(myKLTN.topicType))}</span></div>
      <div class="info-row"><span class="info-label">GV hướng dẫn:</span><span class="info-value">${escapeHtml(getUser(myKLTN.gvHDEmail)?.name || myKLTN.gvHDEmail || '—')}</span></div>
      <div class="info-row"><span class="info-label">GV phản biện:</span><span class="info-value">${escapeHtml(getUser(myKLTN.gvPBEmail)?.name || myKLTN.gvPBEmail || 'Chưa phân công')}</span></div>
      <div style="margin-top:16px">${buildProgress(steps)}</div>`;
  }
  html += `</div>`;

  html += `</div>`;

  html += `<div class="card" style="margin-top:20px"><div class="card-header"><div class="card-title">📅 Các đợt đăng ký</div></div>`;
  if (!DB.dotDangKy.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">Chưa có đợt đăng ký nào</div></div>`;
  } else {
    html += DB.dotDangKy
      .filter((d) => dotMatchesStudentHeAndMajor(d))
      .map((d) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:600">${escapeHtml(d.ten)}</div>
          <div style="font-size:11px;color:var(--text3)">${escapeHtml(d.loai)} • ${escapeHtml(d.batDau || '—')} → ${escapeHtml(d.ketThuc || '—')}</div>
        </div>
        <span class="badge ${d.trangThai === 'dang_mo' ? 'badge-green' : 'badge-gray'}">${d.trangThai === 'dang_mo' ? '🟢 Đang mở' : '🔒 Đóng'}</span>
      </div>`).join('');
  }
  html += `</div>`;

  el.innerHTML = html;
}

async function phanCongPBKLTN(kId) {
  const u = DB.currentUser;
  if (u.role !== 'bm') {
    toast('Chỉ trưởng bộ môn mới được phân công PB & Hội đồng', 'error');
    return;
  }
  const k = DB.kltnList.find(x => x.id === kId);
  if (!k) {
    toast('Không tìm thấy KLTN', 'error');
    return;
  }
  const sv = getUser(k.svEmail);
  const gvList = DB.users.filter(u => u.role === 'gv' || u.role === 'bm');

  let html = `<div class="modal-header"><div class="modal-title">Phân công Phản biện & Hội đồng cho Khóa luận tốt nghiệp</div><button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="assignment-summary">
      <div class="assignment-summary-label">Tên đề tài</div>
      <div class="assignment-summary-title">${escapeHtml(k.tenDeTai)}</div>
      <div class="assignment-summary-meta">
        <div class="assignment-meta-item">
          <span class="assignment-meta-key">Sinh viên</span>
          <span class="assignment-meta-value">${escapeHtml(sv?.name || '—')}</span>
        </div>
      </div>
      <div class="assignment-summary-chips">
        <span class="assignment-chip">Ngành: Thương mại Điện tử</span>
        <span class="assignment-chip">Lĩnh vực: ${escapeHtml(k.mangDeTai || 'Chưa xác định')}</span>
      </div>
    </div>
    <div class="form-group"><label>GV Phản biện</label><select id="select-gv-pb"><option value="">-- Chọn GV phản biện --</option>${gvList.map(g => `<option value="${g.id}" ${k.gvPBEmail === g.email ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Chủ tịch Hội đồng</label><select id="select-ct"><option value="">-- Chọn Chủ tịch --</option>${gvList.map(g => `<option value="${g.id}" ${k.hoiDong?.ct === g.email ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Thư ký Hội đồng</label><select id="select-tk"><option value="">-- Chọn Thư ký --</option>${gvList.map(g => `<option value="${g.id}" ${k.hoiDong?.tk === g.email ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}</select></div>
    <div class="form-group">
      <label>Ủy viên Hội đồng</label>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Tick chọn một hoặc nhiều giảng viên để thêm vào hội đồng.</div>
      <div class="committee-picker">
        ${gvList.map(g => `
          <label class="committee-option">
            <input type="checkbox" class="committee-checkbox" value="${g.id}" ${k.hoiDong?.tv?.includes(g.email) ? 'checked' : ''}>
            <span>${escapeHtml(g.name)}</span>
          </label>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Hủy</button><button class="btn btn-primary" onclick="submitPhanCong('${kId}')">💾 Lưu phân công</button></div>`;

  showModal(html);
}

async function submitPhanCong(kId) {
  const k = DB.kltnList.find(x => x.id === kId);
  if (!k) {
    toast('Không tìm thấy KLTN', 'error');
    return;
  }

  const gvPbId = document.getElementById('select-gv-pb').value;
  const ctId = document.getElementById('select-ct').value;
  const tkId = document.getElementById('select-tk').value;
  const tvIds = Array.from(document.querySelectorAll('.committee-checkbox:checked')).map((o) => o.value);

  if (!ctId || !tkId || tvIds.length === 0) {
    toast('Vui lòng chọn đầy đủ thành viên hội đồng (CT, TK, ít nhất 1 TV)', 'error');
    return;
  }

  try {
    // Phân công GV PB
    if (gvPbId) {
      await apiRequest("/api/phan-cong", {
        method: "POST",
        body: JSON.stringify({
          dang_ky_id: k.dangKyId,
          gv_pb_id: gvPbId,
        }),
      });
    }

    // Phân công hội đồng
    await apiRequest("/api/phan-cong/hoi-dong", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_id: k.dangKyId,
        ct_id: ctId,
        tk_id: tkId,
        tv_ids: tvIds,
      }),
    });

    toast('Phân công thành công');
    closeModalForce();
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function switchTab(e, tabId) {
  const parent = e.target.closest('.page') || document;
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const oauthState = params.get("oauth");
  const oauthError = params.get("error");
  const oauthTargetPage = params.get("page");

  if (oauthError) {
    toast(toOauthErrorMessage(oauthError), "error");
    try {
      await apiRequest("/api/logout", { method: "POST", body: JSON.stringify({}) });
    } catch (_) {}
    DB.currentUser = null;
    localStorage.removeItem("currentUser");
    document.getElementById("screen-app").classList.remove("active");
    document.getElementById("screen-login").classList.add("active");
    document.getElementById("notif-panel").classList.remove("open");
    clearAuthQueryParams();
    return;
  }

  if (oauthState === "success") {
    try {
      const mapped = await establishSessionFromApi();
      const nextPage = oauthTargetPage || (mapped.role === "sv" ? "dashboard" : mapped.role === "gv" ? "huongdan" : "duyetde");
      navigateTo(nextPage);
      toast("Đăng nhập thành công");
    } catch (_) {
      DB.currentUser = null;
      localStorage.removeItem("currentUser");
      toast("Phiên đăng nhập OAuth không hợp lệ.", "error");
    } finally {
      clearAuthQueryParams();
    }
    return;
  }

  const saved = localStorage.getItem("currentUser");
  if (!saved) return;
  let parsed;
  try {
    parsed = JSON.parse(saved);
  } catch (_) {
    localStorage.removeItem("currentUser");
    return;
  }
  if (!parsed || parsed.id == null) {
    localStorage.removeItem("currentUser");
    return;
  }
  DB.currentUser = parsed;
  try {
    await apiRequest("/api/me", { method: "GET" });
    openAppScreen();
    await initApp();
    try {
      localStorage.setItem("currentUser", JSON.stringify(DB.currentUser));
    } catch (_) {}
  } catch (_) {
    DB.currentUser = null;
    localStorage.removeItem("currentUser");
  }
});
// ==========================================
// HÀM TẠO DỮ LIỆU ẢO AN TOÀN
// ==========================================
function taoDuLieuTest() {
  // 1. Khởi tạo an toàn: Nếu DB chưa có thì tạo mới để tránh lỗi "undefined"
  window.DB = window.DB || {};
  window.DB.users = window.DB.users || [];
  window.DB.kltnList = window.DB.kltnList || [];
  window.DB.currentUser = window.DB.currentUser || { email: 'gv1@ute.vn' }; // Tránh lỗi null currentUser

  // 2. Tạo 5 sinh viên ảo
  const mockStudents = [
    { id: 901, ma: '20110001', mssv: '20110001', email: 'sv1@student.ute.vn', name: 'Nguyễn Văn Test Một', role: 'sv', chuyenMon: ['Công nghệ phần mềm'] },
    { id: 902, ma: '20110002', mssv: '20110002', email: 'sv2@student.ute.vn', name: 'Trần Thị Test Hai', role: 'sv', chuyenMon: ['Hệ thống thông tin'] },
    { id: 903, ma: '20110003', mssv: '20110003', email: 'sv3@student.ute.vn', name: 'Lê Văn Test Ba', role: 'sv', chuyenMon: ['An toàn thông tin'] },
    { id: 904, ma: '20110004', mssv: '20110004', email: 'sv4@student.ute.vn', name: 'Phạm Test Bốn', role: 'sv', chuyenMon: ['Mạng máy tính'] },
    { id: 905, ma: '20110005', mssv: '20110005', email: 'sv5@student.ute.vn', name: 'Hoàng Test Năm', role: 'sv', chuyenMon: ['Khoa học dữ liệu'] }
  ];

  mockStudents.forEach(sv => {
    if (!DB.users.find(u => u.email === sv.email)) {
      DB.users.push(sv);
    }
  });

  // 3. Tạo 5 đề tài KLTN
  const mockKltn = [
    { id: 'kltn_test_1', dangKyId: 101, svEmail: 'sv1@student.ute.vn', tenDeTai: 'Xây dựng website bán hàng Ecommerce', mangDeTai: 'Công nghệ phần mềm', gvHDEmail: DB.currentUser.email, gvPBEmail: null, hoiDong: null, trangThai: 'thuc_hien' },
    { id: 'kltn_test_2', dangKyId: 102, svEmail: 'sv2@student.ute.vn', tenDeTai: 'Nghiên cứu AI dự đoán giá cổ phiếu', mangDeTai: 'Hệ thống thông tin', gvHDEmail: DB.currentUser.email, gvPBEmail: null, hoiDong: null, trangThai: 'thuc_hien' },
    { id: 'kltn_test_3', dangKyId: 103, svEmail: 'sv3@student.ute.vn', tenDeTai: 'Phân tích mã độc Ransomware', mangDeTai: 'An toàn thông tin', gvHDEmail: 'gv2@ute.vn', gvPBEmail: null, hoiDong: null, trangThai: 'thuc_hien' },
    { id: 'kltn_test_4', dangKyId: 104, svEmail: 'sv4@student.ute.vn', tenDeTai: 'Tối ưu hóa mạng SDN', mangDeTai: 'Mạng máy tính', gvHDEmail: 'gv2@ute.vn', gvPBEmail: null, hoiDong: null, trangThai: 'cham_diem' },
    { id: 'kltn_test_5', dangKyId: 105, svEmail: 'sv5@student.ute.vn', tenDeTai: 'Hệ thống gợi ý sản phẩm', mangDeTai: 'Khoa học dữ liệu', gvHDEmail: 'gv3@ute.vn', gvPBEmail: null, hoiDong: null, trangThai: 'thuc_hien' }
  ];

  mockKltn.forEach(k => {
    if (!DB.kltnList.find(x => x.id === k.id)) {
      DB.kltnList.push(k);
    }
  });

  if (typeof toast === "function") toast("✅ Đã tạo dữ liệu ảo!");
  else console.log("✅ Đã tạo dữ liệu ảo!");
   if (DB.currentPage === 'phancong') {

    renderPhanCong();

  }
}
// New functions for bulk approval
function toggleSelectAll(type) {
  const selectAll = document.getElementById(`select-all-${type}`);
  const checkboxes = document.querySelectorAll(`.select-${type}`);
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

async function duyetSelectedBCTT(dongY) {
  const selected = Array.from(document.querySelectorAll('.select-bctt:checked')).map(cb => parseInt(cb.value));
  if (!selected.length) {
    toast("Chưa chọn đề tài nào", "error");
    return;
  }
  try {
    await apiRequest("/api/bctt/approve", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_ids: selected,
        action: dongY ? "dong_y" : "tu_choi",
      }),
    });
    toast(dongY ? `Đã duyệt ${selected.length} đề tài BCTT` : `Đã từ chối ${selected.length} đề tài BCTT`);
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function duyetSelectedKLTN(dongY) {
  const selected = Array.from(document.querySelectorAll('.select-kltn:checked')).map(cb => parseInt(cb.value));
  if (!selected.length) {
    toast("Chưa chọn đề tài nào", "error");
    return;
  }
  try {
    await apiRequest("/api/kltn/approve", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_ids: selected,
        action: dongY ? "dong_y" : "tu_choi",
      }),
    });
    toast(dongY ? `Đã duyệt ${selected.length} đề tài KLTN` : `Đã từ chối ${selected.length} đề tài KLTN`);
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

function toggleSelectAllHuongDan(type) {
  const selectAll = document.getElementById(`select-all-${type}-huongdan`);
  const checkboxes = document.querySelectorAll(`.select-${type}-huongdan`);
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

async function duyetSelectedBCTTHuongDan(dongY) {
  const selected = Array.from(document.querySelectorAll('.select-bctt-huongdan:checked')).map(cb => parseInt(cb.value));
  if (!selected.length) {
    toast("Chưa chọn đề tài nào", "error");
    return;
  }
  try {
    await apiRequest("/api/bctt/approve", {
      method: "POST",
      body: JSON.stringify({
        dang_ky_ids: selected,
        action: dongY ? "dong_y" : "tu_choi",
      }),
    });
    toast(dongY ? `Đã duyệt ${selected.length} đề tài BCTT` : `Đã từ chối ${selected.length} đề tài BCTT`);
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

// 2. In bảng kiểm tra
if (window.DB && window.DB.kltnList && window.DB.kltnList.length > 0) {
    console.log(`%c📚 ĐÃ NẠP THÀNH CÔNG ${DB.kltnList.length} ĐỀ TÀI VÀO BỘ NHỚ`, "color: #4caf50; font-size: 14px; font-weight: bold;");
    const dataHienThi = DB.kltnList.map(k => ({
        "ID Nội bộ": k.id,
        "Đăng Ký ID": k.dangKyId,
        "Tên Đề Tài": k.tenDeTai,
        "Email Sinh Viên": k.svEmail,
        "Trạng Thái": k.trangThai
    }));
    console.table(dataHienThi);
} else {
    console.log("⚠️ Có lỗi xảy ra, không thể nạp dữ liệu.");
}

async function uploadToDrive(file) {
  const base64 = await toBase64(file);

  const res = await fetch("YOUR_SCRIPT_URL", {
    method: "POST",
    body: new URLSearchParams({
      file: base64.split(',')[1],
      name: file.name
    })
  });

  const data = await res.json();
  return data.fileId;
}

function toBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}