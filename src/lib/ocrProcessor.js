// OCR Processing utility
export class OCRProcessor {
  constructor() {
    this.worker = null;
  }

  async initialize(onProgress = null) {
    if (this.worker) return;

    try {
      // Dynamic import to reduce initial bundle size
      const { createWorker } = await import('tesseract.js');
      
      this.worker = await createWorker('eng+deu', 1, {
        logger: (m) => {
          console.log('Tesseract log:', m);
          if (onProgress && m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            onProgress(progress);
          }
        }
      });
      
      console.log('OCR Worker initialized');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  async processImage(file, onProgress = null) {
    if (!this.worker) {
      await this.initialize(onProgress);
    }

    try {
      // Create object URL for the file
      const imageUrl = URL.createObjectURL(file);
      
      // Process the image
      console.log('Starting recognition...');
      const result = await this.worker.recognize(imageUrl);
      console.log('Raw OCR result:', result);
      
      // Clean up the object URL
      URL.revokeObjectURL(imageUrl);
      
      // Extract text and lines safely
      const text = result.data?.text || '';
      const lines = result.data?.lines || [];
      const confidence = result.data?.confidence || 75;
      
      console.log('Extracted text length:', text.length);
      console.log('Lines found:', lines.length);
      console.log("Confidence = ", confidence)
      
      // If no lines but we have text, create lines from text
      let processedLines = [];
      if (lines.length > 0) {
        processedLines = this.processLines(lines, confidence);
      } else if (text.trim()) {
        // Fallback: split text into lines if no line data available
        processedLines = this.createLinesFromText(text, confidence);
      }
      
      return {
        rawText: text,
        lines: processedLines,
        success: true
      };
      
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        rawText: '',
        lines: [],
        success: false,
        error: error.message
      };
    }
  }

  async processAndTranslate(file, onProgress = null) {
    const result = await this.processImage(file, onProgress);
    if (!result.success) return result;

    const translatedLines = await Promise.all(
      result.lines.map(async (line) => {
        const { translated, detectedLang } = await this.translateLine(line.text);
        console.log("Result of translation = ", translated);
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
    }
  }

  processLines(lines) {
    if (!Array.isArray(lines)) {
      console.warn('Lines is not an array:', lines);
      return [];
    }

    return lines
      .filter(line => line && line.text && line.text.trim().length > 0) // Remove empty lines
      .map((line, index) => ({
        id: index,
        text: line.text.trim(),
        // Use actual confidence from Tesseract (0-100 scale)
        confidence: Math.round(line.confidence || 0),
        bbox: line.bbox // Bounding box coordinates if needed later
      }))
      .filter(line => line.confidence > 30); // Filter out low-confidence text
  }

  // Fallback method to create lines from raw text
  createLinesFromText(text, overallConfidence = 75) {
    console.log('Using fallback createLinesFromText with confidence:', overallConfidence);
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, index) => ({
        id: index,
        text: line,
        confidence: overallConfidence, // Use overall confidence when splitting from text
        bbox: null
      }));
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  async translateLine(text) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=de|en`;
      const response = await fetch(url);
      const data = await response.json();

      const translated = data?.responseData?.translatedText || text;
      const detectedLang = data?.responseData?.match || "unknown";

      return { translated, detectedLang };
    } catch (err) {
      console.error("Translation error:", err);
      return { translated: text, detectedLang: "unknown" };
    }
  }

}

// Create a singleton instance
export const ocrProcessor = new OCRProcessor();