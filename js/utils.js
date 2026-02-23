/**
 * Utility functions for Student Attendance System
 */

/**
 * Hiển thị thông báo cho người dùng
 * @param {string} message - Nội dung thông báo
 * @param {string} type - 'success' | 'error' | 'info'
 */
export function showToast(message, type = "info") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    padding: "12px 24px",
    borderRadius: "8px",
    color: "#fff",
    zIndex: "9999",
    fontSize: "14px",
    maxWidth: "90%",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  });

  const colors = {
    success: "#22c55e",
    error: "#ef4444",
    info: "#3b82f6",
  };
  toast.style.backgroundColor = colors[type] || colors.info;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/**
 * Lấy hoặc tạo schoolId từ schoolName
 * @param {object} db - Firebase database instance
 * @param {function} ref - Firebase ref
 * @param {function} get - Firebase get
 * @param {function} push - Firebase push
 * @param {function} set - Firebase set
 * @param {string} schoolName
 * @returns {Promise<string>} schoolId
 */
export async function getOrCreateSchoolId(db, ref, get, push, set, schoolName) {
  const schoolsRef = ref(db, "schools");
  const snapshot = await get(schoolsRef);

  if (snapshot.exists()) {
    const schools = snapshot.val();
    const found = Object.entries(schools).find(
      ([_, s]) => s.name?.toLowerCase() === schoolName.toLowerCase()
    );
    if (found) return found[0];
  }

  const newSchoolRef = push(ref(db, "schools"));
  await set(newSchoolRef, { name: schoolName.trim() });
  return newSchoolRef.key;
}

/**
 * Lấy danh sách trường học
 */
export async function getSchools(db, ref, get) {
  const snapshot = await get(ref(db, "schools"));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([id, s]) => ({ id, ...s }));
}

/**
 * Lấy danh sách lớp theo schoolId
 */
export async function getClassesBySchool(db, ref, get, schoolId) {
  const snapshot = await get(ref(db, "classes"));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val())
    .filter(([_, c]) => c.schoolId === schoolId)
    .map(([id, c]) => ({ id, ...c }));
}

/**
 * Tính khoảng cách Haversine giữa 2 điểm GPS (đơn vị: mét)
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Bán kính Trái Đất (mét)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Lấy vị trí GPS từ trình duyệt
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ Geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err)
    );
  });
}

/**
 * Tạo ID đơn giản
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
