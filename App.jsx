import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, Clock, Users, FileText, Download, 
  ChevronLeft, ChevronRight, AlertCircle, Briefcase, 
  Palmtree, Cloud, RefreshCw, Save
} from 'lucide-react';

// =================================================================
// ⚙️ CONFIGURACIÓN: PEGA TU URL DE GOOGLE APPS SCRIPT AQUÍ DEBAJO
// Ejemplo: "https://script.google.com/macros/s/AKfycbx.../exec"
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
const calculateHours = (s, e) => {
  if (!s || !e) return 0;
  const [sH, sM] = s.split(':').map(Number); const [eH, eM] = e.split(':').map(Number);
  let diff = (eH * 60 + eM) - (sH * 60 + sM); if (diff < 0) diff += 24 * 60;
  return Number((diff / 60).toFixed(2));
};
// Helper que faltaba y causaba el error
const isWeekend = (dateStr) => {
  const d = new Date(dateStr).getDay();
  return d === 0 || d === 6;
};

export default function App() {
  const [scriptUrl, setScriptUrl] = useState(GOOGLE_SCRIPT_URL);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [entries, setEntries] = useState({});
  const [activeTab, setActiveTab] = useState('timesheet');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1);
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, loading, saving, error, success

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const holidays = useMemo(() => getHolidaysForYear(year), [year]);
  const isHoliday = (d) => holidays.includes(d);

  // --- SINCRONIZACIÓN CON GOOGLE SHEETS ---

  const fetchData = async () => {
    if (!scriptUrl) return;
    setStatus('loading');
    try {
      const response = await fetch(scriptUrl);
      const data = await response.json();
      if (data.entries) setEntries(data.entries);
      if (data.employees) setEmployees(data.employees);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchData();
    // Cargar librerías exportación
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
  }, [scriptUrl]);

  const saveEntryToSheet = async (key, date, empId, val) => {
    if (!scriptUrl) return;
    setStatus('saving');
    
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_entry', key, date, empId, val })
      });
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const saveEmployeeToSheet = async (id, name) => {
    if (!scriptUrl) return;
    setStatus('saving');
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_employee', id, name })
      });
      setStatus('success');
    } catch (e) { setStatus('error'); }
  };

  // --- MANEJADORES DE CAMBIOS UI ---

  const handleEntryChange = (dateStr, field, value) => {
    const key = `${dateStr}-${selectedEmployeeId}`;
    
    // 1. Actualización Optimista (UI instantánea)
    const newEntry = { ...(entries[key] || {}), [field]: value };
    const newEntries = { ...entries, [key]: newEntry };
    setEntries(newEntries);

    // 2. Guardado directo
    saveEntryToSheet(key, dateStr, selectedEmployeeId, newEntry);
  };

  const handleEmployeeNameChange = (id, newName) => {
    const newEmps = employees.map(e => e.id === id ? { ...e, name: newName } : e);
    setEmployees(newEmps);
  };

  const handleEmployeeNameBlur = (id, name) => {
    saveEmployeeToSheet(id, name);
  };

  // --- EXPORTACIÓN ---
  const getStats = (empId) => {
    let stats = { standard: 0, regular: 0, holiday: 0, vac: 0, personal: 0, balance: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const key = `${dateStr}-${empId}`;
      const entry = entries[key] || {};
      // Ahora isWeekend está definido
      const isNonWork = isWeekend(dateStr) || isHoliday(dateStr);
      const worked = calculateHours(entry.start, entry.end);
      
      if (entry.type === WORK_TYPES.VACACIONES) { stats.vac = stats.vac + 1; continue; }
      if (entry.type === WORK_TYPES.PERSONAL) { stats.personal = stats.personal + 1; continue; }

      if (!isNonWork) {
        stats.standard += 8; stats.regular += worked; stats.balance += (worked - 8);
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
        "Empleado": e.name, "H. Teóricas": s.standard, "Trabajadas": s.regular.toFixed(2), 
        "Saldo": s.balance.toFixed(2), "Guardia Festivo": s.holiday.toFixed(2), 
        "Vacaciones": s.vac, "Asuntos": s.personal 
      };
    });
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:20},{wch:10},{wch:10},{wch:10},{wch:15},{wch:10},{wch:10}];
    window.XLSX.utils.book_append_sheet(wb, ws, "Informe");
    window.XLSX.writeFile(wb, `Fichajes_${year}_${month+1}.xlsx`);
  };

  const exportPDF = () => {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    const rows = employees.map(e => {
      const s = getStats(e.id);
      return [e.name, s.standard, s.regular.toFixed(2), s.balance.toFixed(2), s.holiday.toFixed(2), s.vac, s.personal];
    });
    doc.text(`Informe ${new Date(year, month).toLocaleString('es',{month:'long',year:'numeric'})}`, 14, 15);
    doc.autoTable({ head: [["Empleado", "Teóricas", "Trabajadas", "Saldo", "Guardia", "Vac", "Asun"]], body: rows, startY: 25 });
    doc.save(`Fichajes_${year}_${month+1}.pdf`);
  };

  // --- RENDERIZADO SI NO HAY URL ---
  if (!scriptUrl) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full">
          <div className="flex justify-center mb-4"><Cloud className="w-16 h-16 text-blue-500" /></div>
          <h1 className="text-2xl font-bold text-center mb-4 text-gray-800">Conexión con Google Sheets</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Para que los fichajes se guarden en tu Google Drive, necesitas pegar la <strong>URL de la Aplicación Web</strong> que has obtenido al publicar el script.
          </p>
          <input 
            type="text" 
            placeholder="https://script.google.com/macros/s/..." 
            className="w-full border p-3 rounded mb-4 text-sm focus:border-blue-500 outline-none"
            onChange={(e) => setScriptUrl(e.target.value)}
          />
          <button 
            onClick={() => setScriptUrl(scriptUrl)} // Forzar re-render
            disabled={!scriptUrl}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-bold"
          >
            Conectar y Empezar
          </button>
          <div className="mt-4 text-xs text-gray-400 bg-gray-50 p-2 rounded">
            Si cierras esta pestaña, tendrás que volver a poner la URL (o editar el código para dejarla fija).
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERIZADO PRINCIPAL ---
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <header className="bg-emerald-700 text-white shadow-lg p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-emerald-200" />
            <div>
              <h1 className="text-xl font-bold leading-none">ControlHorario <span className="text-xs font-normal opacity-75">G-Sheets Edition</span></h1>
              <div className="flex items-center gap-2 mt-1">
                {status === 'loading' && <span className="flex items-center text-[10px] text-emerald-200"><RefreshCw className="w-3 h-3 animate-spin mr-1"/> Cargando...</span>}
                {status === 'saving' && <span className="flex items-center text-[10px] text-yellow-200"><Save className="w-3 h-3 mr-1"/> Guardando...</span>}
                {status === 'success' && <span className="flex items-center text-[10px] text-emerald-200"><Cloud className="w-3 h-3 mr-1"/> Sincronizado</span>}
                {status === 'error' && <span className="flex items-center text-[10px] text-red-300"><AlertCircle className="w-3 h-3 mr-1"/> Error Conexión</span>}
              </div>
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
                <p className="text-xs text-gray-500">{new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</p>
              </div>
              <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(Number(e.target.value))} className="border rounded p-2 text-sm">
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
                  <tr><th className="px-4 py-3">Día</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3 text-right">H</th><th className="px-4 py-3">Notas</th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1; const dStr = formatDate(year, month, day); const dObj = new Date(year, month, day);
                    const k = `${dStr}-${selectedEmployeeId}`; const entry = entries[k] || { type: 'Presencial', start: '', end: '' };
                    const isHol = isHoliday(dStr); const isWk = dObj.getDay()===0||dObj.getDay()===6; const isFri = dObj.getDay()===5;
                    const h = calculateHours(entry.start, entry.end); const warn = isFri && entry.end && parseInt(entry.end) >= 15 && h > 7;
                    return (
                      <tr key={day} className={`border-b ${isHol ? 'bg-red-50' : isWk ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2 font-medium flex items-center gap-2">
                          <span className="w-5 text-gray-500">{day}</span><span className="text-xs text-gray-400 w-8">{dObj.toLocaleString('es-ES', {weekday:'short'})}</span>
                          {isHol && <Palmtree size={12} className="text-red-500"/>} {isFri && <Briefcase size={12} className="text-blue-400"/>}
                        </td>
                        <td className="px-4 py-2">
                          <select value={entry.type} onChange={(e) => handleEntryChange(dStr, 'type', e.target.value)} className="bg-transparent text-xs outline-none w-full">
                            {Object.values(WORK_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2"><input type="time" value={entry.start||''} onChange={(e) => handleEntryChange(dStr, 'start', e.target.value)} className="border rounded px-1 w-20 text-center text-xs" disabled={entry.type==='Vacaciones'||entry.type==='Asuntos Propios'}/></td>
                        <td className="px-4 py-2 relative group">
                          <input type="time" value={entry.end||''} onChange={(e) => handleEntryChange(dStr, 'end', e.target.value)} className={`border rounded px-1 w-20 text-center text-xs ${warn ? 'border-amber-500 text-amber-700 font-bold' : ''}`} disabled={entry.type==='Vacaciones'||entry.type==='Asuntos Propios'}/>
                          {warn && <div className="absolute left-full ml-1 top-1 bg-amber-100 text-amber-800 text-[10px] p-1 rounded z-10 whitespace-nowrap">Viernes tarde</div>}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{h > 0 ? h.toFixed(2) : '-'}</td>
                        <td className="px-4 py-2"><input type="text" placeholder="..." value={entry.notes||''} onChange={(e) => handleEntryChange(dStr, 'notes', e.target.value)} className="w-full text-xs bg-transparent border-b border-gray-100 focus:border-blue-400 outline-none"/></td>
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
                  <tr><th className="px-4 py-3">Empleado</th><th className="px-4 py-3 text-right">Teóricas</th><th className="px-4 py-3 text-right">Trabajadas</th><th className="px-4 py-3 text-right bg-blue-50">Saldo</th><th className="px-4 py-3 text-right bg-orange-50 text-orange-800">Festivo</th></tr>
                </thead>
                <tbody>
                  {employees.map(e => {
                    const s = getStats(e.id);
                    return (
                      <tr key={e.id} className="border-b">
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-right">{s.standard}h</td>
                        <td className="px-4 py-3 text-right">{s.regular.toFixed(2)}h</td>
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
            <p className="mt-4 text-xs text-gray-400 text-center">Los cambios se guardan automáticamente en la hoja 'Empleados'.</p>
          </div>
        )}
      </main>
    </div>
  );
}
