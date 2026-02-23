/**
 * Student Attendance - Logic cho trang index.html (điểm danh)
 */

import { db, ref, get, set } from "./firebase-config.js";
import { showToast, getDistanceMeters, getCurrentPosition } from "./utils.js";
import { getFaceDescriptor, isFaceMatch, drawVideoToCanvas, loadFaceApiModels } from "./face.js";
import { getSchools, getClassesBySchool } from "./utils.js";

const SLOT_RADIUS = 200; // mét

let videoEl, canvasEl;
let currentSchoolId = null;
let currentClassId = null;
let currentSlotId = null;
let studentCode = "";

/**
 * Khởi tạo trang điểm danh
 */
export async function initStudentPage() {
  const schoolSelect = document.getElementById("schoolSelect");
  const classSelect = document.getElementById("classSelect");
  const qrInput = document.getElementById("qrInput");
  const mssvInput = document.getElementById("mssvInput");
  const scanBtn = document.getElementById("scanBtn");
  const cameraSection = document.getElementById("cameraSection");
  const resultDiv = document.getElementById("attendanceResult");

  videoEl = document.getElementById("videoEl");
  canvasEl = document.getElementById("faceCanvas");

  // Load danh sách trường
  const schools = await getSchools(db, ref, get);
  schoolSelect.innerHTML =
    '<option value="">-- Chọn trường --</option>' +
    schools.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");

  schoolSelect.addEventListener("change", async () => {
    currentSchoolId = schoolSelect.value;
    classSelect.innerHTML = '<option value="">-- Chọn lớp --</option>';
    if (!currentSchoolId) return;
    const classes = await getClassesBySchool(db, ref, get, currentSchoolId);
    classSelect.innerHTML += classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  });

  classSelect.addEventListener("change", () => {
    currentClassId = classSelect.value;
  });

  // Quét QR - nhập/dán classId_slotId
  qrInput.addEventListener("input", (e) => {
    const val = (e.target.value || "").trim();
    if (val && val.includes("_")) parseQrAndSetSlot(val);
  });

  scanBtn?.addEventListener("click", () => {
    const qrVal = qrInput?.value?.trim();
    if (qrVal) parseQrAndSetSlot(qrVal);
  });

  // Quét QR bằng camera
  document.getElementById("scanQrBtn")?.addEventListener("click", openQrScanner);
  document.getElementById("closeQrScanBtn")?.addEventListener("click", closeQrScanner);

  document.getElementById("startCameraBtn")?.addEventListener("click", startCamera);
  document.getElementById("submitAttendanceBtn")?.addEventListener("click", submitAttendance);
}

let qrScanner = null;

async function openQrScanner() {
  const modal = document.getElementById("qrScanModal");
  const readerEl = document.getElementById("qrReader");
  if (!modal || !readerEl) return;
  try {
    if (typeof Html5Qrcode !== "undefined") {
      readerEl.innerHTML = "";
      qrScanner = new Html5Qrcode("qrReader");
      await qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          parseQrAndSetSlot(decodedText);
          closeQrScanner();
        },
        () => {}
      );
      modal.classList.remove("hidden");
    } else {
      showToast("Thư viện quét QR chưa tải. Thử nhập thủ công.", "info");
    }
  } catch (e) {
    showToast("Không thể mở camera: " + e.message, "error");
  }
}

function closeQrScanner() {
  if (qrScanner && qrScanner.isScanning) {
    qrScanner.stop().catch(() => {});
  }
  qrScanner = null;
  document.getElementById("qrScanModal")?.classList?.add("hidden");
}

/**
 * Parse QR content: format "classId_slotId"
 */
function parseQrAndSetSlot(qrContent) {
  const parts = qrContent.split("_");
  if (parts.length >= 2) {
    currentClassId = parts[0];
    currentSlotId = parts[1];
    showToast(`Đã quét QR: Lớp ${currentClassId}, Slot ${currentSlotId}`, "success");
  }
}

/**
 * Bắt đầu camera
 */
async function startCamera() {
  try {
    await loadFaceApiModels();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.play();
    }
    document.getElementById("cameraSection")?.classList?.remove("hidden");
  } catch (e) {
    showToast("Không thể mở camera: " + e.message, "error");
  }
}

