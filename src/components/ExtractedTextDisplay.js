import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Calculator, Edit2, Check, X } from 'lucide-react';

export default function ExtractedTextDisplay({ lines, isLoading, progress }) {
  const [roommates, setRoommates] = useState([
    { id: 1, name: 'Person 1', color: '#3B82F6' },
    { id: 2, name: 'Person 2', color: '#EF4444' }
  ]);
  const [items, setItems] = useState([]);
  const [newRoommateName, setNewRoommateName] = useState('');
  const [isAddingRoommate, setIsAddingRoommate] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [whoOwes, setWhoOwes] = useState(1);
  const [editingRoommate, setEditingRoommate] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(true);

  // Parse OCR lines into items when lines change
  useEffect(() => {
    if (!lines || lines.length === 0) return;

    const parseItems = () => {
      const parsedItems = [];
      
      // Skip header line and footer lines (total, savings, etc.)
      const itemLines = lines.filter((line, index) => {
        const text = line.text.toLowerCase();
        return index > 0 && 
               !text.includes('total') && 
               !text.includes('sparen') && 
               !text.includes('rundung') && 
               !text.includes('artikelbezeichnung') &&
               text.length > 5;
      });

      itemLines.forEach((line, index) => {
        // Parse lines like "Alnatura Mais Chips Na | 1.95 1.95 1"
        const text = line.text;
        const parts = text.split(/\s+/);
        
        // Look for price patterns (numbers with . or ,)
        const pricePattern = /(\d+[.,]\d+)/g;
        const prices = text.match(pricePattern);
        
        if (prices && prices.length > 0) {
          // Take the last price as the total price
          const totalPrice = parseFloat(prices[prices.length - 1].replace(',', '.'));
          
          // Extract item name (everything before the first price)
          const firstPriceIndex = text.search(/\d+[.,]\d+/);
          let itemName = text.substring(0, firstPriceIndex).trim();
          
          // Clean up item name
          itemName = itemName.replace(/\s*\|\s*$/, '').trim();
          
          if (itemName && !isNaN(totalPrice)) {
            parsedItems.push({
              id: index,
              name: itemName,
              originalPrice: totalPrice,
              currentPrice: totalPrice,
              assignedTo: [], // Array of roommate IDs
              confidence: line.confidence
            });
          }
        }
      });

      setItems(parsedItems);
    };

    parseItems();
  }, [lines]);

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

  const calculateBalances = () => {
    const balances = {};
    roommates.forEach(roommate => {
      balances[roommate.id] = { paid: 0, owes: 0 };
    });

    items.forEach(item => {
      if (item.assignedTo.length > 0) {
        const pricePerPerson = item.currentPrice / item.assignedTo.length;
        item.assignedTo.forEach(roommateId => {
          balances[roommateId].owes += pricePerPerson;
        });
      }
    });

    // Assuming the first roommate paid for everything
    const totalAmount = items.reduce((sum, item) => sum + item.currentPrice, 0);
    if (roommates.length > 0) {
      balances[roommates[0].id].paid = totalAmount;
    }

    return balances;
  };

  const balances = calculateBalances();

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
          <span className="ml-3 text-gray-600">Reading your receipt...</span>
        </div>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Roommate Management */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
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
            <span>Add</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {roommates.map((roommate) => (
            <div key={roommate.id} className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: roommate.color }}
              ></div>
              {editingRoommate === roommate.id ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && updateRoommateName(roommate.id, editingName)}
                    autoFocus
                  />
                  <button
                    onClick={() => updateRoommateName(roommate.id, editingName)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingRoommate(null);
                      setEditingName('');
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-gray-800">{roommate.name}</span>
                  {whoOwes === roommate.id && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
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
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center">
          {isAddingRoommate ? (
            <div className="flex items-center space-x-2">
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
          
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600">
              Who paid?
            </div>
            <select
              value={whoOwes}
              onChange={(e) => setWhoOwes(parseInt(e.target.value))}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Items Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Receipt Items</h3>
          <p className="text-sm text-gray-600">{items.length} items found</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Split</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-500">Confidence: {item.confidence}%</div>
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
                        onClick={() => {
                          const allAssigned = roommates.every(r => item.assignedTo.includes(r.id));
                          if (allAssigned) {
                            setItems(items.map(i => i.id === item.id ? { ...i, assignedTo: [] } : i));
                          } else {
                            setItems(items.map(i => i.id === item.id ? { ...i, assignedTo: roommates.map(r => r.id) } : i));
                          }
                        }}
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
      </div>

      {/* Balance Summary */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center space-x-2 mb-4">
          <Calculator className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900">Balance Summary</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {roommates.map((roommate) => {
            const balance = balances[roommate.id];
            const netBalance = balance.paid - balance.owes;
            
            return (
              <div key={roommate.id} className="p-4 border rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: roommate.color }}
                  ></div>
                  <span className="font-medium text-gray-900">{roommate.name}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>Paid: <span className="font-medium">CHF {balance.paid.toFixed(2)}</span></div>
                  <div>Owes: <span className="font-medium">CHF {balance.owes.toFixed(2)}</span></div>
                  <div className={`font-semibold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netBalance >= 0 ? 'To receive' : 'To pay'}: CHF {Math.abs(netBalance).toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Receipt:</span>
            <span className="text-lg font-bold text-gray-900">
              CHF {items.reduce((sum, item) => sum + item.currentPrice, 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}