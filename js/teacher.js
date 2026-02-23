/**
 * Teacher Module - Logic cho giáo viên
 * Đăng ký, đăng nhập, dashboard, lớp, slot, QR, manual attendance, export Excel
 */

import {
  db,
  auth,
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "./firebase-config.js";
import {
  showToast,
  getOrCreateSchoolId,
  getCurrentPosition,
} from "./utils.js";

const SLOT_DURATION_MS = 20 * 60 * 1000; // 20 phút
const SLOT_RADIUS = 200;

let currentTeacher = null;

/**
 * Đăng nhập giáo viên
 */
export function initTeacherLogin() {
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const errorMsg = document.getElementById("errorMsg");

  loginBtn?.addEventListener("click", async () => {
    const email = emailEl?.value?.trim();
    const password = passwordEl?.value?.trim();
    if (!email || !password) {
      errorMsg.textContent = "Vui lòng nhập email và mật khẩu";
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const teacher = await getTeacherData(cred.user.uid);
      if (!teacher) {
        errorMsg.textContent = "Tài khoản không phải giáo viên";
        await signOut(auth);
        return;
      }
      showToast("Đăng nhập thành công", "success");
      window.location.href = "dashboard.html";
    } catch (e) {
      errorMsg.textContent = e.message || "Đăng nhập thất bại";
    }
  });
}

/**
 * Đăng ký giáo viên
 */
export function initTeacherRegister() {
  const emailEl = document.getElementById("email");
  const teacherNameEl = document.getElementById("teacherName");
  const schoolNameEl = document.getElementById("schoolName");
  const passwordEl = document.getElementById("password");
  const confirmEl = document.getElementById("confirmPassword");
  const registerBtn = document.getElementById("registerBtn");
  const errorMsg = document.getElementById("errorMsg");

  registerBtn?.addEventListener("click", async () => {
    const email = emailEl?.value?.trim();
    const teacherName = teacherNameEl?.value?.trim();
    const schoolName = schoolNameEl?.value?.trim();
    const password = passwordEl?.value?.trim();
    const confirm = confirmEl?.value?.trim();

    if (!email || !teacherName || !schoolName || !password) {
      errorMsg.textContent = "Vui lòng điền đầy đủ thông tin";
      return;
    }
    if (password.length < 6) {
      errorMsg.textContent = "Mật khẩu tối thiểu 6 ký tự";
      return;
    }
    if (password !== confirm) {
      errorMsg.textContent = "Mật khẩu xác nhận không khớp";
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const schoolId = await getOrCreateSchoolId(db, ref, get, push, set, schoolName);

      await set(ref(db, `teachers/${cred.user.uid}`), {
        username: email,
        teacherName,
        schoolId,
      });

      showToast("Đăng ký thành công", "success");
      window.location.href = "dashboard.html";
    } catch (e) {
      errorMsg.textContent = e.message || "Đăng ký thất bại";
    }
  });
}

async function getTeacherData(uid) {
  const snap = await get(ref(db, `teachers/${uid}`));
  return snap.exists() ? { id: uid, ...snap.val() } : null;
}

/**
 * Dashboard giáo viên
 */
export async function initDashboard() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "teacher-login.html";
      return;
    }
    currentTeacher = await getTeacherData(user.uid);
    if (!currentTeacher) {
      window.location.href = "teacher-login.html";
      return;
    }

    document.getElementById("teacherInfo").textContent = currentTeacher.teacherName;
    document.getElementById("logoutBtn").href = "#";
    document.getElementById("logoutBtn").onclick = () => {
      signOut(auth);
      window.location.href = "teacher-login.html";
    };

    await loadClasses();
    await loadPendingStudents();
    await loadFaceUpdateRequests();
    loadSlotClassSelect();
    loadManualSelects();
    loadExportSelect();

    // Create class
    document.getElementById("createClassBtn")?.addEventListener("click", createClass);

    // Open slot
    document.getElementById("openSlotBtn")?.addEventListener("click", openSlot);

    // Manual attendance
    document.getElementById("manualClassSelect")?.addEventListener("change", onManualClassChange);
    document.getElementById("manualSlotSelect")?.addEventListener("change", onManualSlotChange);

    document.getElementById("exportExcelBtn")?.addEventListener("click", exportExcel);
  });
}

