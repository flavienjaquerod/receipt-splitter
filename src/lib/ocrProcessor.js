import { franc } from 'franc';

const DEFAULT_OCR_OPTIONS = {
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
    this.translationCache = new Map();
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
      };
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        rawText: '',
        lines: [],
        success: false,
        error: error.message,
      };
    } finally {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    }
  }

  async processAndTranslate(file, onProgress = null) {
    const result = await this.processImage(file, onProgress);
    if (!result.success) return result;

    const translatedLines = await Promise.all(
      result.lines.map(async (line) => {
        const { translated, detectedLang } = await this.translateLine(line.text);
        return {
          ...line,
          translatedText: translated,
          detectedLanguage: detectedLang,
        };
      })
    );

    return {
      ...result,
      lines: translatedLines,
    };
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

  async translateLine(text) {
    const normalizedText = (text || '').trim();
    if (!normalizedText) {
      return { translated: '', detectedLang: 'unknown' };
    }

    const cacheKey = normalizedText.toLowerCase();
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey);
    }

    const detectedLang = this.detectLanguage(normalizedText);
    const sourceLang = detectedLang === 'unknown' ? 'de' : detectedLang;

    if (sourceLang === 'en') {
      const passthrough = { translated: normalizedText, detectedLang: sourceLang };
      this.translationCache.set(cacheKey, passthrough);
      return passthrough;
    }

    const translators = [this.translateWithMyMemory, this.translateWithLibreTranslate];

    for (const translator of translators) {
      try {
        const translated = await translator.call(this, normalizedText, sourceLang, 'en');
        const payload = { translated, detectedLang: sourceLang };
        this.translationCache.set(cacheKey, payload);
        return payload;
      } catch (error) {
        console.warn('Translation provider failed:', error.message);
      }
    }

    const fallback = { translated: normalizedText, detectedLang: sourceLang };
    this.translationCache.set(cacheKey, fallback);
    return fallback;
  }

  async translateWithMyMemory(text, source = 'de', target = 'en') {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`MyMemory HTTP ${response.status}`);
    }

    const data = await response.json();
    const translated = data?.responseData?.translatedText?.trim();

    if (!translated) {
      throw new Error('MyMemory returned empty translation');
    }

    return translated;
  }

  async translateWithLibreTranslate(text, source = 'auto', target = 'en') {
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text',
      }),
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate HTTP ${response.status}`);
    }

    const data = await response.json();
    const translated = data?.translatedText?.trim();

    if (!translated) {
      throw new Error('LibreTranslate returned empty translation');
    }

    return translated;
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