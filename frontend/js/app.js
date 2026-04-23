// ============================================================
// DATA STORE (RAM) & API SETUP
// ============================================================
window.API_BASE = "http://127.0.0.1:5000";
const API_BASE = window.API_BASE;
const FETCH_OPTS = { credentials: "include" };

const DB = {
  users: [],
  dotDangKy: [],
  mangDeTai: [],
  bcttList: [],
  kltnList: [],
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

function hasCommonMajor(a, b) {
    if (!a || !b) return false;
    const majorsA = Array.isArray(a.chuyenMon) ? a.chuyenMon.map((m) => String(m).trim()).filter(Boolean) : [];
    const majorsB = Array.isArray(b.chuyenMon) ? b.chuyenMon.map((m) => String(m).trim()).filter(Boolean) : [];
    return majorsA.length && majorsB.length && majorsA.some((m) => majorsB.includes(m));
}

function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.API_BASE) return String(window.API_BASE).replace(/\/$/, '');
  return 'http://127.0.0.1:5000';
}

function uploadFileHref(storedPath) {
  if (!storedPath) return '#';
  const base = getApiBaseUrl();
  const rel = String(storedPath).replace(/^uploads[\\/]/i, '').replace(/\\/g, '/');
  return base + '/uploads/' + rel.split('/').map((seg) => encodeURIComponent(seg)).join('/');
}

