import {
  FaceDetector as MediaPipeFaceDetector,
  FilesetResolver,
  type Detection,
  type FaceDetector as MediaPipeFaceDetectorInstance
} from "@mediapipe/tasks-vision";

type NativeFaceDetectorResult = {
  boundingBox: DOMRectReadOnly;
};

type NativeFaceDetectorInstance = {
  detect: (source: CanvasImageSource) => Promise<NativeFaceDetectorResult[]>;
};

type NativeFaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetectorInstance;

export type FaceAnalysisStatus = "present" | "missing" | "multiple" | "poor_lighting" | "waiting" | "detector_unavailable";

export type FaceAnalysis = {
  status: FaceAnalysisStatus;
  faceCount: number;
  detector: "mediapipe" | "native" | "quality";
  detail: string;
  averageLuminance?: number;
  contrast?: number;
  confidence?: number;
};

type DetectorBackend = {
  kind: "mediapipe" | "native";
  detect: (video: HTMLVideoElement) => Promise<{ count: number; confidence?: number }>;
};

let detectorPromise: Promise<DetectorBackend | null> | null = null;

const getFrameQuality = (video: HTMLVideoElement) => {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 120;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { averageLuminance: 0, contrast: 0 };

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let luminanceSum = 0;
  let luminanceSquaredSum = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const y = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    luminanceSum += y;
    luminanceSquaredSum += y * y;
  }

  const pixelCount = pixels.length / 4;
  const averageLuminance = luminanceSum / pixelCount;
  const variance = luminanceSquaredSum / pixelCount - averageLuminance * averageLuminance;
  return { averageLuminance, contrast: Math.sqrt(Math.max(variance, 0)) };
};

const isUsableMediaPipeDetection = (detection: Detection, video: HTMLVideoElement) => {
  const box = detection.boundingBox;
  const confidence = detection.categories[0]?.score ?? 0;
  if (!box || confidence < 0.62) return false;

  const videoWidth = video.videoWidth || video.clientWidth || 1;
  const videoHeight = video.videoHeight || video.clientHeight || 1;
  const boxAreaRatio = (box.width * box.height) / (videoWidth * videoHeight);
  return box.width >= videoWidth * 0.08 && box.height >= videoHeight * 0.08 && boxAreaRatio >= 0.01;
};

const isUsableNativeDetection = (face: NativeFaceDetectorResult, video: HTMLVideoElement) => {
  const videoWidth = video.videoWidth || video.clientWidth || 1;
  const videoHeight = video.videoHeight || video.clientHeight || 1;
  const boxAreaRatio = (face.boundingBox.width * face.boundingBox.height) / (videoWidth * videoHeight);
  return face.boundingBox.width >= videoWidth * 0.08 && face.boundingBox.height >= videoHeight * 0.08 && boxAreaRatio >= 0.01;
};

const createMediaPipeDetector = async (): Promise<DetectorBackend> => {
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const detector: MediaPipeFaceDetectorInstance = await MediaPipeFaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/mediapipe/models/blaze_face_short_range.tflite",
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.62,
    minSuppressionThreshold: 0.3
  });

  return {
    kind: "mediapipe",
    detect: async (video) => {
      const detections = detector.detectForVideo(video, performance.now()).detections.filter((detection) => isUsableMediaPipeDetection(detection, video));
      return {
        count: detections.length,
        confidence: detections.reduce((max, detection) => Math.max(max, detection.categories[0]?.score ?? 0), 0)
      };
    }
  };
};

const createNativeDetector = (): DetectorBackend | null => {
  const NativeFaceDetector = (window as Window & { FaceDetector?: NativeFaceDetectorConstructor }).FaceDetector;
  if (!NativeFaceDetector) return null;
  const detector = new NativeFaceDetector({ fastMode: false, maxDetectedFaces: 5 });

  return {
    kind: "native",
    detect: async (video) => {
      const faces = (await detector.detect(video)).filter((face) => isUsableNativeDetection(face, video));
      return { count: faces.length };
    }
  };
};

export const getFaceDetector = async () => {
  detectorPromise ??= createMediaPipeDetector().catch(() => createNativeDetector());
  return detectorPromise;
};

export const resetFaceDetector = () => {
  detectorPromise = null;
};

export const analyzeFaceFrame = async (video: HTMLVideoElement): Promise<FaceAnalysis> => {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return { status: "waiting", faceCount: 0, detector: "quality", detail: "Waiting for the camera frame" };
  }

  const quality = getFrameQuality(video);
  if (quality.averageLuminance < 35 || quality.contrast < 10) {
    return {
      status: "poor_lighting",
      faceCount: 0,
      detector: "quality",
      detail: "The camera frame is too dark or unclear",
      ...quality
    };
  }

  const detector = await getFaceDetector();
  if (!detector) {
    return {
      status: "detector_unavailable",
      faceCount: 0,
      detector: "quality",
      detail: "Face detector could not start in this browser",
      ...quality
    };
  }

  const result = await detector.detect(video);
  if (result.count > 1) {
    return {
      status: "multiple",
      faceCount: result.count,
      detector: detector.kind,
      detail: `${result.count} faces detected`,
      confidence: result.confidence,
      ...quality
    };
  }
  if (result.count === 1) {
    return {
      status: "present",
      faceCount: 1,
      detector: detector.kind,
      detail: "One face detected",
      confidence: result.confidence,
      ...quality
    };
  }

  return {
    status: "missing",
    faceCount: 0,
    detector: detector.kind,
    detail: "No face detected",
    confidence: result.confidence,
    ...quality
  };
};

export const faceAnalysisLabel = (analysis: FaceAnalysis) => {
  switch (analysis.status) {
    case "present":
      return "Face present";
    case "multiple":
      return "Multiple faces";
    case "poor_lighting":
      return "Poor lighting";
    case "missing":
      return "Face missing";
    case "detector_unavailable":
      return "Detector unavailable";
    default:
      return "Checking camera";
  }
};

export const faceAnalysisStartError = (analysis: FaceAnalysis) => {
  if (analysis.status === "present") return "";
  if (analysis.status === "multiple") return "Only one student may be visible before the exam starts.";
  if (analysis.status === "poor_lighting") return "Your face must be clearly visible before starting. Move to a brighter area and try again.";
  if (analysis.status === "detector_unavailable") return "Face detection could not start. Use a modern Chrome or Edge browser and try again.";
  return "Your face must be detected before the exam can start.";
};
