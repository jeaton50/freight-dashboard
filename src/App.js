import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ExcelJS from 'exceljs';
import { toPng } from 'html-to-image';
import { db } from './firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import './App.css';

// ============================================
// DEFAULTS (used to bootstrap Firestore config)
// ============================================
const DEFAULT_COMPANIES = [
  'COWBOYS', 'CRANE', 'FLORIDA FREIGHT', 'KOL', 'PHOENIX FREIGHT',
  'NEVILLE', 'SPI', 'TAZ', 'UP&GO', 'YOPO', 'Logistify',
  'ALG', 'PC EXPRESS', 'EXOTIC RETAILERS', 'ON Spot (neville)',
];

const DEFAULT_AGENTS = [
  'D.MERCRIT', 'P.VANDENBRINK', 'A.SURFA', 'J.HOLLAND',
  'C.SNIPES', 'A.STELLUTO', 'R.VANDENBRINK', 'S.GRAVES',
  'B.DELLACROCE', 'M.KAIGLER',
];

// Global default locations (bootstraps Firestore once)
const DEFAULT_LOCATIONS = [
  'Rentex-Anaheim',
  'Rentex-Boston',
  'Rentex Chicago',
  'Rentex Ft. Lauderdale',
  'Rentex Las Vegas',
  'Rentex-Nashville',
  'Rentex NY/NJ',
  'Rentex Orlando',
  'Rentex Philadelphia',
  'Rentex Phoenix',
  'Rentex San Francisco',
  'Rentex Washington DC',
];

