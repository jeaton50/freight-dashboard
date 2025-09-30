import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
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

  // ✅ Bulk initializer: ensure all months exist
  useEffect(() => {
  const initializeMonths = async () => {
    try {
      for (const month of MONTHS) {
        const monthDoc = doc(db, 'freight-data', month);
        const snapshot = await getDoc(monthDoc);

        if (!snapshot.exists()) {
          const defaultShipment = {
            id: Date.now(),
            refNum: '',
            shipDate: '',
            returnDate: '',
            location: '',
            returnLocation: '',
            company: COMPANIES[0],  // Pre-fill with first company
            shipMethod: '',
            shippingCharge: 0,
            po: '',
            agent: AGENTS[0],       // Pre-fill with first agent
          };

          await setDoc(monthDoc, {
            shipments: [defaultShipment],
            lastModified: new Date().toISOString(),
            month,
          });

          console.log(`Initialized ${month} with default shipment`);
        }
      }
    } catch (err) {
      console.error('Error initializing months:', err);
    }
  };

  initializeMonths();
}, []);

  // Real-time listener
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

  // Save to Firestore
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

  // Focus input on edit
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

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

  // ✅ Auto-create doc if missing when switching months
  const handleMonthChange = async (newMonth) => {
    setSelectedMonth(newMonth);
    try {
      const monthDoc = doc(db, 'freight-data', newMonth);
      const snapshot = await getDoc(monthDoc);
      if (!snapshot.exists()) {
        await setDoc(monthDoc, {
          shipments: [],
          lastModified: new Date().toISOString(),
          month: newMonth,
        });
        console.log(`Created Firestore doc for ${newMonth}`);
      }
    } catch (error) {
      console.error('Error creating month document:', error);
    }
  };

  const handleCellClick = (rowIndex, field) => {
    if (!shipments[rowIndex]) return;
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
    setShipments(updatedShipments);
    saveToFirebase(updatedShipments);
    setTimeout(() => {
      if (updatedShipments.length > 0) {
        handleCellClick(updatedShipments.length - 1, 'refNum');
      }
    }, 300);
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

  // Cell renderer
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

  const chartColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#f97316', '#14b8a6', '#f43f5e',
  ];

  // ==============================
  // Main JSX
  // ==============================
  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <div style={{ maxWidth: '98%', margin: '0 auto', padding: '16px' }}>
        {/* Header */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>2025 Freight Booked by Company</h1>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              {selectedMonth}
              {isSaving && <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '8px' }}>💾 Saving...</span>}
              {!isSaving && lastSaved && <span style={{ fontSize: '11px', color: '#10b981', marginLeft: '8px' }}>✓ Saved at {lastSaved}</span>}
              <span style={{ fontSize: '11px', color: '#3b82f6', marginLeft: '8px' }}>🌐 Multi-user enabled</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button
              onClick={exportData}
              style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              💾 Export All
            </button>
            <button
              onClick={clearMonthData}
              style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              🗑️ Clear Month
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '20px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>Total Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${totalCost.toLocaleString()}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: '12px', padding: '20px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>Total Shipments</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{shipments.length}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', borderRadius: '12px', padding: '20px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>Active Companies</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{companySummary.length}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', borderRadius: '12px', padding: '20px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>Avg Per Shipment</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${shipments.length > 0 ? (totalCost / shipments.length).toFixed(2) : '0'}</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* Company Totals Table */}
          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', color: '#334155' }}>Shipping Cost Per Company</h3>
            {companySummary.length > 0 ? (
              <table style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '4px', fontWeight: '600' }}>Company</th>
                    <th style={{ textAlign: 'right', padding: '4px', fontWeight: '600' }}>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {companySummary.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px' }}>{item.company}</td>
                      <td style={{ textAlign: 'right', padding: '4px' }}>
                        ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', borderTop: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '4px' }}>Total</td>
                    <td style={{ textAlign: 'right', padding: '4px' }}>
                      ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '20px' }}>No data for {selectedMonth}</p>
            )}
          </div>

          {/* Bar Chart */}
          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '16px', color: '#334155' }}>Shipment Count by Company</h3>
            {companySummary.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {companySummary.map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                      <span style={{ fontWeight: '600', color: '#475569' }}>{item.company}</span>
                      <span style={{ color: '#64748b' }}>{item.count} shipments</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '28px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${(item.count / maxCount) * 100}%`,
                            height: '100%',
                            background: chartColors[idx % chartColors.length],
                            borderRadius: '6px',
                            transition: 'width 0.3s ease',
                            boxShadow: `0 0 10px ${chartColors[idx % chartColors.length]}40`,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', minWidth: '30px', textAlign: 'right' }}>{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '20px' }}>No data for {selectedMonth}</p>
            )}
          </div>
        </div>

        {/* Revenue Distribution */}
        <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '16px', color: '#334155' }}>Revenue Distribution by Company</h3>
          {companySummary.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {companySummary.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                    <span style={{ fontWeight: '600', color: '#475569' }}>{item.company}</span>
                    <span style={{ color: '#64748b' }}>{((item.total / totalCost) * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '32px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(item.total / totalCost) * 100}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${chartColors[idx % chartColors.length]}, ${chartColors[idx % chartColors.length]}dd)`,
                          display: 'flex',
                          alignItems: 'center',
                          paddingRight: '12px',
                          justifyContent: 'flex-end',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          transition: 'width 0.5s ease',
                          borderRadius: '8px',
                        }}
                      >
                        ${item.total.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '20px' }}>No data for {selectedMonth}</p>
          )}
        </div>

        {/* Data Entry Table */}
        <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <div style={{ background: '#1d4ed8', color: 'white', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
            <h2 style={{ fontWeight: 'bold', fontSize: '14px' }}>Shipment Details - {selectedMonth}</h2>
            <button
              onClick={handleAddRow}
              style={{ background: '#2563eb', color: 'white', padding: '6px 16px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
            >
              + Add Row
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>REFERENCE #</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>SHIP DATE</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>RETURN DATE</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>LOCATION</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>RETURN LOCATION</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>COMPANY</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>SHIP METHOD</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>CHARGES</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>PO</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>AGENT</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {shipments.length > 0 ? (
                  shipments.map((shipment, idx) => (
                    <tr key={shipment.id} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'refNum', shipment.refNum)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'shipDate', shipment.shipDate)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'returnDate', shipment.returnDate)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'location', shipment.location)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'returnLocation', shipment.returnLocation)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'company', shipment.company)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'shipMethod', shipment.shipMethod)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'shippingCharge', shipment.shippingCharge)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'po', shipment.po)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: 0 }}>{renderCell(idx, 'agent', shipment.agent)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteRow(idx)}
                          style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" style={{ border: '1px solid #cbd5e1', padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                      No shipments for {selectedMonth}. Click "Add Row" to start entering data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #cbd5e1', fontSize: '12px', color: '#64748b', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
            <p>
              <strong>Tips:</strong> Click any cell to edit • Press{' '}
              <kbd style={{ padding: '2px 6px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '3px', fontSize: '11px' }}>Enter</kbd>
              {' '}to move down • Press{' '}
              <kbd style={{ padding: '2px 6px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '3px', fontSize: '11px' }}>Tab</kbd>
              {' '}to move right • Press{' '}
              <kbd style={{ padding: '2px 6px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '3px', fontSize: '11px' }}>Esc</kbd>
              {' '}to cancel • Changes sync in real-time across all users
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
