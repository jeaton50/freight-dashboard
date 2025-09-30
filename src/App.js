import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import './App.css';

// ============================================
// CONFIGURATION: Edit these lists as needed
// ============================================
const COMPANIES = [
  'COWBOYS', 'CRANE', 'FLORIDA FREIGHT', 'KOL', 'PHOENIX FREIGHT',
  'NEVILLE', 'SPI', 'TAZ', 'UP&GO', 'YOPO', 'Logistify',
  'ALG', 'PC EXPRESS', 'EXOTIC RETAILERS', 'ON Spot (neville)',
];

const AGENTS = [
  'D.MERCRIT', 'P.VANDENBRINK', 'A.SURFA', 'J.HOLLAND',
  'C.SNIPES', 'A.STELLUTO', 'R.VANDENBRINK', 'S.GRAVES',
  'B.DELLACROCE', 'M.KAIGLER',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function App() {
  const [selectedMonth, setSelectedMonth] = useState('January');
  const [shipments, setShipments] = useState([]);
  const [companies] = useState(COMPANIES);
  const [agents] = useState(AGENTS);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const inputRef = useRef(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);

  // ============================================
  // REAL-TIME LISTENER FOR SHIPMENTS
  // ============================================
  useEffect(() => {
    const monthDoc = doc(db, 'freight-data', selectedMonth);
    const unsubscribe = onSnapshot(monthDoc, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setShipments(docSnapshot.data().shipments || []);
      } else {
        setShipments([]);
      }
    });
    return () => unsubscribe();
  }, [selectedMonth]);

  // ============================================
  // SAVE TO FIREBASE
  // ============================================
  const saveToFirebase = async (updatedShipments) => {
    try {
      setIsSaving(true);
      const monthDoc = doc(db, 'freight-data', selectedMonth);
      await setDoc(monthDoc, {
        shipments: updatedShipments,
        lastModified: new Date().toISOString(),
        month: selectedMonth,
      });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      alert('Failed to save. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // ============================================
  // SUMMARY FUNCTIONS
  // ============================================
  const getCompanySummary = () => {
    const summary = {};
    shipments.forEach((shipment) => {
      if (!summary[shipment.company]) {
        summary[shipment.company] = { count: 0, total: 0 };
      }
      summary[shipment.company].count += 1;
      summary[shipment.company].total += shipment.shippingCharge;
    });
    return Object.entries(summary)
      .map(([company, data]) => ({
        company,
        count: data.count,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  };

  const companySummary = getCompanySummary();
  const totalCost = shipments.reduce((sum, s) => sum + s.shippingCharge, 0);
  const maxCount = Math.max(...companySummary.map((c) => c.count), 1);

  // ============================================
  // HANDLERS
  // ============================================
  const handleMonthChange = (newMonth) => setSelectedMonth(newMonth);

  const handleCellClick = (rowIndex, field) => {
    const value = shipments[rowIndex][field];
    setEditingCell({ rowIndex, field });
    setEditValue(value || '');

    if (field === 'company') {
      setFilteredOptions(companies);
      setShowDropdown(true);
    } else if (field === 'agent') {
      setFilteredOptions(agents);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleCellChange = (e) => {
    const value = e.target.value;
    setEditValue(value);

    if (editingCell && (editingCell.field === 'company' || editingCell.field === 'agent')) {
      const options = editingCell.field === 'company' ? companies : agents;
      const filtered = options.filter((option) =>
        option.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
      setShowDropdown(filtered.length > 0);
    }
  };

  const handleSelectOption = (option) => {
    setEditValue(option);
    setShowDropdown(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleCellBlur = () => {
    setTimeout(() => {
      if (editingCell) {
        const { rowIndex, field } = editingCell;
        const newShipments = [...shipments];

        if (field === 'shippingCharge') {
          const numValue = parseFloat(editValue);
          newShipments[rowIndex][field] = isNaN(numValue) ? 0 : numValue;
        } else {
          newShipments[rowIndex][field] = editValue;
        }

        saveToFirebase(newShipments);
        setEditingCell(null);
        setEditValue('');
        setShowDropdown(false);
      }
    }, 200);
  };

  const handleKeyDown = (e, rowIndex, field) => {
    const fields = [
      'refNum', 'shipDate', 'returnDate', 'location', 'returnLocation',
      'company', 'shipMethod', 'shippingCharge', 'po', 'agent',
    ];
    const currentIndex = fields.indexOf(field);

    if (e.key === 'Enter') {
      if (showDropdown && filteredOptions.length > 0) {
        handleSelectOption(filteredOptions[0]);
      }
      handleCellBlur();
      if (rowIndex < shipments.length - 1) {
        setTimeout(() => handleCellClick(rowIndex + 1, field), 250);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellBlur();
      if (currentIndex < fields.length - 1) {
        setTimeout(() => handleCellClick(rowIndex, fields[currentIndex + 1]), 250);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
      setShowDropdown(false);
    }
  };

  const handleAddRow = () => {
    const newShipment = {
      id: Date.now(),
      refNum: '', shipDate: '', returnDate: '', location: '', returnLocation: '',
      company: '', shipMethod: '', shippingCharge: 0, po: '', agent: '',
    };
    const updatedShipments = [...shipments, newShipment];
    saveToFirebase(updatedShipments);
    setTimeout(() => handleCellClick(shipments.length, 'refNum'), 100);
  };

  const handleDeleteRow = (index) => {
    if (window.confirm('Delete this shipment?')) {
      const updatedShipments = shipments.filter((_, i) => i !== index);
      saveToFirebase(updatedShipments);
    }
  };

  const exportData = async () => {
    const allData = {};
    for (const month of MONTHS) {
      const monthDoc = doc(db, 'freight-data', month);
      const docSnap = await getDoc(monthDoc);
      if (docSnap.exists()) {
        allData[month] = docSnap.data().shipments;
      }
    }
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freight-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const clearMonthData = () => {
    if (window.confirm(`Clear all data for ${selectedMonth}? This cannot be undone.`)) {
      saveToFirebase([]);
    }
  };

  // ============================================
  // RENDER CELL
  // ============================================
  const renderCell = (rowIndex, field, value) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === field;
    const isNumeric = field === 'shippingCharge';
    const hasAutocomplete = field === 'company' || field === 'agent';

    if (isEditing) {
      return (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type={isNumeric ? 'number' : field.includes('Date') ? 'date' : 'text'}
            value={editValue}
            onChange={handleCellChange}
            onBlur={handleCellBlur}
            onKeyDown={(e) => handleKeyDown(e, rowIndex, field)}
            style={{
              width: '100%',
              padding: '4px 8px',
              border: '2px solid #3b82f6',
              outline: 'none',
              fontSize: '12px',
            }}
            step={isNumeric ? '0.01' : undefined}
            autoComplete="off"
          />
          {hasAutocomplete && showDropdown && filteredOptions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                zIndex: 50,
                width: '100%',
                marginTop: '4px',
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {filteredOptions.map((option, idx) => (
                <div
                  key={idx}
                  onMouseDown={() => handleSelectOption(option)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.target.style.background = '#dbeafe')}
                  onMouseLeave={(e) => (e.target.style.background = 'white')}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        onClick={() => handleCellClick(rowIndex, field)}
        style={{
          width: '100%',
          padding: '4px 8px',
          cursor: 'cell',
          fontSize: '12px',
        }}
        onMouseEnter={(e) => (e.target.style.background = '#eff6ff')}
        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
      >
        {isNumeric && value ? `$${value.toFixed(2)}` : value || ''}
      </div>
    );
  };

  // ============================================
  // COLORS FOR CHARTS
  // ============================================
  const chartColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#f97316', '#14b8a6', '#f43f5e',
  ];

  // ============================================
  // RETURN JSX
  // ============================================
  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* ... UI CONTENT (summary cards, charts, table, etc.) ... */}

      <div
        style={{
          padding: '16px',
          background: '#f8fafc',
          borderTop: '1px solid #cbd5e1',
          fontSize: '12px',
          color: '#64748b',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
        }}
      >
        <p>
          <strong>Tips:</strong> Click any cell to edit • Press{' '}
          <kbd
            style={{
              padding: '2px 6px',
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
              fontSize: '11px',
            }}
          >
            Enter
          </kbd>{' '}
          to move down • Press{' '}
          <kbd
            style={{
              padding: '2px 6px',
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
              fontSize: '11px',
            }}
          >
            Tab
          </kbd>{' '}
          to move right • Press{' '}
          <kbd
            style={{
              padding: '2px 6px',
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
              fontSize: '11px',
            }}
          >
            Esc
          </kbd>{' '}
          to cancel • Changes sync in real-time across all users
        </p>
      </div>
    </div>
  );
}

export default App;
