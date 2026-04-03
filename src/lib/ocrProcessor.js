import { franc } from 'franc';

const DEFAULT_OCR_OPTIONS = {
  provider: 'paddle',
  paddleEndpoint: '/api/ocr/paddle',
  paddleModelLanguage: 'latin',
  fallbackToTesseract: true,
  languages: 'eng+deu+fra+ita',
  confidenceThreshold: 25,
  preprocessImage: true,
};

const ISO3_TO_ISO2 = {
  deu: 'de',
  eng: 'en',
  fra: 'fr',
  ita: 'it',
  spa: 'es',
  por: 'pt',
  nld: 'nl',
};

// OCR Processing utility
export class OCRProcessor {
  constructor(options = {}) {
    this.worker = null;
    this.workerLanguages = null;
    this.options = { ...DEFAULT_OCR_OPTIONS, ...options };
  }

  async initialize(onProgress = null, languages = this.options.languages) {
    if (this.worker && this.workerLanguages === languages) return;

    if (this.worker && this.workerLanguages !== languages) {
      await this.cleanup();
    }

    try {
      // Dynamic import to reduce initial bundle size
      const { createWorker } = await import('tesseract.js');

      this.worker = await createWorker(languages, 1, {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            onProgress(progress);
          }
        },
      });

      this.workerLanguages = languages;
      console.log('OCR Worker initialized with languages:', languages);
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  async processImage(file, onProgress = null) {
    let paddleError = null;

    if (this.options.provider === 'paddle' || this.options.provider === 'auto') {
      try {
        return await this.processImageWithPaddle(file, onProgress);
      } catch (error) {
        paddleError = error;
        console.warn('Paddle OCR unavailable, fallback strategy engaged:', error.message);
        if (!this.options.fallbackToTesseract) {
          return {
            rawText: '',
            lines: [],
            success: false,
            error: error.message,
          };
        }
      }
    }

    return this.processImageWithTesseract(file, onProgress, paddleError);
  }

  async processImageWithPaddle(file, onProgress = null) {
    if (onProgress) onProgress(10);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('modelLang', this.options.paddleModelLanguage);

    const response = await fetch(this.options.paddleEndpoint, {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || payload?.details || `Paddle OCR request failed (${response.status})`);
    }

    const lines = this.normalizePaddleLines(payload.lines || []);
    const rawText = payload.rawText || lines.map((line) => line.text).join('\n');
    const detectedLanguage = payload.detectedLanguage || this.detectLanguage(rawText);

    if (onProgress) onProgress(100);

    return {
      rawText,
      lines,
      success: true,
      detectedLanguage,
      receiptItems: Array.isArray(payload.receiptItems) ? payload.receiptItems : [],
      meta: payload.meta || {},
      engine: 'paddleocr',
    };
  }

  normalizePaddleLines(lines) {
    if (!Array.isArray(lines)) return [];

    return lines
      .filter((line) => line && typeof line.text === 'string' && line.text.trim())
      .map((line, index) => ({
        id: line.id ?? index,
        text: line.text.trim(),
        confidence: Math.round(Number(line.confidence || 0)),
        bbox: line.bbox || null,
      }))
      .filter((line) => line.confidence >= this.options.confidenceThreshold);
  }

  async processImageWithTesseract(file, onProgress = null, paddleError = null) {
    if (!this.worker) {
      await this.initialize(onProgress);
    }

    let imageUrl = null;

    try {
      imageUrl = this.options.preprocessImage
        ? await this.preprocessImage(file)
        : URL.createObjectURL(file);
    } catch (error) {
      console.warn('Image preprocessing failed, continuing with raw image:', error);
      imageUrl = URL.createObjectURL(file);
    }

    try {
      const result = await this.worker.recognize(imageUrl);

      // Extract text and lines safely
      const text = result.data?.text || '';
      const lines = result.data?.lines || [];
      const confidence = result.data?.confidence || 75;

      let processedLines = [];
      if (lines.length > 0) {
        processedLines = this.processLines(lines);
      } else if (text.trim()) {
        // Fallback: split text into lines if no line data available
        processedLines = this.createLinesFromText(text, confidence);
      }

      return {
        rawText: text,
        lines: processedLines,
        success: true,
        detectedLanguage: this.detectLanguage(text),
        engine: 'tesseract',
      };
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        rawText: '',
        lines: [],
        success: false,
        error: paddleError
          ? `Paddle failed: ${paddleError.message}. Tesseract failed: ${error.message}`
          : error.message,
      };
    } finally {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    }
  }

  async processAndTranslate(file, onProgress = null) {
    // Kept for backward compatibility with existing callers.
    return this.processImage(file, onProgress);
  }

  async preprocessImage(file) {
    const bitmap = await createImageBitmap(file);
    const maxWidth = 2200;
    const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Canvas context unavailable for preprocessing');
    }

    // Grayscale + increased contrast works well for printed thermal receipts.
    ctx.filter = 'grayscale(100%) contrast(165%) brightness(112%)';
    ctx.drawImage(bitmap, 0, 0, width, height);
    ctx.filter = 'none';

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    let total = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      total += pixels[i];
    }

    const avgLuminance = total / (pixels.length / 4);
    const threshold = Math.max(105, Math.min(185, Math.round(avgLuminance)));

    for (let i = 0; i < pixels.length; i += 4) {
      const v = pixels[i] > threshold ? 255 : 0;
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (imageBlob) => {
          if (!imageBlob) {
            reject(new Error('Failed to create preprocessed image blob'));
            return;
          }
          resolve(imageBlob);
        },
        'image/png',
        1
      );
    });

    return URL.createObjectURL(blob);
  }

  processLines(lines) {
    if (!Array.isArray(lines)) {
      return [];
    }

    return lines
      .filter((line) => line && line.text && line.text.trim().length > 0)
      .map((line, index) => ({
        id: index,
        text: line.text.trim(),
        confidence: Math.round(line.confidence || 0),
        bbox: line.bbox,
      }))
      .filter((line) => line.confidence >= this.options.confidenceThreshold);
  }

  // Fallback method to create lines from raw text
  createLinesFromText(text, overallConfidence = 75) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, index) => ({
        id: index,
        text: line,
        confidence: overallConfidence,
        bbox: null,
      }));
  }

  detectLanguage(text) {
    const normalized = (text || '').trim();
    if (!normalized || normalized.length < 5) {
      return 'unknown';
    }

    const iso3 = franc(normalized, { minLength: 5 });
    if (!iso3 || iso3 === 'und') {
      return 'unknown';
    }

    return ISO3_TO_ISO2[iso3] || 'unknown';
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.workerLanguages = null;
    }
  }
}

// Create a singleton instance
export const ocrProcessor = new OCRProcessor();