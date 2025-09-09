export default function ExtractedTextDisplay({ lines, isLoading, progress }) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Extracting Text...</h3>
          <span className="text-sm text-blue-500">{progress}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Loading animation */}
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Reading your receipt...</span>
        </div>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Extracted Text</h3>
        <span className="text-sm text-green-500">{lines.length} lines found</span>
      </div>
      
      {/* Text Lines */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {lines.map((line) => (
          <div 
            key={line.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="font-mono text-sm text-gray-800 flex-1">
              {line.text}
            </span>
            <div className="flex items-center space-x-2 ml-4">
              {/* Confidence indicator */}
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                line.confidence >= 80 
                  ? 'bg-green-100 text-green-700'
                  : line.confidence >= 60 
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {line.confidence}%
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Copy button */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            const text = lines.map(line => line.text).join('\n');
            navigator.clipboard.writeText(text);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Copy All Text
        </button>
      </div>
    </div>
  );
}