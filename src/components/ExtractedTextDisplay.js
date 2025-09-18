import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Calculator, Edit2, Check, X, FileText, Eye, EyeOff } from 'lucide-react';
import { exportReceiptPdf } from '../lib/exportPdf';
import { COLOR_PAIRS } from '../lib/colors';
import { useDarkMode } from '../contexts/darkModeContext';

export default function ExtractedTextDisplay({ lines, isLoading, progress, showTranslated }) {
  const { isDarkMode } = useDarkMode();
  const [roommates, setRoommates] = useState([
    { id: 1, name: "Person 1", ...COLOR_PAIRS[0] },
    { id: 2, name: "Person 2", ...COLOR_PAIRS[3] }
  ]);
  const [items, setItems] = useState([]);
  const [newRoommateName, setNewRoommateName] = useState('');
  const [isAddingRoommate, setIsAddingRoommate] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [whoPaid, setwhoPaid] = useState(1);
  const [editingRoommate, setEditingRoommate] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [ticketTotals, setTicketTotals] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [hiddenSources, setHiddenSources] = useState(new Set());
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Get unique source files
  const sourceFiles = [...new Set(lines.map(line => line.sourceFile).filter(Boolean))];

  // Parse OCR lines into items when lines change
  useEffect(() => {
    if (!lines || lines.length === 0) return;

    const parsedItems = [];
    let detectedTotals = {};

    // Group lines by source file
    const linesBySource = lines.reduce((acc, line) => {
      const source = line.sourceFile || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(line);
      return acc;
    }, {});

    // Process each source file separately
    Object.entries(linesBySource).forEach(([sourceFile, sourceLines]) => {
      sourceLines.forEach((line, index) => {
        const text = showTranslated && line.translatedText ? line.translatedText : line.text;

        // detect "Total CHF X" and skip it
        const totalMatch = text.match(/total\s*CHF\s*([\d.,]+)/i);
        if (totalMatch) {
          detectedTotals[sourceFile] = parseFloat(totalMatch[1].replace(",", "."));
          return;
        }

        // skip other non items lines
        if (/total/i.test(text) || /sparen/i.test(text) || /rundung/i.test(text) || /artikelbezeichnung/i.test(text) || /rounding/i.test(text)) {
          return;
        }

        // parse regular items
        const pricePattern = /(\d+[.,]\d+)/g;
        const prices = text.match(pricePattern);
        if (prices && prices.length > 0) {
          const totalPrice = parseFloat(prices[prices.length - 1].replace(",", "."));
          const firstPriceIndex = text.search(/\d+[.,]\d+/);
          let itemName = text.substring(0, firstPriceIndex).trim();
          itemName = itemName.replace(/\s*\|\s*$/, "").trim();

          if (itemName && !isNaN(totalPrice)) {
            parsedItems.push({
              id: `${sourceFile}-${index}`,
              name: itemName,
              originalPrice: totalPrice,
              currentPrice: totalPrice,
              assignedTo: [],
              confidence: line.confidence,
              sourceFile: sourceFile,
              sourceIndex: line.sourceIndex || 0
            });
          }
        }
      });
    });

    setItems(parsedItems);
    setTicketTotals(detectedTotals);
  }, [lines, showTranslated]);

  // updates roommates when added, pay all items by default
  useEffect(() => {
    setItems(items.map(item => {
      return {
        ...item,
        assignedTo: roommates.map(r => r.id)
      };
    }));
  }, [roommates]);

  // updates error message based on ticket price compared to ocr result
  useEffect(() => {
    if (Object.keys(ticketTotals).length > 0 && items.length > 0) {
      const errors = [];
      
      Object.entries(ticketTotals).forEach(([sourceFile, ticketTotal]) => {
        const sourceItems = items.filter(item => item.sourceFile === sourceFile);
        const sumItems = sourceItems.reduce((sum, item) => sum + item.currentPrice, 0);
        
        if (Math.abs(sumItems - ticketTotal) > 0.05) {
          errors.push(`${sourceFile}: items sum to CHF ${sumItems.toFixed(2)}, but ticket total is CHF ${ticketTotal.toFixed(2)}`);
        }
      });
      
      if (errors.length > 0) {
        setErrorMessage(`⚠️ OCR mismatches: ${errors.join(' | ')}`);
      } else {
        setErrorMessage("");
      }
    }
  }, [items, ticketTotals]);

  const addRoommate = () => {
    if (newRoommateName.trim()) {
      const color = COLOR_PAIRS[roommates.length % COLOR_PAIRS.length];
      const newRoommate = {
        id: Date.now(),
        name: newRoommateName.trim(),
        ...color
      };
      setRoommates([...roommates, newRoommate]);
      setNewRoommateName("");
      setIsAddingRoommate(false);
    }
  };


  const updateRoommateName = (id, newName) => {
    if (newName.trim()) {
      setRoommates(roommates.map(roommate => 
        roommate.id === id ? { ...roommate, name: newName.trim() } : roommate
      ));
    }
    setEditingRoommate(null);
    setEditingName('');
  };

  const removeRoommate = (id) => {
    if (roommates.length <= 2) return;
    setRoommates(roommates.filter(r => r.id !== id));
    // Remove assignments for this roommate
    setItems(items.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(rid => rid !== id)
    })));
  };

  const addItem = () => {
    if (!newItemName.trim() || isNaN(parseFloat(newItemPrice))) return;

    const newItem = {
      id: Date.now(),
      name: newItemName.trim(),
      originalPrice: parseFloat(newItemPrice),
      currentPrice: parseFloat(newItemPrice),
      assignedTo: roommates.map(r => r.id), // default: all roommates
      confidence: 100,
      sourceFile: "Manual entry",
    };

    setItems([...items, newItem]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const toggleAssignment = (itemId, roommateId) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const isAssigned = item.assignedTo.includes(roommateId);
        const newAssignedTo = isAssigned 
          ? item.assignedTo.filter(id => id !== roommateId)
          : [...item.assignedTo, roommateId];
        
        return { ...item, assignedTo: newAssignedTo };
      }
      return item;
    }));
  };

  const updateItemPrice = (itemId, newPrice) => {
    const price = parseFloat(newPrice);
    if (!isNaN(price)) {
      setItems(items.map(item => 
        item.id === itemId ? { ...item, currentPrice: price } : item
      ));
    }
    setEditingItem(null);
    setEditPrice('');
  };

  const toggleAllAssignments = (itemId) => {
    const item = items.find(i => i.id === itemId);
    const allAssigned = roommates.every(r => item.assignedTo.includes(r.id));
    
    setItems(items.map(i => 
      i.id === itemId 
        ? { ...i, assignedTo: allAssigned ? [] : roommates.map(r => r.id) }
        : i
    ));
  };

  const toggleSourceVisibility = (sourceFile) => {
    const newHidden = new Set(hiddenSources);
    if (newHidden.has(sourceFile)) {
      newHidden.delete(sourceFile);
    } else {
      newHidden.add(sourceFile);
    }
    setHiddenSources(newHidden);
  };

  const calculateBalances = () => {
    // initialize balances
    const balances = {};
    roommates.forEach(roommate => {
      balances[roommate.id] = { paid: 0, share: 0, owesTo: null };
    });

    // compute each person's share (include payer too)
    items.forEach(item => {
      if (!item.assignedTo || item.assignedTo.length === 0) return;
      const sharePerPerson = item.currentPrice / item.assignedTo.length;

      item.assignedTo.forEach(rid => {
        if (!balances[rid]) return; // defensive: skip stale ids
        balances[rid].share += sharePerPerson;
        // point debtors to the payer (single-payer model)
        if (String(rid) !== String(whoPaid)) {
          balances[rid].owesTo = whoPaid;
        }
      });
    });

    // mark whoPaid as having paid the full receipt (you can adapt for multi-payer)
    const totalAmount = items.reduce((s, it) => s + (it.currentPrice || 0), 0);
    if (whoPaid && balances[whoPaid]) {
      balances[whoPaid].paid = totalAmount;
    }

    return balances;
  };

  const balances = calculateBalances();

  function handleExport() {
    const doc = exportReceiptPdf(items, roommates, balances, "My Grocery Receipt");

    // Save as PDF
    doc.save("receipt-summary.pdf");

    // Also try Web Share API for mobile
    if (navigator.share) {
      doc.output("blob").then(blob => {
        const file = new File([blob], "receipt-summary.pdf", { type: "application/pdf" });
        navigator.share({
          title: "Receipt Splitter",
          text: "Here’s our split summary!",
          files: [file],
        }).catch(err => console.log("Share cancelled", err));
      });
    }
  }

  // Get visible items (not from hidden sources)
  const visibleItems = items.filter(item => !hiddenSources.has(item.sourceFile));

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Extracting Text...</h3>
          <span className="text-sm text-blue-500">{progress}%</span>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Reading your receipts...</span>
        </div>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 transition-all duration-700 ease-in-out">
      {/* Source Files Filter */}
      {sourceFiles.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Receipt Sources</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sourceFiles.map((sourceFile, index) => {
              const sourceItems = items.filter(item => item.sourceFile === sourceFile);
              const sourceTotal = sourceItems.reduce((sum, item) => sum + item.currentPrice, 0);
              const isHidden = hiddenSources.has(sourceFile);
              
              return (
                <div key={sourceFile} className={`p-3 rounded-lg border transition-all ${isHidden ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600' : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate flex-1">
                      {sourceFile}
                    </span>
                    <button
                      onClick={() => toggleSourceVisibility(sourceFile)}
                      className={`ml-2 p-1 rounded transition-colors ${isHidden ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300' : 'text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'}`}
                    >
                      {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {sourceItems.length} items • CHF {sourceTotal.toFixed(2)}
                    {ticketTotals[sourceFile] && (
                      <span className={`ml-2 ${Math.abs(sourceTotal - ticketTotals[sourceFile]) > 0.05 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        (Receipt: CHF {ticketTotals[sourceFile].toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {sourceFiles.some(sf => hiddenSources.has(sf)) && (
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Hidden sources are excluded from splitting calculations
            </div>
          )}
        </div>
      )}

      {/* Roommate Management */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Roommates</h3>
          </div>
          <button
            onClick={() => setIsAddingRoommate(true)}
            className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {roommates.map((roommate) => (
            <div key={roommate.id} className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0" 
                style={{ backgroundColor: isDarkMode ? roommate.dark : roommate.light }}
              ></div>
              {editingRoommate === roommate.id ? (
                <div className="flex items-center space-x-1 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                    onKeyPress={(e) => e.key === 'Enter' && updateRoommateName(roommate.id, editingName)}
                    autoFocus
                  />
                  <button
                    onClick={() => updateRoommateName(roommate.id, editingName)}
                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 flex-shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingRoommate(null);
                      setEditingName('');
                    }}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-gray-800 dark:text-white flex-1 truncate">{roommate.name}</span>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {whoPaid === roommate.id && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-full whitespace-nowrap">
                        Paid
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditingRoommate(roommate.id);
                        setEditingName(roommate.name);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {roommates.length > 2 && (
                      <button
                        onClick={() => removeRoommate(roommate.id)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
          {isAddingRoommate ? (
            <div className="flex items-center space-x-2 w-full sm:flex-1">
              <input
                type="text"
                value={newRoommateName}
                onChange={(e) => setNewRoommateName(e.target.value)}
                placeholder="Roommate name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addRoommate()}
              />
              <button
                onClick={addRoommate}
                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsAddingRoommate(false);
                  setNewRoommateName('');
                }}
                className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
              Who paid?
            </div>
            <select
              value={whoPaid}
              onChange={(e) => setwhoPaid(parseInt(e.target.value))}
              className="flex-1 sm:flex-initial px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {roommates.map((roommate) => (
                <option key={roommate.id} value={roommate.id}>
                  {roommate.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Items - Responsive Layout */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Add Item Form */}
        <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0">
            <input
              type="text"
              placeholder="Item name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addItem}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              + Add Item
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Receipt Items</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {visibleItems.length} items from {sourceFiles.filter(sf => !hiddenSources.has(sf)).length} receipt{sourceFiles.filter(sf => !hiddenSources.has(sf)).length !== 1 ? 's' : ''}
              </p>
            </div>
            {sourceFiles.length > 1 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {hiddenSources.size > 0 && `${hiddenSources.size} source${hiddenSources.size !== 1 ? 's' : ''} hidden`}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Split</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {visibleItems.map((item) => (
                <tr key={item.id} className="dark:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Confidence: {item.confidence}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-32">{item.sourceFile}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingItem === item.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyPress={(e) => e.key === 'Enter' && updateItemPrice(item.id, editPrice)}
                        />
                        <button
                          onClick={() => updateItemPrice(item.id, editPrice)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(null);
                            setEditPrice('');
                          }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">CHF {item.currentPrice.toFixed(2)}</span>
                        <button
                          onClick={() => {
                            setEditingItem(item.id);
                            setEditPrice(item.currentPrice.toString());
                          }}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {roommates.map(roommate => (
                        <span
                          key={roommate.id}
                          className={`px-2 py-1 text-xs rounded-full ${
                            item.assignedTo.includes(roommate.id)
                              ? 'text-white'
                              : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700'
                          }`}
                          style={{
                            backgroundColor: item.assignedTo.includes(roommate.id) ? (isDarkMode ? roommate.dark : roommate.light) : undefined
                          }}
                        >
                          {roommate.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {roommates.map(roommate => (
                        <button
                          key={roommate.id}
                          onClick={() => toggleAssignment(item.id, roommate.id)}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            item.assignedTo.includes(roommate.id)
                              ? 'text-white border-transparent'
                              : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                          }`}
                          style={{
                            backgroundColor: item.assignedTo.includes(roommate.id) ? (isDarkMode ? roommate.dark : roommate.light) : undefined
                          }}
                        >
                          {roommate.name}
                        </button>
                      ))}
                      <button
                        onClick={() => toggleAllAssignments(item.id)}
                        className="px-3 py-1 text-xs rounded-full border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        All
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile/Tablet Card View */}
        <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-600">
          {visibleItems.map((item) => (
            <div key={item.id} className="p-4 space-y-3">
              {/* Item Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm leading-tight pr-2">
                    {item.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.sourceFile} • Confidence: {item.confidence}%
                  </p>
                </div>
                
                {/* Price Section */}
                <div className="flex-shrink-0">
                  {editingItem === item.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && updateItemPrice(item.id, editPrice)}
                      />
                      <button
                        onClick={() => updateItemPrice(item.id, editPrice)}
                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingItem(null);
                          setEditPrice('');
                        }}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        CHF {item.currentPrice.toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingItem(item.id);
                          setEditPrice(item.currentPrice.toString());
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Split between:
                  </span>
                  <button
                    onClick={() => toggleAllAssignments(item.id)}
                    className="px-2 py-1 text-xs rounded-full border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    Toggle All
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {roommates.map(roommate => (
                    <button
                      key={roommate.id}
                      onClick={() => toggleAssignment(item.id, roommate.id)}
                      className={`px-3 py-2 text-xs rounded-full border transition-all min-h-[32px] ${
                        item.assignedTo.includes(roommate.id)
                          ? 'text-white border-transparent shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                      }`}
                      style={{
                        backgroundColor: item.assignedTo.includes(roommate.id) ? (isDarkMode ? roommate.dark : roommate.light) : undefined
                      }}
                    >
                      {roommate.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Per Person */}
              {item.assignedTo.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      Cost per person:
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      CHF {(item.currentPrice / item.assignedTo.length).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Split {item.assignedTo.length} way{item.assignedTo.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end mb-6">
        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg shadow-md hover:from-blue-600 hover:to-purple-700 transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Export & Share
        </button>
      </div>

      {/* Balance Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-4">
          <Calculator className="w-5 h-5 text-green-500 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Balance Summary</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            (from {sourceFiles.filter(sf => !hiddenSources.has(sf)).length} receipt{sourceFiles.filter(sf => !hiddenSources.has(sf)).length !== 1 ? 's' : ''})
          </span>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {roommates.map((roommate) => {
            const balance = balances[roommate.id] || { paid: 0, share: 0, owesTo: null };
            const net = (balance.paid || 0) - (balance.share || 0);

            return (
              <div key={roommate.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: isDarkMode ? roommate.dark : roommate.light }} />
                  <span className="font-medium text-gray-900 dark:text-white">{roommate.name}</span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="text-gray-700 dark:text-gray-300">Paid: <span className="font-medium">CHF {(balance.paid || 0).toFixed(2)}</span></div>

                  <div className="text-gray-700 dark:text-gray-300">
                    Contribution: <span className="font-medium">CHF {(balance.share || 0).toFixed(2)}</span>
                    {balance.owesTo && balance.share > 0 && String(roommate.id) !== String(whoPaid) && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">to <strong style={{ color: roommates.find(r => String(r.id) === String(balance.owesTo))?.color }}>{roommates.find(r => String(r.id) === String(balance.owesTo))?.name || 'Unknown'}</strong></span>
                    )}
                  </div>

                  <div className={`font-semibold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {net > 0 ? 'To receive:' : net < 0 ? 'To pay:' : 'Settled:'}{' '}
                    CHF {Math.abs(net).toFixed(2)}
                  </div>

                  {String(roommate.id) === String(whoPaid) && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Owed by:
                      <ul className="ml-4">
                        {Object.entries(balances)
                          .filter(([id, b]) => b.owesTo && String(b.owesTo) === String(roommate.id))
                          .map(([id, b]) => (
                            <li key={id}>
                              {roommates.find(r => String(r.id) === String(id))?.name || 'Unknown'}: CHF {b.share.toFixed(2)}
                            </li>
                          ))
                        }
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Total Combined Receipts:</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              CHF {visibleItems.reduce((sum, item) => sum + item.currentPrice, 0).toFixed(2)}
            </span>
          </div>
          {Object.keys(ticketTotals).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(ticketTotals)
                .filter(([sourceFile]) => !hiddenSources.has(sourceFile))
                .map(([sourceFile, total]) => (
                  <div key={sourceFile} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                    <span className="truncate max-w-xs">{sourceFile}:</span>
                    <span>CHF {total.toFixed(2)}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}