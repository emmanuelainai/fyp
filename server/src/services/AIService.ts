import { env } from "../config/env";

export class AIService {
  static isEnabled() {
    return env.ENABLE_AI_SERVICE;
  }

  static async analyzeFrame(_frameUrl: string) {
    if (!env.ENABLE_AI_SERVICE) {
      return {
        enabled: false,
        message: "AI service is disabled. Rule-based monitoring remains active."
      };
    }

    return {
      enabled: true,
      serviceUrl: env.AI_SERVICE_URL,
      message: "AI service integration placeholder. Add FastAPI/MediaPipe implementation here."
    };
  }
}
