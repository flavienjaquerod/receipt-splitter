import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Calculator, Edit2, Check, X, FileText, Eye, EyeOff } from 'lucide-react';

export default function ExtractedTextDisplay({ lines, isLoading, progress, showTranslated }) {
  const [roommates, setRoommates] = useState([
    { id: 1, name: 'Person 1', color: '#3B82F6' },
    { id: 2, name: 'Person 2', color: '#EF4444' }
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
      const colors = ['#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
      const newRoommate = {
        id: Date.now(),
        name: newRoommateName.trim(),
        color: colors[roommates.length % colors.length]
      };
      setRoommates([...roommates, newRoommate]);
      setNewRoommateName('');
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

  // Get visible items (not from hidden sources)
  const visibleItems = items.filter(item => !hiddenSources.has(item.sourceFile));

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Extracting Text...</h3>
          <span className="text-sm text-blue-500">{progress}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Reading your receipts...</span>
        </div>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Source Files Filter */}
      {sourceFiles.length > 1 && (
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-900">Receipt Sources</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sourceFiles.map((sourceFile, index) => {
              const sourceItems = items.filter(item => item.sourceFile === sourceFile);
              const sourceTotal = sourceItems.reduce((sum, item) => sum + item.currentPrice, 0);
              const isHidden = hiddenSources.has(sourceFile);
              
              return (
                <div key={sourceFile} className={`p-3 rounded-lg border transition-all ${isHidden ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm truncate flex-1">
                      {sourceFile}
                    </span>
                    <button
                      onClick={() => toggleSourceVisibility(sourceFile)}
                      className={`ml-2 p-1 rounded transition-colors ${isHidden ? 'text-gray-400 hover:text-gray-600' : 'text-blue-500 hover:text-blue-700'}`}
                    >
                      {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-xs text-gray-600">
                    {sourceItems.length} items • CHF {sourceTotal.toFixed(2)}
                    {ticketTotals[sourceFile] && (
                      <span className={`ml-2 ${Math.abs(sourceTotal - ticketTotals[sourceFile]) > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                        (Receipt: CHF {ticketTotals[sourceFile].toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {sourceFiles.some(sf => hiddenSources.has(sf)) && (
            <div className="mt-3 text-xs text-gray-500">
              Hidden sources are excluded from splitting calculations
            </div>
          )}
        </div>
      )}

      {/* Roommate Management */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Roommates</h3>
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
            <div key={roommate.id} className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0" 
                style={{ backgroundColor: roommate.color }}
              ></div>
              {editingRoommate === roommate.id ? (
                <div className="flex items-center space-x-1 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                    onKeyPress={(e) => e.key === 'Enter' && updateRoommateName(roommate.id, editingName)}
                    autoFocus
                  />
                  <button
                    onClick={() => updateRoommateName(roommate.id, editingName)}
                    className="text-green-600 hover:text-green-800 flex-shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingRoommate(null);
                      setEditingName('');
                    }}
                    className="text-red-600 hover:text-red-800 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-gray-800 flex-1 truncate">{roommate.name}</span>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {whoPaid === roommate.id && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">
                        Paid
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditingRoommate(roommate.id);
                        setEditingName(roommate.name);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {roommates.length > 2 && (
                      <button
                        onClick={() => removeRoommate(roommate.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="text-sm text-gray-600 whitespace-nowrap">
              Who paid?
            </div>
            <select
              value={whoPaid}
              onChange={(e) => setwhoPaid(parseInt(e.target.value))}
              className="flex-1 sm:flex-initial px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Receipt Items</h3>
              <p className="text-sm text-gray-600">
                {visibleItems.length} items from {sourceFiles.filter(sf => !hiddenSources.has(sf)).length} receipt{sourceFiles.filter(sf => !hiddenSources.has(sf)).length !== 1 ? 's' : ''}
              </p>
            </div>
            {sourceFiles.length > 1 && (
              <div className="text-xs text-gray-500">
                {hiddenSources.size > 0 && `${hiddenSources.size} source${hiddenSources.size !== 1 ? 's' : ''} hidden`}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Split</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-500">Confidence: {item.confidence}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-600 truncate max-w-32">{item.sourceFile}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingItem === item.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyPress={(e) => e.key === 'Enter' && updateItemPrice(item.id, editPrice)}
                        />
                        <button
                          onClick={() => updateItemPrice(item.id, editPrice)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(null);
                            setEditPrice('');
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">CHF {item.currentPrice.toFixed(2)}</span>
                        <button
                          onClick={() => {
                            setEditingItem(item.id);
                            setEditPrice(item.currentPrice.toString());
                          }}
                          className="text-gray-400 hover:text-gray-600"
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
                              : 'text-gray-600 bg-gray-100'
                          }`}
                          style={{
                            backgroundColor: item.assignedTo.includes(roommate.id) ? roommate.color : undefined
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
                              : 'text-gray-600 border-gray-300 hover:border-gray-400'
                          }`}
                          style={{
                            backgroundColor: item.assignedTo.includes(roommate.id) ? roommate.color : undefined
                          }}
                        >
                          {roommate.name}
                        </button>
                      ))}
                      <button
                        onClick={() => toggleAllAssignments(item.id)}
                        className="px-3 py-1 text-xs rounded-full border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
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
        <div className="lg:hidden divide-y divide-gray-100">
          {visibleItems.map((item) => (
            <div key={item.id} className="p-4 space-y-3">
              {/* Item Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 text-sm leading-tight pr-2">
                    {item.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
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
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && updateItemPrice(item.id, editPrice)}
                      />
                      <button
                        onClick={() => updateItemPrice(item.id, editPrice)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingItem(null);
                          setEditPrice('');
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                        CHF {item.currentPrice.toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingItem(item.id);
                          setEditPrice(item.currentPrice.toString());
                        }}
                        className="text-gray-400 hover:text-gray-600"
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
                  <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Split between:
                  </span>
                  <button
                    onClick={() => toggleAllAssignments(item.id)}
                    className="px-2 py-1 text-xs rounded-full border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
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
                          : 'text-gray-600 border-gray-300 hover:border-gray-400 bg-white'
                      }`}
                      style={{
                        backgroundColor: item.assignedTo.includes(roommate.id) ? roommate.color : undefined
                      }}
                    >
                      {roommate.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Per Person */}
              {item.assignedTo.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">
                      Cost per person:
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      CHF {(item.currentPrice / item.assignedTo.length).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Split {item.assignedTo.length} way{item.assignedTo.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Balance Summary */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
        <div className="flex items-center space-x-2 mb-4">
          <Calculator className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900">Balance Summary</h3>
          <span className="text-sm text-gray-500">
            (from {sourceFiles.filter(sf => !hiddenSources.has(sf)).length} receipt{sourceFiles.filter(sf => !hiddenSources.has(sf)).length !== 1 ? 's' : ''})
          </span>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {roommates.map((roommate) => {
            const balance = balances[roommate.id] || { paid: 0, share: 0, owesTo: null };
            const net = (balance.paid || 0) - (balance.share || 0);

            return (
              <div key={roommate.id} className="p-4 border rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: roommate.color }} />
                  <span className="font-medium text-gray-900">{roommate.name}</span>
                </div>

                <div className="space-y-1 text-sm">
                  <div>Paid: <span className="font-medium">CHF {(balance.paid || 0).toFixed(2)}</span></div>

                  {/* show contribution (their fair share) */}
                  <div>
                    Contribution: <span className="font-medium">CHF {(balance.share || 0).toFixed(2)}</span>
                    {balance.owesTo && balance.share > 0 && String(roommate.id) !== String(whoPaid) && (
                      <span className="ml-2 text-xs text-gray-500">to <strong style={{ color: roommates.find(r => String(r.id) === String(balance.owesTo))?.color }}>{roommates.find(r => String(r.id) === String(balance.owesTo))?.name || 'Unknown'}</strong></span>
                    )}
                  </div>

                  {/* net */}
                  <div className={`font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {net > 0 ? 'To receive:' : net < 0 ? 'To pay:' : 'Settled:'}{' '}
                    CHF {Math.abs(net).toFixed(2)}
                  </div>

                  {/* optionally show list of people who owe this roommate (for payer) */}
                  {String(roommate.id) === String(whoPaid) && (
                    <div className="mt-2 text-xs text-gray-500">
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

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Combined Receipts:</span>
            <span className="text-lg font-bold text-gray-900">
              CHF {visibleItems.reduce((sum, item) => sum + item.currentPrice, 0).toFixed(2)}
            </span>
          </div>
          {Object.keys(ticketTotals).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(ticketTotals)
                .filter(([sourceFile]) => !hiddenSources.has(sourceFile))
                .map(([sourceFile, total]) => (
                  <div key={sourceFile} className="flex justify-between text-sm text-gray-600">
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