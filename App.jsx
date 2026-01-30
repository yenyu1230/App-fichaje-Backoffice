import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, Clock, Users, FileText, Download, 
  ChevronLeft, ChevronRight, AlertCircle, Briefcase, 
  Palmtree, Cloud, RefreshCw, Save, Coffee, Wifi, WifiOff,
  UserCheck
} from 'lucide-react';

// =================================================================
// ⚙️ CONFIGURACIÓN: URL DE GOOGLE APPS SCRIPT
// =================================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyN72tw3OT75PR-6v5bEscxrGZds3VVx-QZR8ToavCSfSi0EYwCiC8hwfDJYC9M-ZC3iQ/exec"; 
// =================================================================

// --- CONSTANTES Y UTILIDADES ---

const INITIAL_EMPLOYEES = [
  { id: 1, name: 'Empleado 1' }, { id: 2, name: 'Empleado 2' },
  { id: 3, name: 'Empleado 3' }, { id: 4, name: 'Empleado 4' },
  { id: 5, name: 'Empleado 5' }, { id: 6, name: 'Empleado 6' },
];

const WORK_TYPES = {
  PRESENCIAL: 'Presencial', TELETRABAJO: 'Teletrabajo',
  VACACIONES: 'Vacaciones', PERSONAL: 'Asuntos Propios',
  BAJA: 'Baja Médica', GUARDIA: 'Guardia (Festivo)',
};

const getEasterDate = (year) => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};
const addDays = (d, days) => { const r = new Date(d); r.setDate(r.getDate() + days); return r; };
const formatDateObj = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const getHolidaysForYear = (year) => {
  const fixed = [`${year}-01-01`, `${year}-01-06`, `${year}-05-01`, `${year}-06-24`, 
    `${year}-08-15`, `${year}-09-11`, `${year}-09-24`, `${year}-10-12`, 
    `${year}-11-01`, `${year}-12-06`, `${year}-12-08`, `${year}-12-25`, `${year}-12-26`];
  const easter = getEasterDate(year);
  return [...fixed, formatDateObj(addDays(easter,-2)), formatDateObj(addDays(easter,1)), formatDateObj(addDays(easter,50))];
};

const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const formatDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const isWeekend = (dateStr) => { const d = new Date(dateStr).getDay(); return d === 0 || d === 6; };
const isFriday = (dateStr) => new Date(dateStr).getDay() === 5;

// Calcula diferencia en minutos de forma segura (evita NaN)
const diffMinutes = (start, end) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  
  // Validación extra anti-NaN
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;

  let diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff < 0) diff += 24 * 60;
  return diff;
};

// Cálculo actualizado: Jornada - Descanso
const calculateHours = (s, e, breakMins = 0) => {
  const totalMins = diffMinutes(s, e);
  const netMins = Math.max(0, totalMins - (Number(breakMins) || 0));
  const res = Number((netMins / 60).toFixed(2));
  return isNaN(res) ? 0 : res; // Asegura que nunca devuelva NaN
};

