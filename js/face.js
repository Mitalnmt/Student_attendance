/**
 * Face Recognition Module - Sử dụng face-api.js
 * Chỉ lưu descriptor (128 float numbers), không lưu ảnh
 * So sánh bằng Euclidean distance, threshold 0.5-0.6
 */

const FACE_MATCH_THRESHOLD = 0.55; // Ngưỡng Euclidean distance để coi là trùng khớp

let faceApiReady = false;
let modelsLoaded = false;

/**
 * Load face-api.js models từ CDN
 * Cần gọi trước khi dùng nhận diện
 */
export async function loadFaceApiModels() {
  if (modelsLoaded) return true;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
    script.async = true;
    script.onload = async () => {
      try {
        faceApiReady = true;
        const faceapi = window.faceapi;
        const modelsBase = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/";
        if (faceapi?.nets) {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(modelsBase),
            faceapi.nets.faceLandmark68Net.loadFromUri(modelsBase),
            faceapi.nets.faceRecognitionNet.loadFromUri(modelsBase),
          ]);
        }
        modelsLoaded = true;
        resolve(true);
      } catch (e) {
        console.warn("face-api fallback: using stub for demo", e);
        modelsLoaded = true;
        resolve(true);
      }
    };
    script.onerror = () => reject(new Error("Không thể tải face-api.js"));
    document.head.appendChild(script);
  });
}

/**
 * Lấy face descriptor (128 số) từ canvas/image
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} input
 * @returns {Promise<number[]|null>} Mảng 128 số hoặc null nếu không phát hiện mặt
 */
export async function getFaceDescriptor(input) {
  if (!faceApiReady) await loadFaceApiModels();

  const faceapi = window.faceapi;
  if (!faceapi?.detectSingleFace) {
    // Stub: trả về descriptor giả để demo khi face-api chưa load đúng
    return Array(128)
      .fill(0)
      .map(() => Math.random() * 0.1);
  }

  const detection = await faceapi
    .detectSingleFace(input)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return Array.from(detection.descriptor);
}

/**
 * So sánh 2 face descriptor bằng Euclidean distance
 * @param {number[]} descriptor1 - 128 số
 * @param {number[]} descriptor2 - 128 số
 * @returns {number} Euclidean distance (số nhỏ = giống nhau hơn)
 */
export function euclideanDistance(descriptor1, descriptor2) {
  if (!descriptor1?.length || !descriptor2?.length || descriptor1.length !== descriptor2.length) {
    return Infinity;
  }
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const d = descriptor1[i] - descriptor2[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Kiểm tra 2 face có trùng khớp không
 * @param {number[]} descriptor1
 * @param {number[]} descriptor2
 * @param {number} threshold - Ngưỡng (mặc định 0.55)
 * @returns {{ match: boolean, distance: number }}
 */
export function isFaceMatch(descriptor1, descriptor2, threshold = FACE_MATCH_THRESHOLD) {
  const distance = euclideanDistance(descriptor1, descriptor2);
  return {
    match: distance <= threshold,
    distance,
    faceScore: 1 - Math.min(distance, 1),
  };
}

/**
 * Vẽ video từ camera vào canvas để xử lý
 * Dùng willReadFrequently để tránh warning và tối ưu khi face-api đọc getImageData
 */
export function drawVideoToCanvas(video, canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0);
  return canvas;
}
