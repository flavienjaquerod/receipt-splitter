'use client'

import { useState } from 'react'
import { ocrProcessor } from '../lib/ocrProcessor'
import ExtractedTextDisplay from '../components/ExtractedTextDisplay'

export default function Home() {
  const [uploadStatus, setUploadStatus] = useState(null)
  const [files, setFiles] = useState([])
  const [extractedLines, setExtractedLines] = useState([])
  const [ocrProgress, setOcrProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFiles = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles)
    setFiles(fileArray)
    setUploadStatus('uploading')

    // Just show upload complete, don't auto-process
    setTimeout(() => {
      setUploadStatus('complete')
    }, 1000)
  }

  const processWithOCR = async () => {
    const firstImageFile = files.find(file => file.type.startsWith('image/'))
    
    if (!firstImageFile) {
      alert('Please upload an image file first!')
      return
    }

    setIsProcessing(true)
    setOcrProgress(0)
    setUploadStatus('processing')
    setExtractedLines([]) // Clear previous results

    try {
      console.log('Starting OCR processing...')
      const result = await ocrProcessor.processImage(
        firstImageFile, 
        (progress) => {
          console.log('OCR Progress:', progress)
          setOcrProgress(progress)
        }
      )

      console.log('OCR Result:', result)

      if (result.success) {
        setExtractedLines(result.lines)
        setUploadStatus('ocr_complete')
        console.log('OCR completed successfully, extracted', result.lines.length, 'lines')
      } else {
        setUploadStatus('error')
        console.error('OCR failed:', result.error)
        alert('OCR processing failed: ' + result.error)
      }
    } catch (error) {
      setUploadStatus('error')
      console.error('Processing failed:', error)
      alert('Processing failed: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFiles = e.dataTransfer.files
    handleFiles(droppedFiles)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleFileInput = (e) => {
    handleFiles(e.target.files)
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* Header */}
      <header className="animate-fade-in">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Receipt Splitter
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              v1.0 - OCR Enabled
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-slide-up">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Split Your{' '}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Receipts
            </span>
            <br />Effortlessly
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Upload your grocery receipt and we'll help you split the costs with your roommate. 
            Simple, fast, and fair.
          </p>
        </div>

        {/* Upload Section */}
        <div className="animate-slide-up" style={{animationDelay: '0.2s'}}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 border border-gray-100">
            {/* Upload Area */}
            <div 
              className="border-3 border-dashed border-gray-300 rounded-2xl p-12 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer group"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-input').click()}
            >
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                    Drop your receipt here
                  </h3>
                  <p className="text-gray-500 text-lg">
                    or <span className="text-blue-500 font-medium">click to browse</span>
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    PNG, JPG, PDF up to 10MB
                  </p>
                </div>
              </div>
              <input 
                type="file" 
                id="file-input" 
                className="hidden" 
                accept="image/*,.pdf" 
                multiple 
                onChange={handleFileInput}
              />
            </div>

            {/* Upload Status */}
            {uploadStatus && (
              <div className="mt-6">
                {uploadStatus === 'uploading' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-blue-800">
                          Upload successful! Preparing OCR...
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {uploadStatus === 'processing' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-yellow-800">
                          Processing receipt with OCR... {ocrProgress}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {uploadStatus === 'complete' && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-800">
                            Upload successful! Ready to process with OCR.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={processWithOCR}
                        className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Extract Text
                      </button>
                    </div>
                  </div>
                )}
                {uploadStatus === 'ocr_complete' && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-800">
                          OCR processing complete! {extractedLines.length} lines extracted.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {uploadStatus === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-red-800">
                          Processing failed. Please try with a clearer image.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* File Preview */}
            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Extracted Text Display */}
        {(isProcessing || extractedLines.length > 0) && (
          <div className="mt-8">
            <ExtractedTextDisplay 
              lines={extractedLines}
              isLoading={isProcessing}
              progress={ocrProgress}
            />
          </div>
        )}

        {/* Features Preview */}
        <div className="mt-16 animate-slide-up" style={{animationDelay: '0.4s'}}>
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Coming Soon</h3>
            <p className="text-gray-600">Features we're working on to make splitting even easier</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-white/50 border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Smart OCR</h4>
              <p className="text-sm text-gray-600">Automatically extract items and prices from your receipt</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-white/50 border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Translation</h4>
              <p className="text-sm text-gray-600">Translate German receipts to English automatically</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-white/50 border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">AI Splitting</h4>
              <p className="text-sm text-gray-600">Smart suggestions based on your shopping patterns</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 text-center text-gray-500">
        <p>&copy; 2024 Receipt Splitter. Made for roommates who hate math.</p>
      </footer>
    </div>
  )
}