function getCurrentStudentMajor() {
  const u = DB.currentUser;
  if (!u || u.role !== 'sv') return '';
  const majors = Array.isArray(u.chuyenMon) ? u.chuyenMon.filter(Boolean).map((m) => String(m).trim()) : [];
  return majors[0] || '';
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

function renderGVOptionsByField() {
  const gvSelect = document.getElementById('f-gv');
  const dotSelect = document.getElementById('f-dot');
  if (!gvSelect || !dotSelect) return;

  const selectedDotId = dotSelect.value;
  const heDaoTao = normalizeStudentSlotHe(DB.currentUser);
  const validSlots = DB.gvSlots.filter((slot) => {
    return String(slot.dotId) === String(selectedDotId) && String(slot.heDaoTao) === String(heDaoTao) && slot.duyetTbm && (slot.slotConLai || 0) > 0;
  });

  const gvIds = Array.from(new Set(validSlots.map((slot) => Number(slot.gvId))));
  const options = gvIds
    .map((gvId) => {
      const gv = DB.users.find((u) => Number(u.id) === Number(gvId));
      if (!gv) return null;
      const slot = validSlots.find((s) => Number(s.gvId) === Number(gvId));
      const label = gv.name;
      const extra = slot ? ` - slot còn lại: ${slot.slotConLai}` : '';
      return `<option value="${gvId}">${escapeHtml(label + extra)}</option>`;
    })
    .filter(Boolean);

  gvSelect.innerHTML = `
    <option value="">-- Chọn giảng viên hướng dẫn --</option>
    ${options.length ? options.join('') : '<option value="" disabled>Không có giảng viên phù hợp hoặc chưa chọn đợt</option>'}
  `;
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
    if (k.gvHDEmail === u.email || k.gvPBEmail === u.email) return true;
    if (k.hoiDong) {
      const h = k.hoiDong;
      if (h.ct === u.email || h.tk === u.email) return true;
      if (Array.isArray(h.tv) && h.tv.includes(u.email)) return true;
    }
    return false;
  }
  return true;
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

function computeKLTNFinalAvg(k) {
  if (!k || k.diemHD == null || k.diemPB == null || k.diemBB == null) return null;
  const tvs = (k.tvScores || []).map((t) => t.diem).filter((d) => d != null && !Number.isNaN(Number(d)));
  const hoiDongScores = [...tvs, Number(k.diemBB)];
  if (!hoiDongScores.length) return null;
  const avgHd = hoiDongScores.reduce((a, b) => a + b, 0) / hoiDongScores.length;
  return Number(k.diemHD) * 0.2 + Number(k.diemPB) * 0.2 + avgHd * 0.6;
}

function gvKLTNListForNhapDiem(u) {
  return DB.kltnList.filter((k) => {
    const st = k.trangThai;
    if (st !== 'cham_diem' && st !== 'bao_ve') return false;
    const isHD = k.gvHDEmail === u.email;
    const isPB = k.gvPBEmail === u.email;
    const isCT = k.hoiDong && k.hoiDong.ct === u.email;
    const isTK = k.hoiDong && k.hoiDong.tk === u.email;
    const isTV = k.hoiDong && Array.isArray(k.hoiDong.tv) && k.hoiDong.tv.includes(u.email);
    if (!(isHD || isPB || isCT || isTK || isTV)) return false;
    if (st === 'bao_ve' && (isPB || isTV)) return false;
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
  t.innerHTML = (type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️') + ' ' + msg;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
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
  const res = await fetch(`${API_BASE}${path}`, {
    ...FETCH_OPTS,
    headers,
    ...options,
  });
  const body = await res.json().catch(() => ({ success: false, message: "Invalid JSON" }));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || "Có lỗi từ server");
  }
  return body;
}

async function syncFromServer() {
  const out = await apiRequest("/api/bootstrap", { method: "GET" });
  const data = out.data || {};
  DB.users = data.users || [];
  DB.dotDangKy = data.dotDangKy || [];
  DB.bcttList = data.bcttList || [];
  DB.kltnList = data.kltnList || [];
  DB.gvSlots = data.gvSlots || [];
  const lv = new Set();
  DB.bcttList.forEach((x) => x.mangDeTai && lv.add(x.mangDeTai));
  DB.kltnList.forEach((x) => x.mangDeTai && lv.add(x.mangDeTai));
  DB.users.forEach((u) => (u.chuyenMon || []).forEach((m) => lv.add(m)));
  DB.mangDeTai = Array.from(lv);
  DB.chuyenMonList = DB.users
    .filter((u) => u.role === "gv" || u.role === "bm")
    .flatMap((u) => (u.chuyenMon || []).map((field) => ({ email: u.email, major: field, field })));
  
  if (DB.currentUser && DB.currentUser.id) {
    const fromServer = DB.users.find((u) => u.id === DB.currentUser.id);
    if (fromServer) {
      DB.currentUser = { ...DB.currentUser, ...fromServer };
    }
    try {
      localStorage.setItem("currentUser", JSON.stringify(DB.currentUser));
    } catch (_) {}
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

async function doLogin() {
  try {
    const ma = toMaFromLoginInput(document.getElementById("login-email").value);
    const mat_khau = document.getElementById("login-password").value.trim();
    const out = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ ma, mat_khau }),
    });
    const user = out.data.user;
    const mapped = {
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
    DB.currentUser = mapped;
    localStorage.setItem("currentUser", JSON.stringify(mapped));
    document.getElementById("screen-login").classList.remove("active");
    document.getElementById("screen-app").classList.add("active");
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

async function initApp() {
  await syncFromServer();
  const u = DB.currentUser;
  document.getElementById('sb-name').textContent = u.name;
  document.getElementById('sb-email').textContent = u.email;
  document.getElementById('sb-role').textContent = ROLE_LABELS[u.role] || u.role;
  document.getElementById('topbar-user').textContent = u.name;
  buildSidebar(u.role);
  updateNotifDot();
  buildNotifPanel();
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
  // Hide all pages
  document.querySelectorAll('[id^="page-"]').forEach(el => el.style.display = 'none');
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.style.display = 'block';

  const titles = {
    dashboard: 'Tổng quan', bctt: 'Đăng ký BCTT', kltn: 'Đăng ký KLTN',
    detai: 'Quản lý đề tài', duyetde: 'Duyệt đề tài', phancong: 'Phân công PB / Hội đồng',
    nhapDiem: 'Nhập điểm', hoithuong: 'Hội đồng', users: 'Quản lý người dùng', profile: 'Hồ sơ cá nhân',
    theodoi: 'Theo dõi trạng thái', huongdan: 'Hướng dẫn', phanbien: 'Phản biện', hoidong: 'Hội đồng',
    chutich: 'Chủ tịch hội đồng', thuky: 'Thư ký hội đồng', goiy: 'Gợi ý đề tài', thongke: 'Thống kê',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const renders = {
    dashboard: renderDashboard, bctt: renderBCTT, kltn: renderKLTN,
    detai: renderDeTai, duyetde: renderDuyetDe, phancong: renderPhanCong,
    nhapDiem: renderNhapDiem, users: renderUsers, profile: renderProfile,
    theodoi: renderTheoDoi, huongdan: renderHuongDan, phanbien: renderPhanBien, hoidong: renderHoiDong,
    chutich: renderChuTich, thuky: renderThuKy, goiy: renderGoiY, thongke: renderThongKe,
  };
  if (renders[page]) renders[page]();
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
      el.innerHTML = `
        <div style="padding:10px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="markAllNotifRead()">✓ Đánh dấu tất cả đã đọc</button>
        </div>
      ` + list.map(n => {
        const chuaDoc = !n.da_doc;
        const tieuDe = n.loai === 'tu_choi_gvhd' ? '❌ Giảng viên HD yêu cầu chỉnh sửa lại' : '❌ Chủ tịch HĐ yêu cầu chỉnh sửa lại';
        return `
          <div class="notif-item ${chuaDoc ? 'unread' : ''}" onclick="markOneNotifRead(${n.id}, this)">
            <div class="notif-item-title">${tieuDe}</div>
            <div class="notif-item-body" style="color:var(--text);margin-top:6px">
              <strong>Lý do / Yêu cầu:</strong><br>
              <span style="background:#FFF7D6;padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px">
                ${escapeHtml(n.noi_dung) || '(Không có ghi chú cụ thể)'}
              </span>
            </div>
            <div class="notif-item-body" style="margin-top:4px">Từ: <strong>${escapeHtml(n.ten_nguoi_gui) || 'Giảng viên'}</strong></div>
            <div class="notif-item-time">${n.tao_luc}</div>
          </div>`;
      }).join('');

      const chuaDocCount = list.filter(n => !n.da_doc).length;
      document.getElementById('notif-dot').style.display = chuaDocCount > 0 ? 'block' : 'none';
    } catch (err) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--accent);font-size:13px">Lỗi tải thông báo</div>';
    }
    return;
  }

  const list = DB.notifications.filter(n => n.toEmail === u.email);
  if (!list.length) { el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Không có thông báo</div>'; return; }
  el.innerHTML = list.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="notif-item-title">${n.title}</div>
      <div class="notif-item-body">${n.body}</div>
      <div class="notif-item-time">${n.time}</div>
    </div>`).join('');
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
  const linh_vuc = (document.getElementById("f-mang")?.value || "").trim();
  const cong_ty = (document.getElementById("f-congty")?.value || "").trim();
  const gv_id = document.getElementById("f-gv")?.value || "";
  const dot_id = document.getElementById("f-dot")?.value || "";
  if (!ten || !linh_vuc || !cong_ty || !gv_id || !dot_id) {
    toast("Vui lòng nhập đủ thông tin đăng ký BCTT", "error");
    return;
  }
  try {
    await apiRequest("/api/bctt/register", {
      method: "POST",
      body: JSON.stringify({ ten_de_tai: ten, linh_vuc, ten_cong_ty: cong_ty, gv_id, dot_id }),
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
  const gvEmail = document.getElementById("fk-gvhd")?.value || "";
  const dot_id = document.getElementById("fk-dot")?.value || "";
  const gv = getUser(gvEmail);
  const gv_id = gv ? gv.id : "";
  if (!ten || !linh_vuc || !gv_id || !dot_id) {
    toast("Vui lòng nhập đủ thông tin đăng ký KLTN", "error");
    return;
  }
  try {
    await apiRequest("/api/kltn/register", {
      method: "POST",
      body: JSON.stringify({ ten_de_tai: ten, linh_vuc, gv_id, dot_id }),
    });
    toast("Gửi đăng ký KLTN thành công");
    await refreshCurrentView();
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderGVOptionsByField() {
  const gvSelect = document.getElementById("f-gv");
  const dotSelect = document.getElementById("f-dot");
  if (!gvSelect || !dotSelect) return;

  const dotId = dotSelect.value;
  const major = (document.getElementById("f-mang")?.value || getCurrentStudentMajor() || "").trim();
  const he = normalizeStudentSlotHe(DB.currentUser);

  if (!dotId) {
    gvSelect.innerHTML = `<option value="">-- Chọn đợt trước --</option>`;
    return;
  }

  const candidates = DB.users.filter((u) => {
    if (u.role !== "gv" && u.role !== "bm") return false;
    if (major && Array.isArray(u.chuyenMon) && u.chuyenMon.length && !u.chuyenMon.includes(major)) return false;
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
        const majors = (u.chuyenMon || []).join(", ");
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
      pendingList.forEach(b => {
        const sv = getUser(b.svEmail);
        html += `<tr><td><div style="font-weight:600">${sv?.name}</div><div style="font-size:11px;color:var(--text3)">${b.svEmail}</div></td>
          <td><div style="font-weight:500;max-width:240px;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div><div style="font-size:11px;color:var(--text3)">${escapeHtml(b.mangDeTai)}</div></td>
          <td style="font-size:12px;color:var(--text3)">${b.ngayDangKy}</td>
          <td><div class="action-row">
            <button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁</button>
            <button class="btn btn-success btn-sm" onclick="duyetBCTT('${b.id}',true)">✓ Duyệt</button>
            <button class="btn btn-danger btn-sm" onclick="duyetBCTT('${b.id}',false)">✗ Từ chối</button>
          </div></td></tr>`;
      });
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
      <div class="info-row"><span class="info-label">Mảng đề tài:</span><span class="info-value">${b.mangDeTai}</span></div>
      <div class="info-row"><span class="info-label">Công ty:</span><span class="info-value">${b.tenCongTy}</span></div>
      <div class="info-row"><span class="info-label">Giảng viên HD:</span><span class="info-value">${gv?.name || b.gvEmail}</span></div>
      <div class="info-row"><span class="info-label">Đợt đăng ký:</span><span class="info-value">${DB.dotDangKy.find(d=>d.id===b.dotId)?.ten || b.dotId}</span></div>
      <div class="info-row"><span class="info-label">Hạn nộp BCTT:</span><span class="info-value">${dot?.ketThuc || 'Chưa cấu hình'}</span></div>
      <div class="info-row"><span class="info-label">Ngày đăng ký:</span><span class="info-value">${b.ngayDangKy}</span></div>
    </div>`;

    if (b.trangThai === 'gv_xac_nhan') {
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
      const svMajor = getCurrentStudentMajor();
      html += `<div class="card">
      <div class="card-title" style="margin-bottom:20px">📋 Form đăng ký BCTT</div>
      <div class="grid-2">
        <div class="form-group"><label>Tên đề tài *</label><input type="text" id="f-tenDeTai" placeholder="Nhập tên đề tài thực tập..."></div>
        <div class="form-group"><label>Ngành *</label><input type="text" id="f-mang" value="${escapeHtml(svMajor)}" readonly style="background:var(--bg)"></div>
        <div class="form-group"><label>Tên công ty *</label><input type="text" id="f-congty" placeholder="Tên doanh nghiệp thực tập..."></div>
        <div class="form-group"><label>Giảng viên hướng dẫn *</label><select id="f-gv"><option value="">-- Chọn đợt — slot theo hệ của bạn (${normalizeStudentSlotHe(DB.currentUser)}) --</option></select></div>
        <div class="form-group" style="grid-column:1/-1"><label>Đợt đăng ký *</label><select id="f-dot" onchange="renderGVOptionsByField()"><option value="">-- Chọn đợt --</option>${DB.dotDangKy.filter(d => d.trangThai === 'dang_mo' && d.loai === 'BCTT' && dotMatchesStudentHeAndMajor(d)).map(d => `<option value="${d.id}">${d.ten}</option>`).join('')}</select></div>
      </div>
      <button class="btn btn-primary" style="margin-top:8px;min-width:200px" onclick="submitBCTT()">📤 Gửi đăng ký</button>
    </div>`;
  }
  el.innerHTML = html;
  if (document.getElementById('f-gv') && document.getElementById('f-dot')) {
    queueMicrotask(() => renderGVOptionsByField());
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
      <div class="info-row"><span class="info-label">Mảng đề tài:</span><span class="info-value">${k.mangDeTai}</span></div>
      <div class="info-row"><span class="info-label">GV Hướng dẫn:</span><span class="info-value">${gvHD?.name || k.gvHDEmail}</span></div>
      <div class="info-row"><span class="info-label">GV Phản biện:</span><span class="info-value">${gvPB ? gvPB.name : '<span style="color:var(--text3)">Chưa phân công</span>'}</span></div>
      ${k.hoiDong ? `<div class="info-row"><span class="info-label">Chủ tịch HĐ:</span><span class="info-value">${getUser(k.hoiDong.ct)?.name || k.hoiDong.ct}</span></div>` : ''}
    </div>`;

    if (k.trangThai === 'thuc_hien') {
      html += `<div class="card"><div class="card-title" style="margin-bottom:16px">📤 Nộp bài KLTN</div>
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
        ${k.fileBai ? `<button class="btn btn-success" style="margin-top:16px;width:100%" onclick="hoanTatKLTN('${k.id}')">✅ Hoàn tất nộp KLTN</button>` : ''}
      </div>`;
    }

    if (k.diemHD !== null && k.diemPB !== null && k.diemBB !== null) {
      const fa = computeKLTNFinalAvg(k);
      const tvLine =
        k.tvScores && k.tvScores.length
          ? k.tvScores.map((t) => `${escapeHtml(getUser(t.email)?.name || t.email)}: ${t.diem ?? '–'}`).join(' • ')
          : '';
      html += `<div class="card"><div class="card-title" style="margin-bottom:16px">📊 Kết quả điểm</div>
        <div class="score-grid">
          <div class="score-item"><label>Điểm GV HD (20%)</label><input type="text" value="${k.diemHD ?? '–'}" readonly style="background:var(--bg)"></div>
          <div class="score-item"><label>Điểm GV PB (20%)</label><input type="text" value="${k.diemPB ?? '–'}" readonly style="background:var(--bg)"></div>
          <div class="score-item"><label>Điểm Chủ tịch HĐ (vào TB HĐ 60%)</label><input type="text" value="${k.diemBB ?? '–'}" readonly style="background:var(--bg)"></div>
        </div>
        ${tvLine ? `<div style="font-size:12px;color:var(--text2);margin-top:8px"><strong>Điểm TV:</strong> ${tvLine}</div>` : ''}
        <div class="score-total">
          <div class="score-total-label">Điểm tổng hợp (20% HD + 20% PB + 60% TB HĐ)</div>
          <div class="score-total-value">${fa != null ? fa.toFixed(2) : '–'}</div>
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
          ❌ <strong>Chủ tịch HĐ yêu cầu chỉnh sửa lại:</strong> ${escapeHtml(k.tuChoiCTHD || 'Vui lòng xem lại và nộp bài mới.')}
          <div style="font-size:12px;color:#BF2600;margin-top:4px">Hãy upload lại bài chỉnh sửa bên dưới.</div>
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
      <div style="margin-top:10px;font-size:12px;color:var(--text3)">Trạng thái duyệt sửa: GVHD ${k.xacNhanGVHD ? 'Đồng ý' : 'Chờ'} • Chủ tịch ${k.xacNhanCTHD ? 'Đồng ý' : 'Chờ'}</div>
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
          <div class="form-group"><label>Tên đề tài *</label><input type="text" id="fk-ten" value="${myBCTT.tenDeTai}" placeholder="Tên đề tài KLTN..."></div>
          <div class="form-group"><label>Ngành *</label><select id="fk-mang"><option value="">-- Chọn ngành --</option>${DB.mangDeTai.map(m=>`<option ${m===myBCTT.mangDeTai?'selected':''}>${m}</option>`).join('')}</select></div>
          <div class="form-group"><label>GV Hướng dẫn</label><input type="text" value="${getUser(myBCTT.gvEmail)?.name || myBCTT.gvEmail}" readonly style="background:var(--bg)" id="fk-gvhd-display"><input type="hidden" id="fk-gvhd" value="${myBCTT.gvEmail}"></div>
          <div class="form-group"><label>Đợt đăng ký *</label><select id="fk-dot"><option value="">-- Chọn đợt --</option>${DB.dotDangKy.filter(d => d.trangThai === 'dang_mo' && d.loai === 'KLTN' && dotMatchesStudentHeAndMajor(d)).map(d => `<option value="${d.id}">${d.ten}</option>`).join('')}</select></div>
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
    html += `<div class="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Đề tài</th><th>Mảng</th><th>Công ty</th><th>GV HD</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>`;
    bcttData.forEach(b => {
      const sv = getUser(b.svEmail); const gv = getUser(b.gvEmail);
      html += `<tr>
        <td><div style="font-weight:600">${sv?.name || b.svEmail}</div><div style="font-size:11px;color:var(--text3)">${b.svEmail}</div></td>
        <td style="max-width:200px"><div style="font-weight:500;cursor:pointer;color:var(--primary)" title="Xem chi tiết" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div></td>
        <td><span class="badge badge-blue" style="white-space:nowrap">${b.mangDeTai}</span></td>
        <td style="font-size:12px">${b.tenCongTy}</td>
        <td style="font-size:12px">${gv?.name || b.gvEmail}</td>
        <td>${statusBadge(b.trangThai)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁 Chi tiết</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  } else { html += `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Chưa có BCTT nào</div></div>`; }

  html += `</div><div id="tab-kltn-list" class="tab-content ${activeTab === 'tab-kltn-list' ? 'active' : ''}">`;

  if (kltnData.length) {
    html += `<div class="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Đề tài</th><th>GV HD</th><th>GV PB</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>`;
    kltnData.forEach(k => {
      const sv = getUser(k.svEmail); const gvhd = getUser(k.gvHDEmail); const gvpb = k.gvPBEmail ? getUser(k.gvPBEmail) : null;
      html += `<tr>
        <td><div style="font-weight:600">${sv?.name || k.svEmail}</div><div style="font-size:11px;color:var(--text3)">${k.svEmail}</div></td>
        <td style="max-width:220px"><div style="font-weight:500;cursor:pointer;color:var(--primary)" title="Xem chi tiết" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div></td>
        <td style="font-size:12px">${gvhd?.name || k.gvHDEmail}</td>
        <td style="font-size:12px">${gvpb ? gvpb.name : '<span style="color:var(--text3)">Chưa PB</span>'}</td>
        <td>${statusBadge(k.trangThai)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  } else { html += `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Chưa có KLTN nào</div></div>`; }
  html += `</div>`;
  el.innerHTML = html;
}

function viewBCTTDetail(id) {
  const b = DB.bcttList.find((x) => x.id === id);
  if (!b) return toast('Không tìm thấy đề tài BCTT', 'error');
  if (!isBCTTVisibleForCurrentUser(b)) return toast('Bạn không có quyền xem đề tài này', 'error');
  const sv = getUser(b.svEmail);
  const gv = getUser(b.gvEmail);
  const fileRow = (label, path) =>
    path
      ? `<a href="${uploadFileHref(path)}" target="_blank" rel="noopener" style="color:var(--accent2)">📥 Tải xuống</a> <span style="font-size:11px;color:var(--text3)">${escapeHtml(path.split(/[/\\\\]/).pop() || '')}</span>`
      : '<span style="color:var(--text3)">Chưa nộp</span>';
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
    <div class="form-group" style="margin-top:8px"><label style="font-size:12px">Nhận xét BCTT</label><textarea readonly style="width:100%;background:var(--bg);min-height:72px;font-size:13px">${escapeHtml(b.nhanXetBCTT || '')}</textarea></div>
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

  const hasAnyScore = k.diemHD != null || k.diemPB != null || k.diemBB != null;
  const faDetail = computeKLTNFinalAvg(k);
 
  const scoreBlock = hasAnyScore
    ? `<div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div class="kltn-score-box"><span class="kltn-score-label">Điểm GVHD</span><div class="kltn-score-val">${k.diemHD != null ? escapeHtml(String(k.diemHD)) : '–'}</div></div>
        <div class="kltn-score-box"><span class="kltn-score-label">Điểm GVPB</span><div class="kltn-score-val">${k.diemPB != null ? escapeHtml(String(k.diemPB)) : '–'}</div></div>
        <div class="kltn-score-box"><span class="kltn-score-label">Điểm CT.HĐ</span><div class="kltn-score-val">${k.diemBB != null ? escapeHtml(String(k.diemBB)) : '–'}</div></div>
        ${faDetail != null ? `<div class="kltn-score-box" style="background: #fff1f2; border-color: #fecdd3;"><span class="kltn-score-label" style="color: #9f1239;">Tổng hợp</span><div class="kltn-score-val" style="color: #e11d48; font-size: 22px;">${faDetail.toFixed(2)}</div></div>` : ''}
       </div>`
    : '<div style="font-size:13.5px; color:var(--text3); font-style: italic; margin-bottom: 15px;">Chưa có điểm chấm.</div>';

  const textareaStyle = "background:var(--bg, #fff); width:100%; border: 1px solid var(--border, #d1d5db); border-radius: 6px; padding: 10px; font-size: 13.5px; resize: none; color: var(--text1, #1f2937); line-height: 1.5;";
  const noteTitleStyle = "font-weight: bold; font-size: 14px; color: var(--text1, #111827); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;";
 
  const hdBlockDetail = k.hdNote ? `<div style="margin-bottom: 16px;"><div style="${noteTitleStyle}">📝 Nhận xét GVHD</div><textarea readonly style="${textareaStyle}" rows="4">${escapeHtml(k.hdNote)}</textarea></div>` : '';
  const pbBlockDetail = (k.pbNote || k.pbCauHoi) ? `<div style="margin-bottom: 16px;"><div style="${noteTitleStyle}">📝 Nhận xét & câu hỏi GVPB</div><textarea readonly style="${textareaStyle}" rows="5">${escapeHtml((k.pbNote || '') + (k.pbCauHoi ? '\n\n— Câu hỏi —\n' + k.pbCauHoi : ''))}</textarea></div>` : '';
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
      <div class="modal-title">📄 Chi tiết Khóa Luận Tốt Nghiệp</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
   
    <div class="kltn-section">
      <div class="kltn-sec-title">Thông tin chung</div>
      <div class="kltn-row"><span class="kltn-label">MSSV:</span><span class="kltn-value" style="font-weight: 600;">${escapeHtml(mssv)}</span></div>
      <div class="kltn-row"><span class="kltn-label">Sinh viên:</span><span class="kltn-value">${escapeHtml(sv?.name || '')}</span></div>
      <div class="kltn-row"><span class="kltn-label">Tên đề tài:</span><span class="kltn-value" style="font-weight:700; color: var(--accent, #0284c7); font-size: 15px;">${escapeHtml(k.tenDeTai)}</span></div>
      <div class="kltn-row"><span class="kltn-label">Ngành:</span><span class="kltn-value">${escapeHtml(k.mangDeTai)}</span></div>
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
        <span class="kltn-label" style="min-width: 130px;">Duyệt chỉnh sửa:</span>
        <span class="kltn-value">
          <span style="display:inline-block; margin-right: 15px;"><b>GVHD:</b> ${k.xacNhanGVHD ? '<span style="color:#16a34a; font-weight:bold;">✅ Đồng ý</span>' : '<span style="color:#d97706;">⏳ Chờ</span>'}</span>
          <span><b>Chủ tịch:</b> ${k.xacNhanCTHD ? '<span style="color:#16a34a; font-weight:bold;">✅ Đồng ý</span>' : '<span style="color:#d97706;">⏳ Chờ</span>'}</span>
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
    const gvList = DB.users.filter(x => x.role === 'gv' || x.role === 'bm').filter((g) => hasCommonMajor(u, g));
    const el = document.getElementById('page-duyetde');
    let html = `<div class="page-header"><h1>🎯 Mở slot GV hướng dẫn theo đợt</h1><p>Duyệt quota để sinh viên có thể đăng ký.</p></div>`;
    if (!gvList.length) {
      html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Không có giảng viên cùng ngành</div></div></div>`;
      el.innerHTML = html;
      return;
    }
    html += `<div class="card"><div class="table-wrap"><table><thead><tr><th>Giảng viên</th><th>Quota</th><th>Slot mở</th><th>Thao tác</th></tr></thead><tbody>`;
    gvList.forEach(g => {
      g.slotOpen = g.slotOpen !== false;
      html += `<tr><td>${g.name}</td>
  <td><strong>${g.quota || 0}</strong> / ${g.quota_max || g.quota || 0}</td>
  <td>${g.slotOpen ? '<span class="badge badge-green">Đang mở</span>' : '<span class="badge badge-red">Đã khóa</span>'}</td>
  <td><button class="btn btn-sm ${g.slotOpen ? 'btn-danger' : 'btn-success'}" onclick="toggleSlot('${g.email}')">${g.slotOpen ? 'Khóa slot' : 'Mở slot'}</button></td>
</tr>`;
    });
    html += `</tbody></table></div></div>`;
    el.innerHTML = html;
    return;
  }
  let list = [];
  if (u.role === 'gv') list = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_duyet');
  const el = document.getElementById('page-duyetde');
  let html = `<div class="page-header"><h1>${u.role === 'bm' ? '👥 Duyệt & phân công PB' : '✅ Duyệt đề tài BCTT'}</h1><p>${list.length} đề tài cần xử lý</p></div>`;

  if (!list.length) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Không có đề tài nào cần duyệt</div></div></div>`;
  } else {
    list.forEach(b => {
      const sv = getUser(b.svEmail);
      html += `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;margin-bottom:6px;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:8px">${escapeHtml(b.mangDeTai)} • ${escapeHtml(b.tenCongTy)}</div>
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
  el.innerHTML = html;
}

function renderPhanCong() {
  const el = document.getElementById('page-phancong');
  const needPB = DB.kltnList.filter(k => !k.gvPBEmail);
  const needHD = DB.kltnList.filter(k => !k.hoiDong);
  const gvList = DB.users.filter(u => u.role === 'gv' || u.role === 'bm');

  let html = `<div class="page-header"><h1>👥 Phân công KLTN</h1><p>${needPB.length} KLTN cần phân công phản biện • ${needHD.length} KLTN cần lập hội đồng</p></div>`;
  html += `<div class="card" style="margin-bottom:14px"><div class="card-title" style="margin-bottom:10px">🧾 Phân công GV phản biện KLTN</div>`;
  if (!needPB.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Tất cả KLTN đã có GV phản biện</div></div>`;
  } else {
    needPB.forEach(k => {
      const sv = getUser(k.svEmail);
      html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:200px"><div style="font-weight:700;cursor:pointer;color:var(--primary)" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="viewKLTNDetail('${k.id}')">👁 Chi tiết</button><button class="btn btn-primary btn-sm" onclick="phanCongPBKLTN('${k.id}')">Phân công PB & HĐ</button></div>
      </div>`;
    });
  }
  html += `</div>`;
  el.innerHTML = html;
}

function renderNhapDiem() {
  const u = DB.currentUser;
  const el = document.getElementById('page-nhapDiem');
  let list = [];
  if (u.role === 'gv') list = gvKLTNListForNhapDiem(u);
  else if (u.role === 'bm') list = DB.kltnList.filter((k) => ['cham_diem', 'bao_ve'].includes(k.trangThai));

  let html = `<div class="page-header"><h1>📊 Nhập điểm & sau bảo vệ KLTN</h1><p>${list.length} đề tài</p></div>`;

  if (!list.length) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Không có KLTN nào trong giai đoạn này</div></div></div>`;
  } else {
    list.forEach((k) => {
      const sv = getUser(k.svEmail);
      const isBM = u.role === 'bm';
      const storedBmRole = localStorage.getItem(`bmRole_${k.id}`);
      if (storedBmRole && !window[`bmRole_${k.id}`]) window[`bmRole_${k.id}`] = storedBmRole;
      const bmRole = isBM ? (window[`bmRole_${k.id}`] || 'summary') : null;
      let isHD = !isBM && u.email === k.gvHDEmail;
      let isPB = !isBM && u.email === k.gvPBEmail;
      let isCT = !isBM && k.hoiDong && u.email === k.hoiDong.ct;
      const isTK = !isBM && k.hoiDong && u.email === k.hoiDong.tk;
      let isTVMember = !isBM && k.hoiDong && Array.isArray(k.hoiDong.tv) && k.hoiDong.tv.includes(u.email) && !isCT && !isTK;

      html += `<div class="card" style="margin-bottom:16px">
        <div class="card-header"><div><div class="card-title" style="cursor:pointer;color:var(--primary)" onclick="viewKLTNDetail('${k.id}')">${escapeHtml(k.tenDeTai)}</div></div>${statusBadge(k.trangThai)}</div>`;
        
      if (isHD) {
        html += `<div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:8px">🎯 GV hướng dẫn — chấm điểm</div>
          <div class="form-group"><label>Điểm HD</label><input type="number" id="diem-hd-${k.id}" value="${k.diemHD ?? ''}"></div>
          <button class="btn btn-primary btn-sm" onclick="saveScoreHD('${k.id}')">💾 Lưu điểm</button>`;
      }
      
      html += `</div>`;
    });
  }
  el.innerHTML = html;
}

function renderHuongDan() {
  const u = DB.currentUser;
  const list = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_duyet');
  const chamList = DB.bcttList.filter(b => b.gvEmail === u.email && b.trangThai === 'cho_cham');
  const el = document.getElementById('page-huongdan');
  let html = `<div class="page-header"><h1>✅ Hướng dẫn</h1><p>Duyệt BCTT và chấm BCTT theo quy trình</p></div>`;
  
  if (!list.length) {
    html += `<div class="card"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Không có đề tài chờ duyệt</div></div></div>`;
  } else {
    list.forEach(b => {
      html += `<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:160px"><div style="font-weight:700;cursor:pointer;color:var(--primary)" onclick="viewBCTTDetail('${b.id}')">${escapeHtml(b.tenDeTai)}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="viewBCTTDetail('${b.id}')">👁 Chi tiết</button><button class="btn btn-success btn-sm" onclick="duyetBCTT('${b.id}',true)">Đồng ý</button> <button class="btn btn-danger btn-sm" onclick="duyetBCTT('${b.id}',false)">Không đồng ý</button></div></div></div>`;
    });
  }
  el.innerHTML = html;
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
  const el = document.getElementById('page-profile');
  el.innerHTML = `<div class="page-header"><h1>👤 Hồ sơ cá nhân</h1></div>
    <div class="grid-2">
      <div class="card">
        <div style="text-align:center;padding:20px 0">
          <div style="width:80px;height:80px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;margin:0 auto 12px">${u.name.charAt(0)}</div>
          <div style="font-size:20px;font-weight:700">${u.name}</div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px">${u.email}</div>
          <span class="badge badge-blue" style="margin-top:8px">${roleNames[u.role]}</span>
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
function renderPhanBien() { document.getElementById('page-phanbien').innerHTML = `<div class="page-header"><h1>🧾 Phản biện</h1></div>`; }
function renderHoiDong() { document.getElementById('page-hoidong').innerHTML = `<div class="page-header"><h1>🏛️ Hội đồng</h1></div>`; }
function renderChuTich() { document.getElementById('page-chutich').innerHTML = `<div class="page-header"><h1>👨‍⚖️ Chủ tịch</h1></div>`; }
function renderThuKy() { document.getElementById('page-thuky').innerHTML = `<div class="page-header"><h1>📝 Thư ký</h1></div>`; }
function renderGoiY() { document.getElementById('page-goiy').innerHTML = `<div class="page-header"><h1>💡 Gợi ý đề tài</h1></div>`; }
function renderThongKe() { document.getElementById('page-thongke').innerHTML = `<div class="page-header"><h1>📈 Thống kê</h1></div>`; }
function renderTheoDoi() { document.getElementById('page-theodoi').innerHTML = `<div class="page-header"><h1>⏱️ Theo dõi trạng thái</h1></div>`; }

function switchTab(e, tabId) {
  const parent = e.target.closest('.page') || document;
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

document.addEventListener("DOMContentLoaded", async () => {
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
    document.getElementById("screen-login").classList.remove("active");
    document.getElementById("screen-app").classList.add("active");
    await initApp();
    try {
      localStorage.setItem("currentUser", JSON.stringify(DB.currentUser));
    } catch (_) {}
  } catch (_) {
    DB.currentUser = null;
    localStorage.removeItem("currentUser");
  }
});