async function loadClasses() {
  const classesRef = ref(db, "classes");
  onValue(classesRef, (snap) => {
    const list = document.getElementById("classList");
    if (!snap.exists()) {
      list.innerHTML = "<li>Chưa có lớp nào</li>";
      return;
    }
    const classes = Object.entries(snap.val())
      .filter(([_, c]) => c.teacherId === currentTeacher.id || c.schoolId === currentTeacher.schoolId)
      .filter(([_, c]) => c.teacherId === currentTeacher.id); // Mỗi GV chỉ thấy lớp của mình
    list.innerHTML = classes
      .map(
        ([id, c]) =>
          `<li>
            <span>${c.name}</span>
            <span>
              <a href="class.html?id=${id}">Xem</a>
              <button class="danger btn-delete-class" data-id="${id}">Xóa</button>
            </span>
          </li>`
      )
      .join("");

    list.querySelectorAll(".btn-delete-class").forEach((btn) => {
      btn.addEventListener("click", () => deleteClass(btn.dataset.id));
    });
  });
}

async function createClass() {
  const name = document.getElementById("newClassName")?.value?.trim();
  if (!name) {
    showToast("Nhập tên lớp", "error");
    return;
  }
  try {
    const classRef = push(ref(db, "classes"));
    await set(classRef, {
      name,
      teacherId: currentTeacher.id,
      schoolId: currentTeacher.schoolId,
    });
    showToast("Tạo lớp thành công", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function deleteClass(classId) {
  if (!confirm("Xóa lớp và toàn bộ dữ liệu liên quan?")) return;
  try {
    const paths = [
      `classes/${classId}`,
      `students/${classId}`,
      `pendingStudents/${classId}`,
      `faceUpdateRequests/${classId}`,
      `slots/${classId}`,
      `attendance/${classId}`,
    ];
    for (const p of paths) {
      await remove(ref(db, p));
    }
    showToast("Đã xóa lớp", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function loadPendingStudents() {
  const list = document.getElementById("pendingStudentsList");
  if (!currentTeacher?.schoolId) return;

  const classesRef = ref(db, "classes");
  const classesSnap = await get(classesRef);
  if (!classesSnap.exists()) {
    list.innerHTML = "<li>Không có lớp</li>";
    return;
  }
  const myClasses = Object.entries(classesSnap.val()).filter(
    ([_, c]) => c.teacherId === currentTeacher.id
  );

  let html = "";
  for (const [classId, cls] of myClasses) {
    const pendingRef = ref(db, `pendingStudents/${classId}`);
    const snap = await get(pendingRef);
    if (!snap.exists()) continue;
    const items = Object.entries(snap.val());
    for (const [studentId, s] of items) {
      html += `<li>
        <span>${escapeHtml(cls.name)} - ${escapeHtml(s.name)} (${escapeHtml(s.studentCode)})</span>
        <span>
          <button class="approve-pending" data-class="${classId}" data-id="${studentId}">Duyệt</button>
          <button class="reject-pending danger" data-class="${classId}" data-id="${studentId}">Từ chối</button>
        </span>
      </li>`;
    }
  }
  list.innerHTML = html || "<li>Không có yêu cầu chờ duyệt</li>";

  list.querySelectorAll(".approve-pending").forEach((b) => {
    b.addEventListener("click", async () => {
      const classId = b.dataset.class;
      const studentId = b.dataset.id;
      const pendSnap = await get(ref(db, `pendingStudents/${classId}/${studentId}`));
      if (!pendSnap.exists()) return;
      const s = pendSnap.val();
      approvePendingStudent(classId, studentId, s.name, s.studentCode, s.faceEmbedding || []);
    });
  });
  list.querySelectorAll(".reject-pending").forEach((b) => {
    b.addEventListener("click", () => rejectPendingStudent(b.dataset.class, b.dataset.id));
  });
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function approvePendingStudent(classId, studentId, name, code, embedding) {
  try {
    const emb = Array.isArray(embedding) ? embedding : [];
    await set(ref(db, `students/${classId}/${studentId}`), {
      name,
      studentCode: code,
      faceEmbedding: emb,
    });
    await remove(ref(db, `pendingStudents/${classId}/${studentId}`));
    showToast("Đã duyệt học sinh", "success");
    loadPendingStudents();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function rejectPendingStudent(classId, studentId) {
  try {
    await remove(ref(db, `pendingStudents/${classId}/${studentId}`));
    showToast("Đã từ chối", "info");
    loadPendingStudents();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function loadFaceUpdateRequests() {
  const list = document.getElementById("faceUpdateList");
  if (!currentTeacher?.id) return;

  const classesRef = ref(db, "classes");
  const classesSnap = await get(classesRef);
  if (!classesSnap.exists()) {
    list.innerHTML = "<li>Không có lớp</li>";
    return;
  }
  const myClasses = Object.entries(classesSnap.val()).filter(
    ([_, c]) => c.teacherId === currentTeacher.id
  );

  let html = "";
  for (const [classId, cls] of myClasses) {
    const reqRef = ref(db, `faceUpdateRequests/${classId}`);
    const snap = await get(reqRef);
    if (!snap.exists()) continue;
    const studentsSnap = await get(ref(db, `students/${classId}`));
    const students = studentsSnap.exists() ? studentsSnap.val() : {};

    for (const [studentId, req] of Object.entries(snap.val())) {
      const s = students[studentId] || {};
      html += `<li>
        <span>${escapeHtml(cls.name)} - ${escapeHtml(s.name || studentId)} (${escapeHtml(s.studentCode || "")})</span>
        <span>
          <button class="approve-face" data-class="${classId}" data-id="${studentId}">Duyệt</button>
          <button class="reject-face danger" data-class="${classId}" data-id="${studentId}">Từ chối</button>
        </span>
      </li>`;
    }
  }
  list.innerHTML = html || "<li>Không có yêu cầu cập nhật mặt</li>";

  list.querySelectorAll(".approve-face").forEach((b) => {
    b.addEventListener("click", async () => {
      const classId = b.dataset.class;
      const studentId = b.dataset.id;
      const reqSnap = await get(ref(db, `faceUpdateRequests/${classId}/${studentId}`));
      if (!reqSnap.exists()) return;
      const emb = reqSnap.val().newEmbedding || [];
      approveFaceUpdate(classId, studentId, emb);
    });
  });
  list.querySelectorAll(".reject-face").forEach((b) => {
    b.addEventListener("click", () => rejectFaceUpdate(b.dataset.class, b.dataset.id));
  });
}

async function approveFaceUpdate(classId, studentId, newEmbedding) {
  try {
    await update(ref(db, `students/${classId}/${studentId}`), {
      faceEmbedding: newEmbedding,
    });
    await remove(ref(db, `faceUpdateRequests/${classId}/${studentId}`));
    showToast("Đã cập nhật khuôn mặt", "success");
    loadFaceUpdateRequests();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function rejectFaceUpdate(classId, studentId) {
  try {
    await remove(ref(db, `faceUpdateRequests/${classId}/${studentId}`));
    showToast("Đã từ chối", "info");
    loadFaceUpdateRequests();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function loadSlotClassSelect() {
  const select = document.getElementById("slotClassSelect");
  get(ref(db, "classes")).then((snap) => {
    if (!snap.exists()) return;
    const classes = Object.entries(snap.val()).filter(
      ([_, c]) => c.teacherId === currentTeacher.id
    );
    select.innerHTML =
      '<option value="">-- Chọn lớp --</option>' +
      classes.map(([id, c]) => `<option value="${id}">${c.name}</option>`).join("");
  });
}

async function openSlot() {
  const classId = document.getElementById("slotClassSelect")?.value;
  if (!classId) {
    showToast("Chọn lớp", "error");
    return;
  }
  try {
    const pos = await getCurrentPosition();
    const startTime = Date.now();
    const endTime = startTime + SLOT_DURATION_MS;

    const slotRef = push(ref(db, `slots/${classId}`));
    await set(slotRef, {
      startTime,
      endTime,
      teacherLocation: { lat: pos.lat, lng: pos.lng },
      radius: SLOT_RADIUS,
    });
    const slotId = slotRef.key;

    // Realtime trạng thái slot
    const statusEl = document.getElementById("slotStatus");
    statusEl.innerHTML = `<span class="badge badge-success">Đang mở điểm danh - Hết hạn lúc ${new Date(endTime).toLocaleTimeString("vi")}</span>`;

    onValue(ref(db, `slots/${classId}/${slotId}`), (snap) => {
      if (!snap.exists()) {
        statusEl.innerHTML = "<span class='badge badge-danger'>Slot đã đóng</span>";
      }
    });

    // QR Code
    const qrContent = `${classId}_${slotId}`;
    await loadQRCode(qrContent);
    document.getElementById("qrContainer").style.display = "block";
  } catch (e) {
    showToast(e.message || "Không thể lấy GPS", "error");
  }
}

function loadQRCode(content) {
  return new Promise((resolve) => {
    const el = document.getElementById("qrCode");
    const textEl = document.getElementById("qrText");
    el.innerHTML = "";
    if (textEl) {
      textEl.textContent = `classId_slotId: ${content}`;
    }
    if (window.QRCode) {
      new window.QRCode(el, { text: content, width: 200, height: 200 });
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@gh-pages/qrcode.min.js";
    script.onload = () => {
      if (window.QRCode) {
        new window.QRCode(el, { text: content, width: 200, height: 200 });
      }
      resolve();
    };
    document.head.appendChild(script);
  });
}

function loadManualSelects() {
  const classSelect = document.getElementById("manualClassSelect");
  get(ref(db, "classes")).then((snap) => {
    if (!snap.exists()) return;
    const classes = Object.entries(snap.val()).filter(
      ([_, c]) => c.teacherId === currentTeacher.id
    );
    classSelect.innerHTML =
      '<option value="">-- Chọn lớp --</option>' +
      classes.map(([id, c]) => `<option value="${id}">${c.name}</option>`).join("");
  });
}

async function onManualClassChange() {
  const classId = document.getElementById("manualClassSelect")?.value;
  const slotSelect = document.getElementById("manualSlotSelect");
  slotSelect.innerHTML = '<option value="">-- Chọn slot --</option>';
  if (!classId) return;
  const slotsSnap = await get(ref(db, `slots/${classId}`));
  if (!slotsSnap.exists()) return;
  const slots = slotsSnap.val();
  const now = Date.now();
  slotSelect.innerHTML += Object.entries(slots)
    .filter(([_, s]) => s.startTime && s.startTime > now - 7 * 86400000) // 7 ngày gần đây
    .map(([id, s]) => {
      const d = new Date(s.startTime || 0);
      return `<option value="${id}">${d.toLocaleString("vi")}</option>`;
    })
    .join("");
  await onManualSlotChange();
}

async function onManualSlotChange() {
  const classId = document.getElementById("manualClassSelect")?.value;
  const slotId = document.getElementById("manualSlotSelect")?.value;
  const listEl = document.getElementById("manualAttendanceList");
  if (!classId || !slotId) {
    listEl.innerHTML = "";
    return;
  }

  const [studentsSnap, attSnap] = await Promise.all([
    get(ref(db, `students/${classId}`)),
    get(ref(db, `attendance/${classId}/${slotId}`)),
  ]);
  const students = studentsSnap.exists() ? studentsSnap.val() : {};
  const attended = attSnap.exists() ? attSnap.val() : {};

  listEl.innerHTML = Object.entries(students)
    .map(([sid, s]) => {
      const isPresent = !!attended[sid];
      return `<label style="display:flex;align-items:center;gap:8px;margin:4px 0;">
        <input type="checkbox" ${isPresent ? "checked" : ""} data-sid="${sid}">
        ${s.name} (${s.studentCode})
      </label>`;
    })
    .join("");

  listEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      saveManualAttendance(classId, slotId, cb.dataset.sid, cb.checked);
    });
  });
}

async function saveManualAttendance(classId, slotId, studentId, present) {
  const attRef = ref(db, `attendance/${classId}/${slotId}/${studentId}`);
  if (present) {
    await set(attRef, {
      timestamp: Date.now(),
      distance: 0,
      faceScore: 1,
      manual: true,
    });
  } else {
    await remove(attRef);
  }
}

async function exportExcel() {
  const classId = document.getElementById("exportClassSelect")?.value;
  if (!classId) {
    showToast("Chọn lớp", "error");
    return;
  }
  try {
    await loadSheetJS();
    const XLSX = window.XLSX;
    const attSnap = await get(ref(db, `attendance/${classId}`));
    const studentsSnap = await get(ref(db, `students/${classId}`));
    const slotsSnap = await get(ref(db, `slots/${classId}`));

    const students = studentsSnap.exists() ? studentsSnap.val() : {};
    const slots = slotsSnap.exists() ? slotsSnap.val() : {};
    const attendance = attSnap.exists() ? attSnap.val() : {};

    const byDate = {};
    for (const [slotId, slotData] of Object.entries(attendance)) {
      const slot = slots[slotId];
      const dateStr = slot?.startTime
        ? new Date(slot.startTime).toISOString().slice(0, 10)
        : "unknown";
      if (!byDate[dateStr]) byDate[dateStr] = [];
      for (const [studentId, att] of Object.entries(slotData)) {
        const s = students[studentId];
        byDate[dateStr].push({
          name: s?.name || studentId,
          studentCode: s?.studentCode || "",
          timestamp: att.timestamp,
        });
      }
    }

    const wb = XLSX.utils.book_new();
    for (const [dateStr, dayAtt] of Object.entries(byDate)) {
      const rows = [
        ["MSSV", "Họ tên", "Thời điểm điểm danh"],
        ...dayAtt.map((a) => [
          a.studentCode,
          a.name,
          a.timestamp ? new Date(a.timestamp).toLocaleString("vi") : "",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, dateStr);
    }
    if (Object.keys(byDate).length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["Chưa có dữ liệu điểm danh"]]);
      XLSX.utils.book_append_sheet(wb, ws, "empty");
    }
    XLSX.writeFile(wb, `diem-danh-${classId}.xlsx`);
    showToast("Xuất Excel thành công", "success");
  } catch (e) {
    showToast(e.message || "Lỗi xuất Excel", "error");
  }
}

function loadSheetJS() {
  return new Promise((resolve) => {
    if (window.XLSX) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

function loadExportSelect() {
  const select = document.getElementById("exportClassSelect");
  get(ref(db, "classes")).then((snap) => {
    if (!snap.exists()) return;
    const classes = Object.entries(snap.val()).filter(
      ([_, c]) => c.teacherId === currentTeacher.id
    );
    select.innerHTML =
      '<option value="">-- Chọn lớp --</option>' +
      classes.map(([id, c]) => `<option value="${id}">${c.name}</option>`).join("");
  });
}

/**
 * Trang chi tiết lớp (class.html)
 */
export async function initClassPage() {
  const params = new URLSearchParams(window.location.search);
  const classId = params.get("id");
  if (!classId) {
    document.getElementById("classContent").innerHTML = "<p>Không tìm thấy lớp</p>";
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "teacher-login.html";
      return;
    }
    const teacher = await getTeacherData(user.uid);
    const classSnap = await get(ref(db, `classes/${classId}`));
    if (!classSnap.exists()) {
      document.getElementById("classContent").innerHTML = "<p>Lớp không tồn tại</p>";
      return;
    }
    const cls = classSnap.val();
    if (cls.teacherId !== teacher?.id) {
      document.getElementById("classContent").innerHTML = "<p>Không có quyền</p>";
      return;
    }

    const studentsSnap = await get(ref(db, `students/${classId}`));
    const students = studentsSnap.exists() ? studentsSnap.val() : {};
    const rows = Object.entries(students).map(
      ([id, s]) =>
        `<tr><td>${s.studentCode}</td><td>${s.name}</td><td>${s.faceEmbedding ? "Có" : "Chưa"}</td></tr>`
    );
    document.getElementById("classContent").innerHTML = `
      <div class="card">
        <h2>${cls.name}</h2>
        <table>
          <thead><tr><th>MSSV</th><th>Họ tên</th><th>Face</th></tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  });
}
