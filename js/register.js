/**
 * Student Registration - Logic cho trang register.html
 * Lưu vào pendingStudents, giáo viên duyệt trước khi dùng
 */

import { db, ref, get, set } from "./firebase-config.js";
import { showToast, getSchools, getClassesBySchool } from "./utils.js";
import { getFaceDescriptor, drawVideoToCanvas, loadFaceApiModels } from "./face.js";

let videoEl, canvasEl;
let currentSchoolId = null;
let currentClassId = null;

export async function initRegisterPage() {
  const schoolSelect = document.getElementById("schoolSelect");
  const classSelect = document.getElementById("classSelect");
  videoEl = document.getElementById("videoEl");
  canvasEl = document.getElementById("faceCanvas");

  // Load trường
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

  document.getElementById("startCameraBtn")?.addEventListener("click", startCamera);
  document.getElementById("captureBtn")?.addEventListener("click", captureAndRegister);
}

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

async function captureAndRegister() {
  const studentCode = (document.getElementById("studentCode")?.value || "").trim();
  const studentName = (document.getElementById("studentName")?.value || "").trim();

  if (!studentCode || !studentName) {
    showToast("Vui lòng nhập MSSV và tên", "error");
    return;
  }
  if (!currentClassId) {
    showToast("Vui lòng chọn lớp", "error");
    return;
  }
  if (!videoEl?.srcObject || !canvasEl) {
    showToast("Vui lòng mở camera trước (bấm Mở camera)", "error");
    return;
  }

  const btn = document.getElementById("captureBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Đang xử lý...";
  }

  try {
    if (videoEl.readyState < 2) {
      await new Promise((r) => {
        if (videoEl.readyState >= 2) return r();
        videoEl.onloadeddata = r;
        setTimeout(r, 3000);
      });
    }
    const faceEmbedding = await getFaceDescriptor(videoEl);
    if (!faceEmbedding || faceEmbedding.length !== 128) {
      showToast("Không phát hiện khuôn mặt. Đặt mặt thẳng, đủ sáng, gần camera.", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Chụp & Đăng ký"; }
      return;
    }

    // Kiểm tra MSSV đã tồn tại trong students hoặc pending chưa
    const studentsRef = ref(db, `students/${currentClassId}`);
    const pendingRef = ref(db, `pendingStudents/${currentClassId}`);
    const [studentsSnap, pendingSnap] = await Promise.all([get(studentsRef), get(pendingRef)]);

    const students = studentsSnap.exists() ? studentsSnap.val() : {};
    const pending = pendingSnap.exists() ? pendingSnap.val() : {};
    const existsInStudents = Object.values(students).some((s) => s.studentCode === studentCode);
    const existsInPending = Object.values(pending).some((s) => s.studentCode === studentCode);

    if (existsInStudents || existsInPending) {
      showToast("MSSV đã tồn tại trong lớp", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Chụp & Đăng ký"; }
      return;
    }

    // Tạo studentId (dùng MSSV hoặc random)
    const studentId = "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const pendingStudentRef = ref(db, `pendingStudents/${currentClassId}/${studentId}`);
    await set(pendingStudentRef, {
      name: studentName,
      studentCode,
      faceEmbedding,
      status: "pending",
    });

    document.getElementById("registerResult").innerHTML = `
      <div class="card">
        <h2 style="color:#22c55e">✓ Đăng ký thành công!</h2>
        <p>Đang chờ giáo viên duyệt. Bạn sẽ được thông báo khi duyệt xong.</p>
      </div>
    `;
    if (btn) { btn.disabled = false; btn.textContent = "Chụp & Đăng ký"; }
  } catch (e) {
    const msg = e.message || "Có lỗi xảy ra";
    showToast(msg, "error");
    document.getElementById("registerResult").innerHTML =
      '<p style="color:red">Lỗi: ' + msg + '</p>';
    console.error("Lỗi đăng ký:", e);
    if (btn) { btn.disabled = false; btn.textContent = "Chụp & Đăng ký"; }
  }
}