export default function App() {
  const [scriptUrl, setScriptUrl] = useState(GOOGLE_SCRIPT_URL);
  const isEditingRef = useRef(false); 
  const dirtyKeysRef = useRef(new Set()); 

  const [entries, setEntries] = useState({});
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('timesheet');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1);
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [status, setStatus] = useState('idle');
  const [lastSync, setLastSync] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const holidays = useMemo(() => getHolidaysForYear(year), [year]);
  const isHoliday = (d) => holidays.includes(d);

  // --- SINCRONIZACIÓN REAL INTELIGENTE ---

  const fetchData = async () => {
    if (!scriptUrl || isEditingRef.current) return;
    if (Object.keys(entries).length === 0) setStatus('loading');
    
    try {
      const response = await fetch(`${scriptUrl}?t=${Date.now()}`);
      const data = await response.json();
      
      if (data.entries) {
        setEntries(currentEntries => {
          const mergedEntries = { ...currentEntries };
          const cloudEntries = data.entries;
          Object.keys(cloudEntries).forEach(key => {
            const cloudVal = cloudEntries[key];
            const localVal = currentEntries[key];
            if (dirtyKeysRef.current.has(key)) {
              if (JSON.stringify(cloudVal) === JSON.stringify(localVal)) {
                dirtyKeysRef.current.delete(key);
              } else {
                return;
              }
            }
            mergedEntries[key] = cloudVal;
          });
          return mergedEntries;
        });
      }
      if (data.employees) setEmployees(data.employees);
      setStatus('success');
      setLastSync(new Date());
    } catch (e) {
      console.warn("Fallo conexión nube:", e);
      const localE = localStorage.getItem('backup_entries');
      if (localE && Object.keys(entries).length === 0) setEntries(JSON.parse(localE));
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 8000); 
    return () => clearInterval(intervalId);
  }, [scriptUrl]);

  useEffect(() => {
    if (Object.keys(entries).length > 0) {
      localStorage.setItem('backup_entries', JSON.stringify(entries));
    }
  }, [entries]);

  useEffect(() => {
    const loadScript = (src) => new Promise(resolve => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script'); s.src = src; s.onload = resolve;
      document.head.appendChild(s);
    });
    Promise.all([
      loadScript("https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js")
    ]).then(() => setLibsLoaded(true));
  }, []);

  const saveEntryToSheet = async (key, date, empId, val) => {
    if (!scriptUrl) return;
    setStatus('saving');
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: 'save_entry', key, date, empId, val })
      });
      setStatus('success');
      setLastSync(new Date());
    } catch (e) { setStatus('error'); }
  };

  const saveEmployeeToSheet = async (id, name) => {
    if (!scriptUrl) return;
    setStatus('saving');
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: 'save_employee', id, name })
      });
      setStatus('success');
    } catch (e) { setStatus('error'); }
  };

  // --- MANEJADORES ---
  
  const handleFocus = () => { isEditingRef.current = true; };
  const handleBlur = () => { isEditingRef.current = false; };

  const handleEntryChange = (dateStr, field, value) => {
    const key = `${dateStr}-${selectedEmployeeId}`;
    dirtyKeysRef.current.add(key);

    const oldEntry = entries[key] || {};
    const newEntry = { ...oldEntry, [field]: value };
    
    if (field === 'start' && !newEntry.break && value) newEntry.break = 60;

    const newEntries = { ...entries, [key]: newEntry };
    setEntries(newEntries);
    saveEntryToSheet(key, dateStr, selectedEmployeeId, newEntry);
  };

  const handleEmployeeNameChange = (id, newName) => {
    const newEmps = employees.map(e => e.id === id ? { ...e, name: newName } : e);
    setEmployees(newEmps);
  };

  const handleEmployeeNameBlur = (id, name) => {
    saveEmployeeToSheet(id, name);
  };

  const getStats = (empId) => {
    let stats = { 
      standard: 0, 
      regular: 0, 
      holiday: 0, 
      vac: 0, 
      personal: 0, // Días completos
      personalHours: 0, // Horas parciales
      balance: 0 
    };

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const key = `${dateStr}-${empId}`;
      const entry = entries[key] || {};
      const isNonWork = isWeekend(dateStr) || isHoliday(dateStr);
      
      const worked = calculateHours(entry.start, entry.end, entry.break);
      
      if (entry.type === WORK_TYPES.VACACIONES) { stats.vac++; continue; }
      
      // Asuntos Propios
      if (entry.type === WORK_TYPES.PERSONAL) {
        if (entry.start && entry.end) {
          // Calculamos la ausencia parcial si existen las horas
          let absenceH = 0;
          if (entry.pOut && entry.pIn) {
             const absMins = diffMinutes(entry.pOut, entry.pIn);
             const val = Number((absMins / 60).toFixed(2));
             absenceH = isNaN(val) ? 0 : val; // Protección NaN
          }
          
          stats.standard += 8;
          stats.regular += worked; 
          stats.personalHours += absenceH; 
          // Simplificación: Balance = (Worked + Absence) - 8
          stats.balance += ((worked + absenceH) - 8);
        } else {
          // Día completo sin horas definidas
          stats.personal++; 
        }
        continue;
      }

      // Día Normal
      if (!isNonWork) {
        stats.standard += 8;
        stats.regular += worked;
        stats.balance += (worked - 8);
      } else if (worked > 0) {
        stats.holiday += worked;
      }
    }
    return stats;
  };

  const exportExcel = () => {
    if (!window.XLSX) return;
    const data = employees.map(e => {
      const s = getStats(e.id);
      return { 
        "Empleado": e.name, 
        "H. Teóricas": s.standard, 
        "Trabajadas": s.regular.toFixed(2), 
        "H. Ausencia Justif.": s.personalHours.toFixed(2),
        "Saldo": s.balance.toFixed(2), 
        "Guardia Festivo": s.holiday.toFixed(2), 
        "Vacaciones": s.vac, 
        "Días Asuntos P.": s.personal 
      };
    });
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:20},{wch:10},{wch:10},{wch:15},{wch:10},{wch:15},{wch:10},{wch:15}];
    window.XLSX.utils.book_append_sheet(wb, ws, "Informe");
    window.XLSX.writeFile(wb, `Fichajes_${year}_${month+1}.xlsx`);
  };

  const exportPDF = () => {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    const rows = employees.map(e => {
      const s = getStats(e.id);
      return [
        e.name, s.standard, s.regular.toFixed(2), s.personalHours.toFixed(2), 
        s.balance.toFixed(2), s.holiday.toFixed(2), s.vac, s.personal
      ];
    });
    doc.text(`Informe ${new Date(year, month).toLocaleString('es',{month:'long',year:'numeric'})}`, 14, 15);
    doc.autoTable({ 
      head: [["Empleado", "Teóricas", "Trabajadas", "H. Ausencia", "Saldo", "Guardia", "Vac", "Días AP"]], 
      body: rows, startY: 25, styles: { fontSize: 8 }
    });
    doc.save(`Fichajes_${year}_${month+1}.pdf`);
  };

  if (!scriptUrl) return <div className="p-10 text-center">Falta configurar URL de Google Script</div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <header className="bg-emerald-700 text-white shadow-lg p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-emerald-200" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold leading-none">ControlHorario <span className="text-xs font-normal opacity-75">Team</span></h1>
              <button onClick={fetchData} className="flex items-center gap-2 mt-1 hover:bg-emerald-800 rounded px-1 transition-colors text-left" title="Clic para sincronizar ahora">
                {status === 'loading' && <span className="flex items-center text-[10px] text-emerald-200"><RefreshCw className="w-3 h-3 animate-spin mr-1"/> Sincronizando...</span>}
                {status === 'saving' && <span className="flex items-center text-[10px] text-yellow-200"><Save className="w-3 h-3 mr-1"/> Guardando...</span>}
                {status === 'success' && <span className="flex items-center text-[10px] text-emerald-200"><Wifi className="w-3 h-3 mr-1"/> Online {lastSync && `(${lastSync.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})`}</span>}
                {status === 'error' && <span className="flex items-center text-[10px] text-red-300"><WifiOff className="w-3 h-3 mr-1"/> Offline (Modo Local)</span>}
              </button>
            </div>
          </div>
          <div className="flex items-center bg-emerald-800 rounded-lg p-1">
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-1 hover:bg-emerald-600 rounded"><ChevronLeft size={20}/></button>
            <span className="px-4 font-medium min-w-[120px] text-center capitalize text-sm">{currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-1 hover:bg-emerald-600 rounded"><ChevronRight size={20}/></button>
          </div>
        </div>
        <div className="container mx-auto flex gap-1 mt-4 overflow-x-auto text-sm">
          {['timesheet', 'report', 'employees'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-t-lg capitalize ${activeTab === tab ? 'bg-gray-100 text-emerald-800 font-bold' : 'text-emerald-100 hover:bg-emerald-600'}`}>
              {tab === 'timesheet' ? 'Fichaje' : tab === 'report' ? 'Informe' : 'Personal'}
            </button>
          ))}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {activeTab === 'timesheet' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800">Ficha: {employees.find(e => e.id === selectedEmployeeId)?.name}</h3>
                <p className="text-xs text-gray-500 capitalize">{new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</p>
              </div>
              <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(Number(e.target.value))} className="border rounded p-2 text-sm">
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
                  <tr>
                    <th className="px-4 py-3">Día</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-center">Entrada</th>
                    <th className="px-4 py-3 text-center">Salida</th>
                    <th className="px-2 py-3 text-center w-24" title="Descanso en minutos">Desc. (min)</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Notas / Incidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1; const dStr = formatDate(year, month, day); const dObj = new Date(year, month, day);
                    const k = `${dStr}-${selectedEmployeeId}`; const entry = entries[k] || { type: 'Presencial', start: '', end: '', break: 0 };
                    const isHol = isHoliday(dStr); const isWk = dObj.getDay()===0||dObj.getDay()===6; const isFri = dObj.getDay()===5;
                    const h = calculateHours(entry.start, entry.end, entry.break);
                    const warn = isFri && entry.end && parseInt(entry.end) >= 15 && h > 7;
                    
                    const isPersonalAffair = entry.type === WORK_TYPES.PERSONAL;
                    // Deshabilitar inputs SOLO si es Vacaciones o Baja (Asuntos Propios ahora permite editar)
                    const disabledInputs = entry.type === WORK_TYPES.VACACIONES || entry.type === WORK_TYPES.BAJA;

                    return (
                      <tr key={day} className={`border-b ${isHol ? 'bg-red-50' : isWk ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2 font-medium flex items-center gap-2">
                          <span className="w-5 text-gray-500">{day}</span><span className="text-xs text-gray-400 w-8">{dObj.toLocaleString('es-ES', {weekday:'short'})}</span>
                          {isHol && <Palmtree size={12} className="text-red-500"/>} 
                          {isFri && <Briefcase size={12} className="text-blue-400"/>}
                          {isPersonalAffair && <UserCheck size={12} className="text-purple-500"/>}
                        </td>
                        <td className="px-4 py-2">
                          <select value={entry.type} onChange={(e) => handleEntryChange(dStr, 'type', e.target.value)} className="bg-transparent text-xs outline-none w-full font-medium">
                            {Object.values(WORK_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input type="time" value={entry.start||''} onChange={(e) => handleEntryChange(dStr, 'start', e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="border rounded px-1 w-20 text-center text-xs" disabled={disabledInputs}/>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <input type="time" value={entry.end||''} onChange={(e) => handleEntryChange(dStr, 'end', e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className={`border rounded px-1 w-20 text-center text-xs ${warn ? 'border-amber-500 text-amber-700 font-bold' : ''}`} disabled={disabledInputs}/>
                            {warn && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded mt-1 whitespace-nowrap">Viernes tarde</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center relative">
                            <input type="number" min="0" max="120" placeholder="0" value={entry.break || ''} onChange={(e) => handleEntryChange(dStr, 'break', e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="border rounded px-1 w-12 text-center text-xs bg-gray-50 focus:bg-white" disabled={disabledInputs || !entry.start}/>
                            {entry.break > 0 && <span className="absolute -top-2 -right-1 text-[8px] text-gray-400">min</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-medium">{h > 0 ? h.toFixed(2) : '-'}</td>
                        <td className="px-4 py-2">
                          {isPersonalAffair ? (
                            <div className="flex flex-col gap-1 bg-purple-50 p-1 rounded border border-purple-100">
                              <div className="flex gap-1 items-center">
                                <span className="text-[9px] text-purple-700 font-bold">Salida:</span>
                                <input type="time" value={entry.pOut||''} onChange={(e) => handleEntryChange(dStr, 'pOut', e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="border rounded px-1 h-5 text-[10px] w-20 bg-white"/>
                                <span className="text-[9px] text-purple-700 font-bold ml-1">Vuelta:</span>
                                <input type="time" value={entry.pIn||''} onChange={(e) => handleEntryChange(dStr, 'pIn', e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="border rounded px-1 h-5 text-[10px] w-20 bg-white"/>
                              </div>
                              <input type="text" placeholder="Motivo asunto..." value={entry.reason||''} onChange={(e) => handleEntryChange(dStr, 'reason', e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="w-full text-[10px] border-b border-purple-200 bg-transparent focus:border-purple-500 outline-none"/>
                            </div>
                          ) : (
                            <input type="text" placeholder="..." value={entry.notes||''} onChange={(e) => handleEntryChange(dStr, 'notes', e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="w-full text-xs bg-transparent border-b border-gray-100 focus:border-blue-400 outline-none"/>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Informe {new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</h2>
              <div className="flex gap-2">
                <button onClick={exportExcel} disabled={!libsLoaded} className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"><Download size={16}/> Excel</button>
                <button onClick={exportPDF} disabled={!libsLoaded} className="flex items-center gap-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"><FileText size={16}/> PDF</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border rounded-lg">
                <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
                  <tr>
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3 text-right">Teóricas</th>
                    <th className="px-4 py-3 text-right">Trabajadas</th>
                    <th className="px-4 py-3 text-right bg-purple-50 text-purple-800">H. Ausencia Justif.</th>
                    <th className="px-4 py-3 text-right bg-blue-50">Saldo Total</th>
                    <th className="px-4 py-3 text-right bg-orange-50 text-orange-800">Festivo</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => {
                    const s = getStats(e.id);
                    return (
                      <tr key={e.id} className="border-b">
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-right">{s.standard}h</td>
                        <td className="px-4 py-3 text-right">{s.regular.toFixed(2)}h</td>
                        <td className="px-4 py-3 text-right bg-purple-50 text-purple-800 font-medium">{s.personalHours > 0 ? s.personalHours.toFixed(2)+'h' : '-'}</td>
                        <td className={`px-4 py-3 text-right font-bold bg-blue-50 ${s.balance>=0?'text-green-600':'text-red-600'}`}>{s.balance.toFixed(2)}h</td>
                        <td className="px-4 py-3 text-right bg-orange-50 font-bold text-orange-800">{s.holiday>0?s.holiday.toFixed(2)+'h':'-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="bg-white p-6 rounded-lg shadow max-w-lg mx-auto">
            <h2 className="font-bold mb-4 flex items-center gap-2"><Users size={18}/> Editar Plantilla</h2>
            <div className="space-y-3">
              {employees.map(e => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-6">#{e.id}</span>
                  <input value={e.name} 
                    onChange={(ev) => handleEmployeeNameChange(e.id, ev.target.value)} 
                    onBlur={(ev) => handleEmployeeNameBlur(e.id, ev.target.value)}
                    className="border p-2 w-full rounded focus:border-emerald-500 outline-none"
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400 text-center">Los cambios se guardan automáticamente.</p>
          </div>
        )}
      </main>
    </div>
  );
}