/**
 * Gửi điểm danh
 */
async function submitAttendance() {
  const mssv = (document.getElementById("mssvInput")?.value || "").trim();
  if (!mssv) {
    showToast("Vui lòng nhập MSSV", "error");
    return;
  }
  if (!currentClassId || !currentSlotId) {
    showToast("Vui lòng quét QR trước", "error");
    return;
  }

  try {
    // 1. Kiểm tra slot còn mở không
    const slotRef = ref(db, `slots/${currentClassId}/${currentSlotId}`);
    const slotSnap = await get(slotRef);
    if (!slotSnap.exists()) {
      showToast("Slot điểm danh không tồn tại hoặc đã đóng", "error");
      return;
    }
    const slot = slotSnap.val();
    const endTime = slot.endTime || 0;
    if (Date.now() > endTime) {
      showToast("Slot điểm danh đã hết hạn", "error");
      return;
    }

    // 2. Kiểm tra GPS
    const pos = await getCurrentPosition();
    const teacherLoc = slot.teacherLocation || {};
    const dist = getDistanceMeters(
      pos.lat,
      pos.lng,
      teacherLoc.lat || 0,
      teacherLoc.lng || 0
    );
    const radius = slot.radius || SLOT_RADIUS;
    if (dist > radius) {
      showToast(`Bạn ở quá xa (${Math.round(dist)}m, cho phép ${radius}m)`, "error");
      return;
    }

    // 3. Kiểm tra MSSV trong students
    const studentsRef = ref(db, `students/${currentClassId}`);
    const studentsSnap = await get(studentsRef);
    if (!studentsSnap.exists()) {
      showToast("MSSV không tồn tại trong lớp", "error");
      return;
    }
    const students = studentsSnap.val();
    const studentEntry = Object.entries(students).find(([_, s]) => s.studentCode === mssv);
    if (!studentEntry) {
      showToast("MSSV không tồn tại trong lớp", "error");
      return;
    }
    const [studentId, student] = studentEntry;
    const storedEmbedding = student.faceEmbedding;

    // 4. So sánh face
    drawVideoToCanvas(videoEl, canvasEl);
    const liveDescriptor = await getFaceDescriptor(canvasEl);
    if (!liveDescriptor) {
      showToast("Không phát hiện khuôn mặt. Vui lòng đặt mặt rõ trong khung.", "error");
      return;
    }

    let faceScore = 0;
    if (Array.isArray(storedEmbedding) && storedEmbedding.length === 128) {
      const { match, faceScore: fs } = isFaceMatch(liveDescriptor, storedEmbedding);
      faceScore = fs;
      if (!match) {
        document.getElementById("attendanceResult").innerHTML = `
          <div class="card">
            <p>Face không khớp (điểm: ${(fs * 100).toFixed(1)}%).</p>
            <button id="requestFaceUpdateBtn">Gửi yêu cầu cập nhật khuôn mặt</button>
          </div>
        `;
        document.getElementById("requestFaceUpdateBtn")?.addEventListener("click", () =>
          requestFaceUpdate(studentId, liveDescriptor)
        );
        return;
      }
    }

    // 5. Lưu điểm danh
    const attRef = ref(db, `attendance/${currentClassId}/${currentSlotId}/${studentId}`);
    await set(attRef, {
      timestamp: Date.now(),
      distance: Math.round(dist),
      faceScore,
    });

    showToast("Điểm danh thành công!", "success");
    document.getElementById("attendanceResult").innerHTML = `
      <div class="card">
        <h2 style="color:#22c55e">✓ Điểm danh thành công!</h2>
      </div>
    `;
  } catch (e) {
    showToast(e.message || "Có lỗi xảy ra", "error");
  }
}

/**
 * Gửi yêu cầu cập nhật khuôn mặt
 */
async function requestFaceUpdate(studentId, newEmbedding) {
  if (!studentId || !newEmbedding) return;
  try {
    const reqRef = ref(db, `faceUpdateRequests/${currentClassId}/${studentId}`);
    await set(reqRef, {
      newEmbedding,
      status: "pending",
    });
    showToast("Đã gửi yêu cầu cập nhật. Giáo viên sẽ duyệt.", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}