// ✅ New: ship method options for autocomplete
const SHIP_METHODS = ['Round Trip', 'One Way', 'Daily rate'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function App() {
  const [selectedMonth, setSelectedMonth] = useState('January');

  // Global, real-time lists (from Firestore config)
  const [companies, setCompanies] = useState(DEFAULT_COMPANIES);
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [agents] = useState(DEFAULT_AGENTS);

  // Add-item UI state
  const [newCompany, setNewCompany] = useState('');
  const [newLocation, setNewLocation] = useState('');

  // Shipments for selected month
  const [shipments, setShipments] = useState([]);

  // Editing state
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const inputRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refs for capturing graphics as images (for Excel dashboard)
  const costPerCompanyRef = useRef(null);
  const shipmentCountRef = useRef(null);
  const revenueDistRef = useRef(null);

  // =========================
  // CONFIG: Global lists
  // =========================
  useEffect(() => {
    const cfgRef = doc(db, 'freight-config', 'global');

    // Create config doc if missing (bootstraps both lists)
    (async () => {
      const snap = await getDoc(cfgRef);
      if (!snap.exists()) {
        await setDoc(cfgRef, {
          companies: DEFAULT_COMPANIES,
          locations: DEFAULT_LOCATIONS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        // If doc exists but is missing a field, backfill it
        const data = snap.data() || {};
        const payload = {};
        if (!Array.isArray(data.companies)) payload.companies = DEFAULT_COMPANIES;
        if (!Array.isArray(data.locations)) payload.locations = DEFAULT_LOCATIONS;
        if (Object.keys(payload).length) {
          payload.updatedAt = new Date().toISOString();
          await setDoc(cfgRef, payload, { merge: true });
        }
      }
    })();

    // Real-time subscription to global config
    const unsub = onSnapshot(cfgRef, (d) => {
      if (d.exists()) {
        const data = d.data() || {};
        setCompanies(Array.isArray(data.companies) && data.companies.length ? data.companies : DEFAULT_COMPANIES);
        setLocations(Array.isArray(data.locations) && data.locations.length ? data.locations : DEFAULT_LOCATIONS);
      } else {
        setCompanies(DEFAULT_COMPANIES);
        setLocations(DEFAULT_LOCATIONS);
      }
    });

    return () => unsub();
  }, []);

  // Helper to build a default row (uses first global company/location if available)
  const buildDefaultShipment = () => ({
    id: Date.now(),
    refNum: '',
    shipDate: '',
    returnDate: '',
    location: locations?.[0] || '',
    returnLocation: '',
    company: companies?.[0] || '',
    shipMethod: SHIP_METHODS[0], // ✅ default to first method ("Round Trip")
    shippingCharge: 0,
    po: '',
    agent: agents?.[0] || '',
  });

  // ✅ Ensure each month exists with at least one default row
  useEffect(() => {
    const initializeMonths = async () => {
      try {
        for (const month of MONTHS) {
          const monthDoc = doc(db, 'freight-data', month);
          const snapshot = await getDoc(monthDoc);
          const missing = !snapshot.exists();
          const empty = !missing && (!snapshot.data().shipments || snapshot.data().shipments.length === 0);
          if (missing || empty) {
            await setDoc(monthDoc, {
              shipments: [buildDefaultShipment()],
              lastModified: new Date().toISOString(),
              month,
            });
          }
        }
      } catch (err) {
        console.error('Error initializing months:', err);
      }
    };
    // run after globals are available so the default row uses current lists
    initializeMonths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, locations]);

  // 🔁 Real-time listener for the selected month
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

  // 💾 Save to Firestore (shipments)
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

  // 🔀 Change month & ensure doc exists
  const handleMonthChange = async (newMonth) => {
    setSelectedMonth(newMonth);
    try {
      const monthDocRef = doc(db, 'freight-data', newMonth);
      const snapshot = await getDoc(monthDocRef);
      const missing = !snapshot.exists();
      const empty = !missing && (!snapshot.data().shipments || snapshot.data().shipments.length === 0);
      if (missing || empty) {
        await setDoc(monthDocRef, {
          shipments: [buildDefaultShipment()],
          lastModified: new Date().toISOString(),
          month: newMonth,
        });
      }
    } catch (e) {
      console.error('Error preparing month:', e);
    }
  };

  // 📐 Dropdown positioning (portal)
  const computeDropdownPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const maxHeight = 400;
    const padding = 6;
    const spaceBelow = vh - rect.bottom - padding;
    const spaceAbove = rect.top - padding;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const height = Math.min(openUp ? spaceAbove - padding : spaceBelow - padding, maxHeight);

    setDropdownRect({
      top: openUp ? rect.top - height - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      height: Math.max(180, height),
    });
  };

  useEffect(() => {
    if (!showDropdown) return;
    computeDropdownPosition();
    const onScrollResize = () => computeDropdownPosition();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [showDropdown, editValue]);

  // ✏️ Editing handlers
  const handleCellClick = (rowIndex, field) => {
    if (!shipments[rowIndex]) return;
    const value = shipments[rowIndex][field];
    setEditingCell({ rowIndex, field });
    setEditValue(value ?? '');

    if (field === 'company') {
      setFilteredOptions(companies);
      setShowDropdown(true);
      setTimeout(computeDropdownPosition, 0);
    } else if (field === 'agent') {
      setFilteredOptions(agents);
      setShowDropdown(true);
      setTimeout(computeDropdownPosition, 0);
    } else if (field === 'location' || field === 'returnLocation') {
      setFilteredOptions(locations);
      setShowDropdown(true);
      setTimeout(computeDropdownPosition, 0);
    } else if (field === 'shipMethod') {
      // ✅ ship method autocomplete
      setFilteredOptions(SHIP_METHODS);
      setShowDropdown(true);
      setTimeout(computeDropdownPosition, 0);
    } else {
      setShowDropdown(false);
    }
  };

  const handleCellChange = (e) => {
    const value = e.target.value;
    setEditValue(value);

    const field = editingCell?.field;
    if (!field) return;

    if (['company', 'agent', 'location', 'returnLocation', 'shipMethod'].includes(field)) {
      const options =
        field === 'company'
          ? companies
          : field === 'agent'
          ? agents
          : field === 'shipMethod'
          ? SHIP_METHODS
          : locations;

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
    setDropdownRect(null);
    inputRef.current?.focus();
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
        setDropdownRect(null);
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
      setDropdownRect(null);
    }
  };

  const handleAddRow = () => {
    const newShipment = buildDefaultShipment();
    const updatedShipments = [...shipments, newShipment];
    setShipments(updatedShipments);
    saveToFirebase(updatedShipments);
    setTimeout(() => {
      handleCellClick(updatedShipments.length - 1, 'refNum');
    }, 300);
  };

  const handleDeleteRow = (index) => {
    if (window.confirm('Delete this shipment?')) {
      const updatedShipments = shipments.filter((_, i) => i !== index);
      saveToFirebase(updatedShipments);
    }
  };

  // ============================
  // GLOBAL: Add company/location
  // ============================
  const addCompanyGlobal = async () => {
    const raw = newCompany.trim();
    if (!raw) return;
    const candidate = raw.toUpperCase();
    const exists = companies.some(c => c.toUpperCase() === candidate);
    if (exists) {
      alert(`"${candidate}" already exists.`);
      return;
    }
    const next = [...companies, candidate].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    try {
      const cfgRef = doc(db, 'freight-config', 'global');
      await setDoc(
        cfgRef,
        { companies: next, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setNewCompany('');
    } catch (e) {
      console.error('Failed to add company:', e);
      alert('Failed to add company. Check your permissions/rules.');
    }
  };

  const addLocationGlobal = async () => {
    const raw = newLocation.trim();
    if (!raw) return;
    // Keep original capitalization for locations
    const exists = locations.some(l => l.toLowerCase() === raw.toLowerCase());
    if (exists) {
      alert(`"${raw}" already exists.`);
      return;
    }
    const next = [...locations, raw].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    try {
      const cfgRef = doc(db, 'freight-config', 'global');
      await setDoc(
        cfgRef,
        { locations: next, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setNewLocation('');
    } catch (e) {
      console.error('Failed to add location:', e);
      alert('Failed to add location. Check your permissions/rules.');
    }
  };

  // ======== EXCEL EXPORT (with embedded images) ========
  const excelColumns = [
  { header: 'Reference #',   key: 'refNum' },
  { header: 'Ship Date',     key: 'shipDate' },
  { header: 'Return Date',   key: 'returnDate' },
  { header: 'Location',      key: 'location' },
  { header: 'Return Location', key: 'returnLocation' },
  { header: 'Company',       key: 'company' },
  { header: 'Ship Method',   key: 'shipMethod' },
  { header: 'Charges',       key: 'shippingCharge' },
  { header: 'PO',            key: 'po' },
  { header: 'Agent',         key: 'agent' },
];

// Map rows for Excel WITHOUT the id column
const mapRowsForExcel = (rows) =>
  rows.map((s) => ({
    refNum: s.refNum ?? '',
    shipDate: s.shipDate ?? '',
    returnDate: s.returnDate ?? '',
    location: s.location ?? '',
    returnLocation: s.returnLocation ?? '',
    company: s.company ?? '',
    shipMethod: s.shipMethod ?? '',
    shippingCharge: Number(s.shippingCharge || 0),
    po: s.po ?? '',
    agent: s.agent ?? '',
  }));

// Helper to autosize columns based on content length
const autosizeColumns = (sheet) => {
  sheet.columns.forEach((col) => {
    let max = (col.header ? String(col.header).length : 10);
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      const len =
        v == null
          ? 0
          : typeof v === 'object' && v.text
          ? String(v.text).length
          : String(v).length;
      if (len > max) max = len;
    });
    // Add a little padding; cap width so images/dashboard sheet stays readable
    col.width = Math.min(max + 2, 40);
  });
};

// Build a pretty data sheet with frozen header, bold header, currency, autosize
const buildDataSheetPretty = (wb, title, rows) => {
  const safeTitle = title.slice(0, 31);
  const sheet = wb.addWorksheet(safeTitle, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Set columns (Title Case headers + keys)
  sheet.columns = excelColumns;

  // Bold header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  // Add rows
  rows.forEach((r) => sheet.addRow(r));

  // Currency format on Charges
  sheet.getColumn('shippingCharge').numFmt = '$#,##0.00';

  // Autosize all columns to fit
  autosizeColumns(sheet);

  return sheet;
};

// Trigger a file download for a given Blob
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};


  const exportMonthExcel = async () => {
    const capture = async (node) =>
      node ? await toPng(node, { cacheBust: true, backgroundColor: 'white', pixelRatio: 2 }) : null;

    const [imgCostPerCompany, imgShipmentCount, imgRevenueDist] = await Promise.all([
      capture(costPerCompanyRef.current),
      capture(shipmentCountRef.current),
      capture(revenueDistRef.current),
    ]);

    const wb = new ExcelJS.Workbook();
    const dataRows = mapRowsForExcel(shipments);
    buildDataSheetPretty(wb, selectedMonth, dataRows);

    const dash = wb.addWorksheet('Dashboard', { pageSetup: { orientation: 'landscape' } });
    const addImg = (base64, tlRow, tlCol, widthPx, heightPx) => {
      if (!base64) return;
      const imgId = wb.addImage({ base64, extension: 'png' });
      dash.addImage(imgId, {
        tl: { col: tlCol, row: tlRow },
        ext: { width: widthPx, height: heightPx },
        editAs: 'oneCell',
      });
    };

    const title = dash.getCell('A1');
    title.value = `Dashboard — ${selectedMonth}`;
    title.font = { bold: true, size: 16 };
    dash.mergeCells('A1:F1');

    addImg(imgCostPerCompany, 2, 0, 900, 350);
    addImg(imgShipmentCount,   18, 0, 900, 350);
    addImg(imgRevenueDist,     34, 0, 900, 350);

    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `freight-${selectedMonth}-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const exportAllMonthsExcel = async () => {
    const wb = new ExcelJS.Workbook();
    for (const month of MONTHS) {
      const monthDocRef = doc(db, 'freight-data', month);
      const docSnap = await getDoc(monthDocRef);
      const list = docSnap.exists() ? docSnap.data().shipments || [] : [];
      const rows = mapRowsForExcel(list);
      buildDataSheetPretty(wb, month, rows);
    }
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `freight-all-months-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  // ======== Summary calculations ========
  const companySummary = (() => {
    const summary = {};
    shipments.forEach((s) => {
      const key = s.company || '(Unassigned)';
      if (!summary[key]) summary[key] = { count: 0, total: 0 };
      summary[key].count += 1;
      summary[key].total += Number(s.shippingCharge || 0);
    });
    return Object.entries(summary)
      .map(([company, data]) => ({ company, ...data }))
      .sort((a, b) => b.total - a.total);
  })();

  const totalCost = shipments.reduce((sum, s) => sum + Number(s.shippingCharge || 0), 0);
  const maxCount = Math.max(...companySummary.map((c) => c.count), 1);
  const chartColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#f97316', '#14b8a6', '#f43f5e',
  ];

  // ======== Render helpers ========
  const renderCell = (rowIndex, field, value) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === field;
    const isNumeric = field === 'shippingCharge';
    const hasAutocomplete =
      field === 'company' ||
      field === 'agent' ||
      field === 'location' ||
      field === 'returnLocation' ||
      field === 'shipMethod';

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
          {hasAutocomplete && showDropdown && filteredOptions.length > 0 && dropdownRect &&
            createPortal(
              <div
                style={{
                  position: 'fixed',
                  zIndex: 9999,
                  top: dropdownRect.top,
                  left: dropdownRect.left,
                  width: dropdownRect.width,
                  maxHeight: dropdownRect.height,
                  overflowY: 'auto',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
                }}
              >
                {filteredOptions.map((option, idx) => (
                  <div
                    key={idx}
                    onMouseDown={() => handleSelectOption(option)}
                    style={{ padding: '10px 12px', fontSize: 13, cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#eef2ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    {option}
                  </div>
                ))}
              </div>,
              document.body
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
        onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isNumeric && value ? `$${Number(value).toFixed(2)}` : value || ''}
      </div>
    );
  };

  // ======== UI ========
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

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Month selector */}
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>

            {/* Global Add Company */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={newCompany}
                placeholder="Add company…"
                onChange={(e) => setNewCompany(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCompanyGlobal(); }}
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', minWidth: 180 }}
              />
              <button
                onClick={addCompanyGlobal}
                style={{ padding: '8px 12px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                title="Add a new global company"
              >
                + Add Company
              </button>
            </div>

            {/* Global Add Location */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={newLocation}
                placeholder="Add location…"
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addLocationGlobal(); }}
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', minWidth: 220 }}
              />
              <button
                onClick={addLocationGlobal}
                style={{ padding: '8px 12px', background: '#155e75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                title="Add a new global location"
              >
                + Add Location
              </button>
            </div>

            {/* Excel export buttons */}
            <button
              onClick={exportMonthExcel}
              style={{ padding: '8px 12px', background: '#166534', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              title="Export current month to Excel (with images)"
            >
              ⬇️ Export Month (Excel)
            </button>
            <button
              onClick={exportAllMonthsExcel}
              style={{ padding: '8px 12px', background: '#047857', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              title="Export all months to Excel (data-only)"
            >
              ⬇️ Export All (Excel)
            </button>

            <button
              onClick={async () => {
                if (!window.confirm(`Reset ${selectedMonth} to one blank row? This cannot be undone.`)) return;
                await saveToFirebase([buildDefaultShipment()]);
              }}
              style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              🗑️ Reset Month
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '20px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>Total Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${shipments.length > 0 ? (totalCost / shipments.length).toFixed(2) : '0.00'}</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* Company Totals Table (capture area) */}
          <div ref={costPerCompanyRef} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
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

          {/* Bar Chart (capture area) */}
          <div ref={shipmentCountRef} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
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

        {/* Revenue Distribution (capture area) */}
        <div ref={revenueDistRef} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '16px', color: '#334155' }}>Revenue Distribution by Company</h3>
          {companySummary.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {companySummary.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                    <span style={{ fontWeight: '600', color: '#475569' }}>{item.company}</span>
                    <span style={{ color: '#64748b' }}>{totalCost > 0 ? ((item.total / totalCost) * 100).toFixed(1) : '0.0'}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '32px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${totalCost > 0 ? (item.total / totalCost) * 100 : 0}%`,
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
                        ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
