import React, { useState, useEffect, useRef, Component } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Printer, Download, Activity, Send, Phone, Target, ShieldAlert, ArrowRight,
  Loader2, Trash2, ImagePlus, Save, Folder, AlertCircle, HardDrive, FileUp,
  CheckCircle2, ArrowLeft, Code, X, Plus, Settings, Calendar, ChevronDown, ChevronUp, Menu, FileText, Cloud
} from 'lucide-react';
import { DatabaseModal } from './components/DatabaseModal';
import { googleSignIn, getAccessToken } from './lib/firebaseAuth';

// =====================================================================
// ПЕРЕХВАТЧИК КРИТИЧЕСКИХ ОШИБОК
// =====================================================================
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Critical UI Error:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">
          <AlertCircle size={64} className="text-red-500 mb-4" />
          <h1 className="text-2xl font-black mb-2">Произошла критическая ошибка</h1>
          <p className="text-slate-400 mb-6 text-center max-w-xl">
            Пожалуйста, покажите этот текст разработчику:
          </p>
          <div className="bg-slate-800 p-4 rounded-xl w-full max-w-2xl overflow-auto text-left font-mono text-sm text-red-400">
            {this.state.error && this.state.error.toString()}
            <br/><br/>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </div>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-8 px-6 py-3 bg-red-600 hover:bg-red-700 font-bold rounded-xl text-white">
            Очистить кэш и перезапустить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// =====================================================================
// КОНТАКТЫ
// =====================================================================
const TG_URL = "https://t.me/Doc_Bratus";
const MAX_URL = "https://max.ru/u/f9LHodD0cOIYP3iUbW0GfaIq2jl4-wySOhNgUIDmhHStp5VsUGOHNSoeUzE";

// =====================================================================
// БЕЗОПАСНАЯ БАЗА ДАННЫХ (LOCAL STORAGE)
// =====================================================================
const safeLS = {
  set: (key: string, val: any): boolean => {
    try { 
      localStorage.setItem(key, JSON.stringify(val)); 
      return true; 
    } catch (e) { 
      return false; 
    }
  },
  get: (key: string, def: any): any => {
    try { 
      const v = localStorage.getItem(key); 
      return v ? JSON.parse(v) : def; 
    } catch (e) { 
      return def; 
    }
  }
};

const getStorageSizeMB = (): string => {
  try {
    if (!window.localStorage) return "0.00";
    let total = 0;
    for (const x in window.localStorage) {
      if (Object.prototype.hasOwnProperty.call(window.localStorage, x)) {
        total += ((window.localStorage[x].length + x.length) * 2);
      }
    }
    return (total / 1024 / 1024).toFixed(2);
  } catch (e) {
    return "0.00"; 
  }
};

const dbOps = {
  saveDraft: (data: any) => safeLS.set('docbratus_draft_stable', data),
  getDraft: () => safeLS.get('docbratus_draft_stable', null),
  saveProtocol: (data: any) => {
    const existing = safeLS.get('docbratus_archive_stable', []);
    const updated = [data, ...existing.filter((p: any) => p && p.id !== data.id)];
    return safeLS.set('docbratus_archive_stable', updated);
  },
  getProtocols: () => {
    const items = safeLS.get('docbratus_archive_stable', []);
    return (Array.isArray(items) ? items : []).filter((i: any) => i && typeof i === 'object' && i.id).sort((a: any, b: any) => (b.savedAt || 0) - (a.savedAt || 0));
  },
  deleteProtocol: (id: string) => {
    const existing = safeLS.get('docbratus_archive_stable', []);
    return safeLS.set('docbratus_archive_stable', existing.filter((p: any) => p && p.id !== id));
  },
  incrementUsage: (id: string) => {
    const existing = safeLS.get('docbratus_archive_stable', []);
    const updated = existing.map((p: any) => p && p.id === id ? { ...p, usageCount: (p.usageCount || 0) + 1 } : p);
    safeLS.set('docbratus_archive_stable', updated);
  }
};

// =====================================================================
// КОМПОНЕНТ: ImageUploader
// =====================================================================
interface ImageUploaderProps {
  value: string | null;
  onChange: (val: string | null) => void;
  label: string;
  textShift?: React.CSSProperties;
}

function ImageUploader({ value, onChange, label, textShift }: ImageUploaderProps) {
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedBase64 = await new Promise<string | null>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const maxDim = 400; 
            if (width > height && width > maxDim) {
              height = Math.round((height * maxDim) / width); width = maxDim;
            } else if (height > maxDim) {
              width = Math.round((width * maxDim) / height); height = maxDim;
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error("Canvas context is null"));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.5));
          };
          img.onerror = () => reject(new Error("Image Load Error"));
          img.src = ev.target?.result as string;
        };
        reader.onerror = () => reject(new Error("File Read Error"));
        reader.readAsDataURL(file);
      });
      onChange(compressedBase64);
    } catch(err) {
      console.error(err);
      onChange(null);
    }
    e.target.value = ''; 
  };

  const handleSaveToDevice = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!value) return;
    try {
      const res = await fetch(value);
      const blob = await res.blob();
      const file = new File([blob], `упражнение_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Фото упражнения' });
      } else {
        const link = document.createElement('a');
        link.href = value;
        link.download = `упражнение_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Ошибка при сохранении фото:", err);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer group box-border">
      {value ? (
        <>
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 print:hidden" data-html2canvas-ignore="true">
            <button onClick={handleSaveToDevice}
              className="text-white text-[8px] font-bold uppercase bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded shadow relative z-[60] flex items-center gap-1">
              <Download size={10} /> В ФОТО
            </button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
              className="text-white text-[8px] font-bold uppercase bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded shadow relative z-[60] flex items-center gap-1">
              <Trash2 size={10} /> УДАЛИТЬ
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center text-center px-1 opacity-50 pointer-events-none">
          <ImagePlus size={16} strokeWidth={1.5} className="text-blue-500 mb-1" />
          <span className="text-slate-600 font-bold uppercase tracking-wider leading-tight" style={{ fontSize: '6px' }}>
            <span style={textShift}>{label}</span>
          </span>
        </div>
      )}
      {!value && (
        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" onChange={handleChange} />
      )}
    </div>
  );
}

// =====================================================================
// КОМПОНЕНТ: Editable text
// =====================================================================
interface EditableProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  inline?: boolean;
}

function Editable({ value, onChange, className = '', multiline = false, placeholder = '', style = {}, inline = false }: EditableProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { 
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || ''; 
    }
  }, [value]);
  const handleBlur = () => { 
    if (ref.current) {
      onChange(ref.current.innerHTML); 
    }
  };
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      className={`outline-none hover:bg-blue-50/40 focus:bg-blue-50 rounded transition-colors ${className} ${multiline && !inline ? 'whitespace-pre-wrap break-words' : ''}`}
      data-placeholder={placeholder}
      style={{ ...style }}
    />
  );
}

// =====================================================================
// ШКАЛА ВАШ
// =====================================================================
interface VASScaleProps {
  textShift: React.CSSProperties;
}

function VASScale({ textShift }: VASScaleProps) {
  const vasIcons = [
    { v: 0, color: '#10b981', path: <><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.1}/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none"/></> },
    { v: 2, color: '#84cc16', path: <><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.1}/><path d="M8 15.5s1.5 1 4 1 4-1 4-1"/><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none"/></> },
    { v: 4, color: '#eab308', path: <><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.1}/><path d="M8 15h8"/><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none"/></> },
    { v: 6, color: '#f97316', path: <><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.1}/><path d="M8 16s1.5-1 4-1 4 1 4 1"/><circle cx="9" cy="9.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1.5" fill="currentColor" stroke="none"/></> },
    { v: 8, color: '#ef4444', path: <><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.1}/><path d="M8 16.5s1.5-2 4-2 4 2 4 2"/><path d="M7 8l2 1.5M17 8l-2 1.5"/><circle cx="9" cy="10.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1.5" fill="currentColor" stroke="none"/></> },
    { v: 10, color: '#be123c', path: <><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.1}/><circle cx="12" cy="16" r="2.5" fill="currentColor" stroke="none"/><path d="M7 8.5l3 3M10 8.5l-3 3M14 8.5l3 3M17 8.5l-3 3"/></> },
  ];
  return (
    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shrink-0 shadow-sm">
      <span className="font-black text-slate-800 uppercase tracking-wider mr-1.5" style={{ fontSize: '7.5px' }}>
        <span style={textShift}>Боль:</span>
      </span>
      {vasIcons.map((it, i) => (
        <div key={i} className="flex flex-col items-center justify-between" style={{ width: '25px', height: '32px' }}>
          <div style={{ color: it.color, display: 'flex', height: '16px' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {it.path}
            </svg>
          </div>
          <span className="font-black text-slate-700 mt-1.5" style={{ fontSize: '7px' }}>
            <span style={textShift}>{it.v}</span>
          </span>
        </div>
      ))}
      <span className="font-bold text-slate-400 italic ml-2" style={{ fontSize: '6.5px' }}>
        <span style={textShift}>отметить ✓ до и после</span>
      </span>
    </div>
  );
}

// =====================================================================
// КОМПОНЕНТ: QRCode
// =====================================================================
const QR_DATA = {
  'https://t.me/Doc_Bratus': {"n":25,"rows":["1111111000010111001111111","1000001010101100101000001","1011101010101000101011101","1011101010001101001011101","1011101000100011101011101","1000001001000100101000001","1111111010101010101111111","0000000010000001000000000","1000001011101111011001110","1010100011010011000011110","0100001011001001110001011","0100110011001011100101001","1011011001111000101000001","1001000010000011100100010","1000111111111011010111011","1011100010010010011101101","1010111101010111111110100","0000000010001010100010000","1111111000110101101010001","1000001001101011100010010","1011101001001111111110111","1011101001100001011000011","1011101000111100100001101","1000001000010010111110001","1111111010001111101001001"]},
  'https://max.ru/u/f9LHodD0cOIYP3iUbW0GfaIq2jl4-wySOhNgUIDmhHStp5VsUGOHNSoeUzE': {"n":37,"rows":["1111111000100001011111110111001111111","1000001010101001111010000010001000001","1011101010101110101011010011001011101","1011101010001000000011000111001011101","1011101000100111010110011100101011101","1000001000010000010011101000101000001","1111111010101010101010101010101111111","0000000011101111011010100001100000000","1000001011011110100001101010011001110","1010100000101010101000100101001111110","0100111011010111110000000111110001011","0011110110011100000100100010111010001","1111111100101001001001011000101101001","1011110010011101000011000001000101010","10010111000010011101011001101110111001","0110010110100110100010100000000101101","0101001011000001001111100111011010110","1001100100100010100111000011100101110","1100111101000110111100010001111000101","1010100110010101101010111000111111001","0000101111000000100001101101111010100","1110110110101111011101110001010010100","1011011110100111110010100011011111011","1100110000001010011100010001010111000","1101001001101000010101000001101110010","1110000101011110001011110110111101000","1010011110111011110011001001100110111","1010000010111000100000010000101011101","1000001101001011010011101010111110110","0000000010000100101100110001100010000","1111111001000101011110111110101010001","1000001001001100000000101001100010000","1011101001100011001000110101111110101","1011101001101010000101100100001000001","1011101000111000010011000010100000011","1000001001110111101110100000011011001","1111111010101010100001011100101100101"]},
};

interface QRCodeProps {
  value: string;
  size?: number;
}

function QRCode({ value, size = 55 }: QRCodeProps) {
  const data = QR_DATA[value as keyof typeof QR_DATA];
  if (!data) return null;
  const { n, rows } = data;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} style={{ shapeRendering: 'crispEdges' }}>
      {rows.map((row, rIdx) => {
        return row.split('').map((cell, cIdx) => {
          if (cell === '1') {
            return (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx}
                y={rIdx}
                width={1}
                height={1}
                fill="black"
              />
            );
          }
          return null;
        });
      })}
    </svg>
  );
}

// =====================================================================
// КАРТОЧКА УПРАЖНЕНИЯ
// =====================================================================
interface Exercise {
  id: string;
  imageCount: number;
  title: string;
  desc: string;
  dose: string;
  img1: string | null;
  img2: string | null;
  img3: string | null;
}

interface LayoutConfig {
  columns: number;
  cardHeight: number;
  imageHeight: number;
  textSizeMulti: number;
  showPatientName: boolean;
  showGoals: boolean;
  showLoads: boolean;
  showRedFlags: boolean;
  showRules: boolean;
  showTransition: boolean;
  globalShiftY: number;
  vasShiftY: number;
  footerShiftY: number;
}

interface ExerciseCardProps {
  ex: Exercise;
  index: number;
  onUpdate: (updated: Exercise) => void;
  onRemove: (id: string) => void;
  layout: LayoutConfig;
  textShift: React.CSSProperties;
  textShiftBlock: React.CSSProperties;
}

function ExerciseCard({ ex, index, onUpdate, onRemove, layout, textShift, textShiftBlock }: ExerciseCardProps) {
  const num = (index + 1).toString().padStart(2, '0');
  const { imageHeight = 120, textSizeMulti = 1.2, globalShiftY = -8 } = layout || {};
  const boxSize = Math.round(Math.max(22, 22 * textSizeMulti * 0.8));
  const numFontSize = Math.round(11 * textSizeMulti * 0.9);
  const titleFontSize = Math.round(9 * textSizeMulti);
  const descFontSize = Math.round(8 * textSizeMulti);
  const doseLabelSize = Math.round(6.5 * textSizeMulti);
  const doseValueSize = Math.round(8.5 * textSizeMulti);
  
  const imgCount = ex?.imageCount !== undefined ? ex.imageCount : 2;
  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col relative group box-border overflow-hidden animate-fade-in"
      style={{ pageBreakInside: 'avoid', breakInside: 'avoid', height: '100%' }}
    >
      <div className="absolute top-0 right-0 opacity-100 transition print:hidden z-10 flex items-center bg-white border-l border-b border-slate-200 rounded-bl-lg rounded-tr-xl shadow-sm overflow-hidden" data-html2canvas-ignore="true">
        <div className="flex items-center px-1 border-r border-slate-200 bg-slate-50">
          <ImagePlus size={10} className="text-slate-400 mr-1" />
          <button onClick={() => onUpdate({ ...ex, imageCount: 0 })} className={`px-1.5 py-1 text-[9px] font-bold ${imgCount === 0 ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>0</button>
          <button onClick={() => onUpdate({ ...ex, imageCount: 1 })} className={`px-1.5 py-1 text-[9px] font-bold ${imgCount === 1 ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>1</button>
          <button onClick={() => onUpdate({ ...ex, imageCount: 2 })} className={`px-1.5 py-1 text-[9px] font-bold ${imgCount === 2 ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>2</button>
          <button onClick={() => onUpdate({ ...ex, imageCount: 3 })} className={`px-1.5 py-1 text-[9px] font-bold ${imgCount === 3 ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>3</button>
        </div>
        <button onClick={() => onRemove(ex.id)}
          className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white p-1.5 transition"
          title="Удалить">
          <Trash2 size={11} />
        </button>
      </div>

      <div className="flex items-start gap-1.5 mb-1.5 shrink-0 w-full">
        <div className="shrink-0 flex items-center justify-center bg-blue-600 rounded-md" style={{ width: `${boxSize}px`, height: `${boxSize}px` }}>
          <span style={{
            transform: `translateY(${globalShiftY}px)`, display: 'inline-block',
            color: 'white', fontWeight: 900, fontSize: `${numFontSize}px`, lineHeight: 1
          }}>
            {num}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ minHeight: `${boxSize}px` }}>
          <Editable
            value={ex.title}
            onChange={(v) => onUpdate({ ...ex, title: v })}
            className="font-black text-slate-900 uppercase outline-none break-words block"
            style={{ fontSize: `${titleFontSize}px`, lineHeight: '1.2', transform: `translateY(${globalShiftY}px)` }}
          />
        </div>
      </div>

      {imgCount <= 2 ? (
        <div className="flex-1 flex gap-2.5 mb-1.5 min-h-0 w-full items-start">
          {imgCount > 0 && (
            <div className="flex items-center gap-1.5 shrink-0 justify-start" style={{ height: `${imageHeight}px`, maxWidth: imgCount === 1 ? '45%' : '65%' }}>
              <div className="h-full aspect-square relative shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                <ImageUploader value={ex.img1} onChange={(v) => onUpdate({ ...ex, img1: v })} label={imgCount === 1 ? "ФОТО" : "СТАРТ"} textShift={textShift} />
              </div>
              {imgCount === 2 && (
                <>
                  <ArrowRight size={14} className="text-slate-300 stroke-[3] shrink-0" />
                  <div className="h-full aspect-square relative shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    <ImageUploader value={ex.img2} onChange={(v) => onUpdate({ ...ex, img2: v })} label="ФИНИШ" textShift={textShift} />
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex-1 relative min-w-0 h-full">
            <div className="absolute inset-0 overflow-hidden">
              <Editable
                value={ex.desc}
                onChange={(v) => onUpdate({ ...ex, desc: v })}
                className="text-slate-600 font-medium h-full outline-none block"
                style={{ fontSize: `${descFontSize}px`, lineHeight: '1.3', transform: `translateY(${globalShiftY}px)` }}
                multiline
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col mb-1.5 min-h-0 w-full">
          {imgCount > 0 && (
            <div className="flex items-center gap-1.5 mb-2 shrink-0 justify-start" style={{ height: `${imageHeight}px` }}>
              <div className="h-full aspect-square relative shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                <ImageUploader value={ex.img1} onChange={(v) => onUpdate({ ...ex, img1: v })} label="СТАРТ" textShift={textShift} />
              </div>
              {imgCount >= 2 && <ArrowRight size={14} className="text-slate-300 stroke-[3] shrink-0" />}
              {imgCount >= 2 && (
                <div className="h-full aspect-square relative shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                  <ImageUploader value={ex.img2} onChange={(v) => onUpdate({ ...ex, img2: v })} label={imgCount === 3 ? "ШАГ 2" : "ФИНИШ"} textShift={textShift} />
                </div>
              )}
              {imgCount === 3 && <ArrowRight size={14} className="text-slate-300 stroke-[3] shrink-0" />}
              {imgCount === 3 && (
                <div className="h-full aspect-square relative shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                  <ImageUploader value={ex.img3} onChange={(v) => onUpdate({ ...ex, img3: v })} label="ФИНИШ" textShift={textShift} />
                </div>
              )}
            </div>
          )}
          <div className="flex-1 relative min-h-0 w-full">
            <div className="absolute inset-0 overflow-hidden">
              <Editable
                value={ex.desc}
                onChange={(v) => onUpdate({ ...ex, desc: v })}
                className="text-slate-600 font-medium h-full outline-none block"
                style={{ fontSize: `${descFontSize}px`, lineHeight: '1.3', transform: `translateY(${globalShiftY}px)` }}
                multiline
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-600 rounded-md w-full box-border px-1.5 py-1 min-h-[22px] flex items-center overflow-hidden mt-auto shrink-0">
        <div className="flex w-full items-baseline">
          <span style={{ 
            color: 'rgba(255,255,255,0.7)', fontWeight: 'bold', textTransform: 'uppercase', 
            fontSize: `${doseLabelSize}px`, marginRight: '4px' 
          }}>
            <span style={textShift}>Доза:</span>
          </span>
          <div className="flex-1 min-w-0">
            <Editable
              inline={true}
              value={ex.dose}
              onChange={(v) => onUpdate({ ...ex, dose: v })}
              className="font-black text-white uppercase outline-none break-words inline-block"
              style={{ fontSize: `${doseValueSize}px`, transform: `translateY(${globalShiftY}px)` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ФУНКЦИИ ДЛЯ АВТО-ФОРМАТИРОВАНИЯ ТЕКСТА
// =====================================================================

const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/ig, ' ');
};

const formatBlockText = (str: string, emoji?: string): string => {
  if (!str || typeof str !== 'string') return '';
  let prepared = str;
  if (!prepared.includes('\n') && !prepared.includes('<br')) {
      prepared = prepared.replace(/\.\s+(?=[А-ЯЁA-Z])/g, '.\n');
  }
  let res = prepared.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  res = res.replace(/[*#]/g, ''); // Убираем оставшиеся одинарные звездочки и решетки
  res = res.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '');
  let lines = res.split(/\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
  const targetEmojis = ['🎯', '🚨', '📌', '✅', '📈', '👉', '✔️', '❗️', '⚠️', '•', '-', '✓'];
  
  lines = lines.map((line, i) => {
    let clean = line.replace(/^(\d+\.|[-*•✓→>])\s*/, ''); 
    
    // Replace prefix emojis if they exist so we can guarantee our icon logic
    const existingEmoji = targetEmojis.find(e => clean.startsWith(e));
    if (existingEmoji) {
      clean = clean.substring(existingEmoji.length).trim();
    }
    
    if (emoji) {
      clean = `${emoji} ${clean}`;
    } else if (existingEmoji) {
      clean = `${existingEmoji} ${clean}`;
    }
    
    return `<div style="margin-top: ${i === 0 ? '0' : '4px'}">${clean}</div>`;
  });
  return lines.join('');
};

const formatExerciseText = (str: string): string => {
  if (!str || typeof str !== 'string') return '';
  let prepared = str;
  prepared = prepared.replace(/(Исходное положение:|И\.п\.:|Выполнение:|Описание:|Техника:|Важно:|Внимание:|Контроль:|Ошибки:|Уровень\s\d+:?|Этап\s\d+:?|Шаг\s\d+:?)/gi, '\n$1');
  if (!prepared.includes('\n') && !prepared.includes('<br')) {
      prepared = prepared.replace(/\.\s+(?=[А-ЯЁA-Z])/g, '.\n');
  }
  let res = prepared.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  res = res.replace(/[*#]/g, ''); // Убираем оставшиеся одинарные звездочки и решетки
  res = res.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '');
  const lines = res.split(/\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
  
  return lines.map((line, i) => {
    let cleanLine = line;
    const colonIndex = cleanLine.indexOf(':');
    if (!cleanLine.includes('<b>') && colonIndex > 0 && colonIndex <= 45) {
        const prefix = cleanLine.substring(0, colonIndex);
        if (!prefix.includes('.') && !prefix.includes('!')) {
            cleanLine = `<b>${prefix}:</b>` + cleanLine.substring(colonIndex + 1);
        }
    }
    if (!cleanLine.includes('<b>')) {
        cleanLine = cleanLine.replace(/^(Уровень\s\d+|Этап\s\d+|Шаг\s\d+)/iu, '<b>$1</b>');
    }
    if (cleanLine.match(/^[-*•✓→]\s/)) {
        cleanLine = cleanLine.replace(/^[-*•✓→]\s*/, '<span style="color:#3b82f6;font-weight:900;font-size:1.1em;">•</span> ');
    }
    const isLevelHeader = cleanLine.toLowerCase().includes('<b>уровень') || cleanLine.toLowerCase().includes('<b>этап') || cleanLine.toLowerCase().includes('<b>шаг');
    const marginTop = i === 0 ? '0' : (isLevelHeader ? '8px' : '4px');
    return `<div style="margin-top: ${marginTop}">${cleanLine}</div>`;
  }).join('');
};

// =====================================================================
// ЭКРАН ИСТОРИИ ПРОТОКОЛОВ 
// =====================================================================
interface HistoryScreenProps {
  history: any[];
  onLoad: (protocol: any) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function HistoryScreen({ history, onLoad, onDelete, onClose }: HistoryScreenProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const safeHistory = Array.isArray(history) ? history.filter(h => h && typeof h === 'object' && h.id) : [];
  
  const groupedHistory = safeHistory.reduce((acc: { [key: string]: any[] }, h) => {
    const name = h.patientName || 'Без имени';
    if (!acc[name]) acc[name] = [];
    acc[name].push(h);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-slate-100 z-[90] overflow-auto animate-fade-in">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-black text-slate-900">Шаблоны и Архив</h1>
        </div>

        {safeHistory.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Folder size={48} className="mx-auto mb-3 opacity-30" />
            <p>Архив пока пуст</p>
            <p className="text-sm mt-2">Заполните протокол и нажмите «В локальный архив»</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(Object.entries(groupedHistory) as [string, any[]][]).map(([patientName, protocols]) => (
              <div key={patientName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                  onClick={() => setExpandedPatient(expandedPatient === patientName ? null : patientName)}
                >
                  <div className="flex items-center gap-3">
                    <Folder className={`transition-colors ${expandedPatient === patientName ? 'text-blue-600' : 'text-blue-400'}`} size={24} />
                    <span className="font-bold text-lg text-slate-900">{patientName}</span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      {protocols.length} шт.
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {expandedPatient === patientName ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {expandedPatient === patientName && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-3 flex flex-col gap-2">
                    {protocols.map(h => {
                      const dateStr = new Date(h.savedAt || Date.now()).toLocaleDateString('ru-RU');
                      return (
                        <div key={h.id} className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between shadow-sm hover:border-blue-300 transition">
                          <div className="flex-1">
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                              <Calendar size={14} className="text-blue-500" />
                              {dateStr}
                            </div>
                            <div className="text-xs font-medium text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{h.stage || 'Этап не указан'}</span>
                              <span>·</span>
                              <span>{h.exercises?.length || 0} упр.</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => onLoad(h)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition cursor-pointer">
                              Открыть
                            </button>
                            {confirmDeleteId === h.id ? (
                              <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg">
                                <button onClick={() => onDelete(h.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded hover:bg-red-600 cursor-pointer">Удалить?</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Отмена</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(h.id)} className="p-2 hover:bg-red-100 text-red-500 rounded transition cursor-pointer">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// ГЛАВНЫЙ КОМПОНЕНТ APP
// =====================================================================
function AppContent() {
  const defaultProtocolState = {
    patientName: 'Павлова Наталья Юрьевна',
    diagnosis: 'СПОНДИЛОЛИСТЕЗ L5. ЭКСТРУЗИИ ДИСКОВ',
    stage: 'Хронический период (стабилизация)',
    regime: 'Амбулаторный (1-2 раза в день)',
    
    goalsTitle: 'Цели этапа',
    goals: formatBlockText('Укрепление корсета: поперечная мышца живота, многораздельные мышцы.\nТолерантность: повышение адаптации к динамическим нагрузкам.\nБиомеханика: обучение и автоматизация стереотипа наклона (Hip Hinge).', '🎯'),
    
    loadsTitle: 'Разрешенные нагрузки',
    loads: formatBlockText('Неделя 1-2: Ходьба в ортезе, частичная опора 50%.\nНеделя 3-4: Полная опора, отказ от костылей.\nНеделя 5-6: Бассейн, велотренажер без сопротивления.', '📈'),

    redFlagsTitle: 'Красные флаги — стоп и к врачу',
    redFlags: formatBlockText('Периферизация боли: спуск боли или онемения вниз по ноге.\nНеврология: появление слабости в стопе или тазовых нарушений.\nБолевой синдром: сохранение локальной боли >4/10 по ВАШ при нагрузке.', '🚨'),
    
    rulesTitle: 'Правила выполнения',
    rules: formatBlockText('Позиция: поясничный отдел строго в нейтральном положении.\nОграничения: полностью исключить чистые разгибания и скручивания.\nПаттерн: использование Hip Hinge для всех бытовых наклонов.', '📌'),
    
    transitionTitle: 'Когда переходить дальше',
    transition: formatBlockText('Адаптация: безболезненная переносимость всех упражнений.\nХодьба: способность пройти 5 км без дискомфорта.\nНагрузка: подъем 5-10 кг с пола с правильной техникой.', '✅'),
    
    rule24Title: '⏱ Правило 24 часов: ',
    rule24Text: 'Если боль усилилась и держится больше суток — снизьте количество повторов на 30-50% или сообщите врачу.',
    whenTitle: '📅 Когда выполнять: ',
    whenText: '1-2 раза в день, желательно в одно время. Утро — разогрев, вечер — закрепление навыка. Между едой и тренировкой — 1 час.',
    
    exercises: [
      {
        id: 'ex_init_0', imageCount: 2,
        title: 'ТАЗОВЫЕ ЧАСЫ',
        desc: formatExerciseText('Исходное положение: лежа на спине, поясницу прижать к кушетке. Выполнение: поднять таз и выполнять движение тазом, рисуя знак бесконечности. Важно: дышите ровно.'),
        dose: '10-15 повторений, 3 подхода',
        img1: null, img2: null, img3: null
      },
      {
        id: 'ex_init_1', imageCount: 2,
        title: 'МЁРТВЫЙ ЖУК (DEAD BUG)',
        desc: formatExerciseText('Лёжа на спине, руки подняты, ноги согнуты под 90°. Поочерёдное опускание разноимённой руки и выпрямление ноги, не касаясь пола. Внимание: поясница плотно и стабильно прижата к полу.'),
        dose: '10-12 повторений, 3 подхода',
        img1: null, img2: null, img3: null
      },
      {
        id: 'ex_init_2', imageCount: 2,
        title: 'СУПЕРМЕН (BIRD-DOG)',
        desc: formatExerciseText('Уровень 1: Вытяжение только одной руки или ноги, удерживая баланс. Уровень 2: Одновременное вытяжение разноимённых руки и ноги до прямой линии. - Без поворота таза. - Без прогиба в пояснице.'),
        dose: 'Удержание 3-5 сек, 10-12 повт, 3 подх',
        img1: null, img2: null, img3: null
      },
      {
        id: 'ex_init_3', imageCount: 2,
        title: 'ПРИСЕД У СТЕНЫ (WALL SIT)',
        desc: formatExerciseText('Спина плотно прижата к стене, поясница в нейтрали. Спуск до угла в коленях 60-90°. Изометрическое удержание позиции за счет квадрицепсов и ягодиц.'),
        dose: 'Удержание 30-45 сек, 3 подхода',
        img1: null, img2: null, img3: null
      }
    ]
  };

  const getSafeLayout = (saved: any): LayoutConfig => {
    if (!saved || typeof saved !== 'object') {
      return { 
        columns: 2, cardHeight: 68, imageHeight: 120, textSizeMulti: 1.2, 
        showPatientName: true, showGoals: true, showLoads: true, showRedFlags: true, showRules: true, showTransition: true,
        globalShiftY: -8, vasShiftY: 0, footerShiftY: 0 
      };
    }
    return {
      columns: Number(saved.columns) || 2,
      cardHeight: Number(saved.cardHeight) || 68,
      imageHeight: Number(saved.imageHeight) || 120,
      textSizeMulti: Number(saved.textSizeMulti) || 1.2,
      showPatientName: saved.showPatientName ?? true,
      showGoals: saved.showGoals ?? true,
      showLoads: saved.showLoads ?? true,
      showRedFlags: saved.showRedFlags ?? true,
      showRules: saved.showRules ?? true,
      showTransition: saved.showTransition ?? true,
      globalShiftY: Number(saved.globalShiftY) || -8,
      vasShiftY: Number(saved.vasShiftY) || 0,
      footerShiftY: Number(saved.footerShiftY) || 0
    };
  };

  const [syncStatus, setSyncStatus] = useState('saved'); 
  const [memUsage, setMemUsage] = useState(getStorageSizeMB());
  const [history, setHistory] = useState<any[]>([]);
  
  const [protocol, setProtocol] = useState<any>(() => {
    const saved = dbOps.getDraft(); 
    if (saved && saved.exercises) return { ...defaultProtocolState, ...saved };
    return defaultProtocolState;
  });
  
  const [layout, setLayout] = useState<LayoutConfig>(() => getSafeLayout(safeLS.get('docbratus_layout_stable', null)));

  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [importText, setImportText] = useState('');
  
  // Состояния для работы кнопки PDF
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [pdfReadyUrl, setPdfReadyUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');
  
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ text: string; onConfirm: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastSavedProtocol = useRef(JSON.stringify(protocol));

  // Очистка URL файла из памяти при закрытии
  useEffect(() => {
    return () => {
      if (pdfReadyUrl) URL.revokeObjectURL(pdfReadyUrl);
    };
  }, [pdfReadyUrl]);

  useEffect(() => { safeLS.set('docbratus_layout_stable', layout); }, [layout]);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshHistory = () => {
    const h = dbOps.getProtocols();
    setHistory(Array.isArray(h) ? h : []);
    setMemUsage(getStorageSizeMB());
  };

  useEffect(() => {
    refreshHistory(); 
  }, []);

  // АВТОСОХРАНЕНИЕ
  useEffect(() => {
    const currentStr = JSON.stringify(protocol);
    if (currentStr === lastSavedProtocol.current) return;

    setSyncStatus('saving');
    const timer = setTimeout(() => {
      const saveResult = dbOps.saveDraft(protocol);
      lastSavedProtocol.current = currentStr;
      
      if (saveResult === false) {
        setSyncStatus('error');
        showToast('Память заполнена! Фото не сохранены в черновик.', 'error');
      } else {
        setSyncStatus('saved');
      }
      setMemUsage(getStorageSizeMB());
    }, 1500);
    return () => clearTimeout(timer);
  }, [protocol]);

  const saveProtocolToArchive = () => {
    if (layout.showPatientName && !protocol.patientName?.trim()) {
      showToast('Укажите ФИО пациента, чтобы сохранить', 'error'); return;
    }
    const savedName = stripHtml(layout.showPatientName && protocol.patientName?.trim() ? protocol.patientName : 'Обезличенный протокол');
    const newId = 'prot_' + Date.now();
    
    // ПРИНУДИТЕЛЬНО ВЫРЕЗАЕМ ФОТО ПЕРЕД СОХРАНЕНИЕМ В АРХИВ (Для экономии)
    const archiveEntry = { 
      ...protocol, 
      patientName: savedName, 
      savedAt: Date.now(), 
      id: newId,
      exercises: (protocol.exercises || []).map((ex: any) => ({ ...ex, img1: null, img2: null, img3: null }))
    };
    
    const isSaved = dbOps.saveProtocol(archiveEntry);
    refreshHistory();
    if (isSaved) {
      showToast(`Протокол «${savedName}» сохранён в Архив (Текст)`);
    } else {
      showToast('Сбой: Память переполнена. Удалите старые.', 'error');
    }
  };

  const deleteFromHistory = (id: string) => {
    dbOps.deleteProtocol(id);
    refreshHistory();
  };

  // МАГИЯ ЗАГРУЗКИ (ИМПОРТ PDF С ВШИТЫМ КОДОМ ИЛИ JSON)
  const importProtocolFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let jsonStr = '';
      
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(buffer);
        
        const startMarker = '---------DOCBRATUS_DATA_START---------';
        const endMarker = '---------DOCBRATUS_DATA_END---------';
        const startIdx = text.lastIndexOf(startMarker);
        const endIdx = text.lastIndexOf(endMarker);
        
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = text.substring(startIdx + startMarker.length, endIdx).trim();
        } else {
          throw new Error("В этом PDF нет скрытого кода. Выберите файл, созданный в этой версии приложения.");
        }
      } else {
        jsonStr = await file.text();
      }

      const parsed = JSON.parse(jsonStr);
      if (!parsed.diagnosis && !parsed.exercises) throw new Error("Неверный формат");
      
      if (parsed.goals) parsed.goals = formatBlockText(parsed.goals, '🎯');
      if (parsed.loads) parsed.loads = formatBlockText(parsed.loads, '📈');
      if (parsed.redFlags) parsed.redFlags = formatBlockText(parsed.redFlags, '🚨');
      if (parsed.rules) parsed.rules = formatBlockText(parsed.rules, '📌');
      if (parsed.transition) parsed.transition = formatBlockText(parsed.transition, '✅');

      if (parsed.exercises && Array.isArray(parsed.exercises)) {
        parsed.exercises = parsed.exercises.map((ex: any, i: number) => ({
          ...ex,
          id: ex.id || 'ex_imp_' + Date.now() + '_' + i,
          imageCount: ex.imageCount !== undefined ? ex.imageCount : 2,
          desc: (!ex.desc.includes('<b>') && !ex.desc.includes('<div')) ? formatExerciseText(ex.desc) : ex.desc,
          img1: ex.img1 || null,
          img2: ex.img2 || null,
          img3: ex.img3 || null,
        }));
      }

      setProtocol({ ...defaultProtocolState, ...parsed });
      showToast(`Успешно восстановлено из ${file.name.endsWith('.pdf') ? 'PDF' : 'файла'}!`);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Ошибка при чтении файла. Неверный формат.', 'error');
    }
    
    e.target.value = ''; 
  };

  const updateExercise = (id: string, updated: Exercise) => {
    setProtocol({ ...protocol, exercises: protocol.exercises.map((e: any) => e.id === id ? updated : e) });
  };

  const removeExercise = (id: string) => {
    setProtocol({ ...protocol, exercises: protocol.exercises.filter((e: any) => e.id !== id) });
  };

  const addExercise = () => {
    const currentExercises = Array.isArray(protocol.exercises) ? protocol.exercises : [];
    setProtocol({
      ...protocol,
      exercises: [...currentExercises, {
        id: 'ex_' + Date.now(), imageCount: 2, title: 'НОВОЕ УПРАЖНЕНИЕ', desc: 'Описание', dose: 'ДОЗА', img1: null, img2: null, img3: null
      }]
    });
    setTimeout(() => window.scrollBy({ top: 300, behavior: 'smooth' }), 50);
  };

  const loadFromHistory = (h: any) => {
    const { id, savedAt, ...dataToLoad } = h;
    setProtocol({ ...defaultProtocolState, ...dataToLoad });
    setShowHistory(false);
    showToast(`Шаблон загружен (без фото)`);
  };

  const newProtocol = () => {
    setConfirmDialog({
      text: 'Очистить форму ввода? Несохраненные данные будут потеряны.',
      onConfirm: () => {
        setProtocol(defaultProtocolState);
        showToast('Форма очищена');
        setConfirmDialog(null);
      }
    });
  };

  const applyImportText = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.diagnosis && !parsed.exercises) throw new Error("Неверный формат JSON");
      
      applyParsedData(parsed);
    } catch (e: any) {
      if (e.name === 'SyntaxError') {
        // Fallback to AI generation if JSON is invalid
        generateAIProtocol();
      } else {
        showToast('Ошибка при чтении кода. Попробуйте сгенерировать через ИИ.', 'error');
      }
    }
  };

  const applyParsedData = (parsed: any) => {
    const blocksParams = [
      { key: 'goals', icon: '🎯' },
      { key: 'loads', icon: '📈' },
      { key: 'redFlags', icon: '🚨' },
      { key: 'rules', icon: '📌' },
      { key: 'transition', icon: '✅' }
    ];

    blocksParams.forEach(({ key, icon }) => {
      if (parsed[key] && String(parsed[key]).trim() !== '') {
        parsed[key] = formatBlockText(parsed[key], icon);
      } else {
        parsed[key] = ''; // Clear out missing blocks so they don't fallback to defaults
      }
    });

    if (parsed.exercises && Array.isArray(parsed.exercises)) {
      parsed.exercises = parsed.exercises.map((ex: any, i: number) => ({
        ...ex,
        title: ex.title || ex.name || 'БЕЗ НАЗВАНИЯ',
        id: ex.id || 'ex_imp_' + Date.now() + '_' + i,
        imageCount: ex.imageCount !== undefined ? ex.imageCount : 2,
        desc: formatExerciseText(ex.desc || ''),
        img1: ex.img1 || null,
        img2: ex.img2 || null,
        img3: ex.img3 || null,
      }));
    }

    const newProtocol = { ...defaultProtocolState, ...parsed };
    setProtocol(newProtocol);
    
    // Auto-hide empty blocks
    setLayout((prevLayout) => ({
      ...prevLayout,
      showPatientName: !!newProtocol.patientName,
      showGoals: !!newProtocol.goals,
      showLoads: !!newProtocol.loads,
      showRedFlags: !!newProtocol.redFlags,
      showRules: !!newProtocol.rules,
      showTransition: !!newProtocol.transition,
    }));

    setShowImportModal(false);
    setImportText('');
    showToast(`Успешно загружено! Найдено упражнений: ${parsed.exercises?.length || 0}`, 'success');
  };

  const generateAIProtocol = async () => {
    if (!importText.trim()) return showToast('Введите текст или JSON код для генерации', 'error');
    setIsGeneratingAI(true);
    showToast('ИИ анализирует и дополняет протокол...', 'success');
    
    try {
      const resp = await fetch('/api/parseProtocol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input: importText })
      });
      
      if (!resp.ok) {
        throw new Error('Ошибка при обращении к серверу ИИ');
      }
      
      const parsed = await resp.json();
      applyParsedData(parsed);
      
    } catch (e: any) {
      console.error(e);
      showToast('Не удалось сгенерировать протокол. Попробуйте снова или измените текст.', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // ==============================================================================
  // ЭКСПОРТ В GOOGLE DOCS
  // ==============================================================================
  const exportToGoogleDocs = async () => {
    try {
      if (isSaving) return;
      setIsSaving(true);
      showToast('Подключение к Google Docs...', 'success');
      
      let token = await getAccessToken();
      if (!token) {
        showToast('Авторизация Google...', 'success');
        const result = await googleSignIn();
        token = result?.accessToken || null;
      }
      
      if (!token) {
        throw new Error('Не удалось получить доступ');
      }

      showToast('Создание документа...', 'success');
      
      const title = stripHtml(protocol.patientName || 'Протокол') + ' - DOCBRATUS';
      const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title })
      });
      
      if (!createRes.ok) throw new Error('Ошибка создания документа');
      const doc = await createRes.json();
      const documentId = doc.documentId;
      
      let content = `ПРОТОКОЛ РЕАБИЛИТАЦИИ\n\n`;
      content += `Пациент: ${stripHtml(protocol.patientName) || ''}\n`;
      content += `Диагноз: ${stripHtml(protocol.diagnosis) || ''}\n`;
      content += `Этап: ${stripHtml(protocol.stage) || ''}\n`;
      content += `Режим: ${stripHtml(protocol.regime) || ''}\n\n`;
      
      if (layout.showGoals && protocol.goals) {
        content += `${stripHtml(protocol.goalsTitle || 'ЦЕЛИ ЭТАПА')}:\n${stripHtml(protocol.goals)}\n\n`;
      }
      if (layout.showLoads && protocol.loads) {
        content += `${stripHtml(protocol.loadsTitle || 'РАЗРЕШЕННЫЕ НАГРУЗКИ')}:\n${stripHtml(protocol.loads)}\n\n`;
      }
      if (layout.showRedFlags && protocol.redFlags) {
        content += `${stripHtml(protocol.redFlagsTitle || 'КРАСНЫЕ ФЛАГИ')}:\n${stripHtml(protocol.redFlags)}\n\n`;
      }
      if (layout.showRules && protocol.rules) {
        content += `${stripHtml(protocol.rulesTitle || 'ПРАВИЛА ВЫПОЛНЕНИЯ')}:\n${stripHtml(protocol.rules)}\n\n`;
      }
      if (layout.showTransition && protocol.transition) {
        content += `${stripHtml(protocol.transitionTitle || 'КОГДА ПЕРЕХОДИТЬ ДАЛЬШЕ')}:\n${stripHtml(protocol.transition)}\n\n`;
      }
      
      content += `УПРАЖНЕНИЯ:\n\n`;
      const exercises = Array.isArray(protocol.exercises) ? protocol.exercises : [];
      exercises.forEach((ex: any, i: number) => {
         content += `${i+1}. ${ex.title}\n`;
         if (ex.levelText) content += `Уровень: ${stripHtml(ex.levelText)}\n`;
         if (ex.startPosition) content += `Исходное положение: ${stripHtml(ex.startPosition)}\n`;
         if (ex.execution) content += `Выполнение: ${stripHtml(ex.execution)}\n`;
         if (ex.important) content += `Важно: ${stripHtml(ex.important)}\n`;
         if (ex.dosage) content += `Дозировка: ${stripHtml(ex.dosage)}\n`;
         content += `\n`;
      });
      content += `КОНТАКТЫ:\nТелеграм: @Doc_Bratus\nТелефон: +7 965 761-65-43\n`;

      await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content
              }
            }
          ]
        })
      });

      showToast('Документ успешно создан!', 'success');
      window.open(`https://docs.google.com/document/d/${documentId}/edit`, '_blank');
      
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Ошибка экспорта в Google Docs', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ==============================================================================
  // ЭКСПОРТ В GOOGLE DRIVE
  // ==============================================================================
  const exportToGoogleDrive = async () => {
    try {
      if (isSaving) return;
      setIsSaving(true);
      showToast('Подключение к Google Drive...', 'success');
      
      let token = await getAccessToken();
      if (!token) {
        showToast('Авторизация Google...', 'success');
        const result = await googleSignIn();
        token = result?.accessToken || null;
      }
      
      if (!token) {
        throw new Error('Не удалось получить доступ');
      }

      showToast('Сохранение файла в Google Drive...', 'success');
      
      const title = stripHtml(protocol.patientName || 'Протокол') + ' - DOCBRATUS';
      const metadata = {
        name: `${title}.docbratus`,
        mimeType: 'application/json'
      };
      
      const fileContent = JSON.stringify(protocol, null, 2);
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([fileContent], { type: 'application/json' }));

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.text();
        console.error('Google Drive Upload Error:', errorData);
        throw new Error('Ошибка сохранения файла в Google Drive');
      }
      
      const file = await uploadRes.json();

      showToast('Успешно сохранено в Google Drive!', 'success');
      window.open(`https://drive.google.com/file/d/${file.id}/view`, '_blank');
      
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Ошибка экспорта в Google Drive', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ==============================================================================
  // ЭТАП 2 и 3: ИСПРАВЛЕННАЯ ГЕНЕРАЦИЯ PDF (ПАТЧИ ВНЕДРЕНЫ)
  // ==============================================================================
  const generateSmartPDF = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    const originalStyles = new Map<Element, string | null>();
    const noAnimStyle = document.createElement('style');
    
    try {
      showToast('Генерируем PDF. Пожалуйста, подождите...', 'success');

      // Отключаем все анимации на время рендера, чтобы html2canvas не соскриншотил 
      // полупрозрачное состояние анимации (например, animate-fade-in при клонировании DOM)
      noAnimStyle.innerHTML = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(noAnimStyle);

      // =====================================================================
      // ФИКС OKLAB/OKLCH/COLOR-MIX ДЛЯ html2canvas
      // Подменяем computed-цвета на inline rgb(). Для 100% гарантии конвертации
      // в формат, понятный html2canvas, пропускаем сложные цвета через Canvas 2D.
      // =====================================================================
      const colorProperties = [
        'color', 'backgroundColor', 'borderColor',
        'borderTopColor', 'borderRightColor', 
        'borderBottomColor', 'borderLeftColor',
        'outlineColor', 'textDecorationColor',
        'fill', 'stroke', 'caretColor',
        'columnRuleColor', 'accentColor'
      ] as (keyof CSSStyleDeclaration)[];

      const canvasColor = document.createElement('canvas');
      canvasColor.width = 1;
      canvasColor.height = 1;
      const ctxColor = canvasColor.getContext('2d', { willReadFrequently: true });
      const forceRgb = (val: string) => {
        if (!val || val === 'none' || val === 'transparent' || val.includes('rgba(0, 0, 0, 0)')) return val;
        // Если браузер уже вернул rgb/rgba, возвращаем как есть для скорости
        if (val.startsWith('rgb')) return val;
        
        if (ctxColor) {
           ctxColor.clearRect(0,0,1,1);
           ctxColor.fillStyle = 'rgba(0,0,0,0)';
           ctxColor.fillStyle = val;
           ctxColor.fillRect(0,0,1,1);
           const d = ctxColor.getImageData(0,0,1,1).data;
           return `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${d[3] / 255})`;
        }
        return val;
      };

      const sanitizeElement = (el: Element) => {
        if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
        
        // Сохраняем оригинальный inline-стиль
        originalStyles.set(el, el.getAttribute('style') || '');
        
        // Получаем вычисленные браузером значения
        const computed = window.getComputedStyle(el);
        
        // Применяем как inline-стиль — html2canvas увидит rgb()
        colorProperties.forEach(prop => {
          const value = computed[prop] as string;
          if (value && value !== '' && value !== 'rgba(0, 0, 0, 0)') {
            if (value.includes('oklab') || value.includes('oklch') || 
                value.includes('color-mix') || value.includes('lab') || 
                value.includes('lch') || value.includes('hwb')) {
              el.style[prop as any] = forceRgb(value);
            } else {
              // Для остальных браузер обычно и так отдает rgb, но пропустим через 
              // функцию для надежности, если это не rgb.
              el.style[prop as any] = forceRgb(value);
            }
          }
        });
        
        // Также фоновые градиенты могут содержать oklch
        const bg = computed.backgroundImage;
        if (bg && bg !== 'none' && 
            (bg.includes('oklab') || bg.includes('oklch') || bg.includes('color-mix'))) {
          // Для градиентов — упрощаем до solid color
          el.style.backgroundImage = 'none';
        }
      };

      // Применяем ко всем элементам внутри всех .page
      const allPages = document.querySelectorAll('.page');
      const allElements: Element[] = [];
      allPages.forEach(page => {
        allElements.push(page);
        allElements.push(...Array.from(page.querySelectorAll('*')));
      });

      allElements.forEach(sanitizeElement);

      // Сборка PDF
      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
      const scaleValue = window.innerWidth < 1024 ? 1.5 : 2;

      const pages = Array.from(document.querySelectorAll('.page'));

      for (let i = 0; i < pages.length; i++) {
        const el = pages[i] as HTMLElement;
        const canvas = await html2canvas(el, {
          scale: scaleValue,
          useCORS: true,
          allowTaint: true, 
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        if (i > 0) pdf.addPage('a4', 'l');
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
      }

      const fname = stripHtml(protocol.patientName || 'Протокол').replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_');
      const fNameReady = `Протокол_${fname}.pdf`;
      
      // Вшивка JSON (Стеганография)
      const pdfArrayBuffer = pdf.output('arraybuffer');
      const jsonPayload = JSON.stringify(protocol);
      const stegoStr = `\n---------DOCBRATUS_DATA_START---------\n${jsonPayload}\n---------DOCBRATUS_DATA_END---------\n`;
      const stegoBuffer = new TextEncoder().encode(stegoStr);
      
      const merger = new Uint8Array(pdfArrayBuffer.byteLength + stegoBuffer.byteLength);
      merger.set(new Uint8Array(pdfArrayBuffer), 0);
      merger.set(stegoBuffer, pdfArrayBuffer.byteLength);
      
      const finalBlob = new Blob([merger], { type: 'application/pdf' });
      
      // Открываем модальное окно с прямой ссылкой
      const url = URL.createObjectURL(finalBlob);
      setPdfFileName(fNameReady);
      setPdfReadyUrl(url);

    } catch (err: any) {
      console.error("Ошибка при сборке PDF:", err);
      showToast(err.message || 'Ошибка при сборке PDF. Попробуйте еще раз.', 'error');
    } finally {
      if (noAnimStyle.parentNode) {
        noAnimStyle.parentNode.removeChild(noAnimStyle);
      }

      // Восстанавливаем оригинальные inline-стили
      originalStyles.forEach((originalStyle, el) => {
        if (originalStyle) {
          el.setAttribute('style', originalStyle);
        } else {
          el.removeAttribute('style');
        }
      });
      originalStyles.clear();
      setIsSaving(false);
    }
  };

  const textShift = { display: 'inline-block', transform: `translateY(${layout.globalShiftY}px)` };
  const textShiftBlock = { display: 'block', transform: `translateY(${layout.globalShiftY}px)` };
  const vasShift = { display: 'inline-block', transform: `translateY(${layout.vasShiftY}px)` };
  const footerShift = { display: 'inline-block', transform: `translateY(${layout.footerShiftY}px)` };

  const safeColumns = Math.max(1, Number(layout?.columns) || 2);
  const exercisesPerPage = safeColumns * 2; 
  const allItems = Array.isArray(protocol?.exercises) ? protocol.exercises : []; 
  const chunks = [];
  
  if (exercisesPerPage > 0) {
    for (let i = 0; i < allItems.length; i += exercisesPerPage) {
      chunks.push(allItems.slice(i, i + exercisesPerPage));
    }
  }
  if (chunks.length === 0) chunks.push([]); 
  const totalPages = 1 + chunks.length; 

  return (
    <div className="min-h-screen bg-slate-300 py-8 print:p-0 print:bg-white flex flex-col items-center font-sans text-slate-900 gap-8 print:gap-0 relative">
      
      {/* МОДАЛЬНОЕ ОКНО ДЛЯ ПРЯМОГО СКАЧИВАНИЯ PDF */}
      {pdfReadyUrl && (
        <div className="fixed inset-0 bg-black/80 z-[400] flex items-center justify-center p-4 print:hidden backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center flex flex-col items-center transform transition-all">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
               <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">PDF Готов!</h2>
            <p className="text-slate-600 mb-8 font-medium">Умный документ со вшитыми данными успешно сформирован. Нажмите кнопку ниже, чтобы сохранить его.</p>
            
            <a 
              href={pdfReadyUrl} 
              download={pdfFileName} 
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 shadow-xl shadow-blue-600/30 transition-all mb-4"
              onClick={() => {
                showToast('Файл скачивается...', 'success');
                setTimeout(() => setPdfReadyUrl(null), 1000);
              }}
            >
              <Download size={24} /> СКАЧАТЬ В ФАЙЛЫ
            </a>
            
            <button onClick={() => setPdfReadyUrl(null)} className="text-slate-500 font-bold hover:text-slate-800 transition p-2 cursor-pointer">
              Закрыть
            </button>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-900 mb-2">Внимание</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmDialog.text}</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmDialog(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 cursor-pointer">
                Отмена
              </button>
              <button onClick={confirmDialog.onConfirm}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 cursor-pointer">
                Очистить
              </button>
            </div>
          </div>
        </div>
      )}

      {showLayoutModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Settings className="text-blue-600" size={20} /> Настройки вёрстки
              </h2>
              <button onClick={() => setShowLayoutModal(false)} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-5">
              
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-col gap-4">
                <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider">Коррекция печати PDF (Фикс сдвигов)</h3>
                
                <div>
                  <label className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>1. Основной текст</span>
                    <span className="text-blue-600">{layout.globalShiftY} px</span>
                  </label>
                  <input type="range" min="-15" max="15" step="1"
                    value={layout.globalShiftY}
                    onChange={(e) => setLayout({...layout, globalShiftY: Number(e.target.value)})}
                    className="w-full accent-blue-600" />
                </div>
                
                <div>
                  <label className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>2. Шкала ВАШ (цифры)</span>
                    <span className="text-blue-600">{layout.vasShiftY} px</span>
                  </label>
                  <input type="range" min="-15" max="15" step="1"
                    value={layout.vasShiftY}
                    onChange={(e) => setLayout({...layout, vasShiftY: Number(e.target.value)})}
                    className="w-full accent-blue-600" />
                </div>

                <div>
                  <label className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>3. Подвал (Специальности)</span>
                    <span className="text-blue-600">{layout.footerShiftY} px</span>
                  </label>
                  <input type="range" min="-15" max="15" step="1"
                    value={layout.footerShiftY}
                    onChange={(e) => setLayout({...layout, footerShiftY: Number(e.target.value)})}
                    className="w-full accent-blue-600" />
                </div>
              </div>

              <div className="h-px bg-slate-200 my-1"></div>

              <div>
                <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-2 cursor-pointer">
                  <span>Отображать ФИО пациента</span>
                  <input 
                    type="checkbox" 
                    checked={layout.showPatientName} 
                    onChange={(e) => setLayout({...layout, showPatientName: e.target.checked})}
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div>
                <label className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                  <span>Колонок в ряду (ширина)</span>
                  <span className="text-blue-600">{safeColumns} шт.</span>
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map(n => (
                    <button key={n}
                      onClick={() => setLayout({...layout, columns: n})}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition cursor-pointer ${safeColumns === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                  <span>Высота картинок (1:1 размер)</span>
                  <span className="text-blue-600">{layout.imageHeight} px</span>
                </label>
                <input type="range" min="30" max="150" step="5"
                  value={layout.imageHeight}
                  onChange={(e) => setLayout({...layout, imageHeight: Number(e.target.value)})}
                  className="w-full accent-blue-600" />
              </div>
              
              <div>
                <label className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                  <span>Размер текста упражнений</span>
                  <span className="text-blue-600">{Math.round(layout.textSizeMulti * 100)}%</span>
                </label>
                <input type="range" min="0.8" max="1.5" step="0.05"
                  value={layout.textSizeMulti}
                  onChange={(e) => setLayout({...layout, textSizeMulti: Number(e.target.value)})}
                  className="w-full accent-blue-600" />
              </div>
            </div>

            <button onClick={() => setShowLayoutModal(false)}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 cursor-pointer">
              Готово
            </button>
          </div>
        </div>
      )}

      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
          .page:last-child { page-break-after: auto; }
          .no-print { display: none !important; }
        }
        .page {
          width: 297mm; height: 210mm; background: white;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          overflow: hidden; position: relative; box-sizing: border-box;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>

      {/* ЛЕВОЕ МЕНЮ (НЕВИДИМОЕ ПРИ ПЕЧАТИ) */}
      <div className="fixed left-6 top-6 z-50 print:hidden no-print flex flex-col gap-2 w-[220px]" data-html2canvas-ignore="true">
        
        <div className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg text-xs mb-1">
          {syncStatus === 'saving' ? (
             <><Loader2 size={14} className="animate-spin text-blue-400" /> <span>Сохранение...</span></>
          ) : syncStatus === 'error' ? (
             <><AlertCircle size={14} className="text-red-400" /> <span>Лимит памяти</span></>
          ) : (
             <><HardDrive size={14} className="text-emerald-400" /> <span>Память: {memUsage} МБ</span></>
          )}
        </div>

        <button onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex justify-between items-center bg-white text-slate-800 px-4 py-3 rounded-xl font-black shadow-lg border-2 border-slate-300 hover:bg-slate-50 transition cursor-pointer">
          <div className="flex items-center gap-2"><Menu size={18} /> <span className="text-sm">МЕНЮ УПРАВЛЕНИЯ</span></div>
          {isMenuOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {isMenuOpen && (
          <div className="flex flex-col gap-2 p-3 bg-white/95 backdrop-blur-sm border border-slate-300 rounded-2xl shadow-2xl animate-fade-in mt-1">
            <button onClick={() => setShowLayoutModal(true)}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-900 text-sm transition cursor-pointer">
              <Settings size={16} /> Настройки вёрстки
            </button>
            
            <button onClick={addExercise}
              className="flex items-center gap-2 bg-blue-100 text-blue-700 border border-blue-300 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-blue-200 text-sm transition cursor-pointer">
              <Plus size={16} /> Добавить упражнение
            </button>
            <button onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-purple-700 text-sm transition mt-1 cursor-pointer">
              <Code size={16} /> ИИ Сборка / JSON
            </button>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 inline-flex flex-col mt-1">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 text-center">Открыть из файла</div>
              <label className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg font-bold hover:bg-indigo-100 text-xs transition cursor-pointer">
                <FileUp size={14} /> Открыть PDF / JSON
                <input type="file" accept=".json,.docbratus,.pdf" className="hidden" ref={fileInputRef} onChange={importProtocolFromFile} />
              </label>
            </div>

            <button onClick={saveProtocolToArchive}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 text-sm cursor-pointer mt-1">
              <Save size={16} /> В локальный Архив
            </button>
            <button onClick={() => setShowDatabaseModal(true)}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 text-sm cursor-pointer border-b-2 shadow-[0_4px_0_0_rgb(203,213,225)]">
              <Folder size={16} /> База протоколов
            </button>
            
            <div className="h-px bg-slate-200 my-1"></div>
            
            <button onClick={newProtocol}
              className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-red-100 text-sm cursor-pointer">
              <Trash2 size={16} /> Очистить форму
            </button>
          </div>
        )}
      </div>

      <div className="fixed right-6 bottom-6 z-50 print:hidden no-print flex flex-col gap-3" data-html2canvas-ignore="true">
        <button onClick={() => window.print()}
          disabled={isSaving}
          className="flex items-center gap-2 bg-white text-slate-900 border-2 border-slate-300 px-5 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-50 text-sm cursor-pointer">
          <Printer size={18} className="text-blue-600" /> ПЕЧАТЬ
        </button>
        
        <button onClick={exportToGoogleDocs}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-lg transition cursor-pointer ${
            isSaving ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/30'
          }`}>
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          {isSaving ? 'Экспорт...' : 'В GOOGLE DOCS'}
        </button>

        <button onClick={exportToGoogleDrive}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-lg transition cursor-pointer ${
            isSaving ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30'
          }`}>
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
          {isSaving ? 'Сохранение...' : 'В GOOGLE DRIVE'}
        </button>

        <button onClick={generateSmartPDF}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(37,99,235,0.4)] transition cursor-pointer ${
            isSaving ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {isSaving ? 'Сборка документа...' : 'УМНЫЙ PDF'}
        </button>
      </div>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-bold text-sm no-print transition-all">
          {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400" /> : <AlertCircle size={18} className="text-red-400" />}
          {toast.msg}
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 print:hidden animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Code className="text-purple-600" /> Генератор протокола (ИИ / JSON)
              </h2>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Вставьте сюда код JSON <b>или просто опишите текстом</b> пациента, диагноз и набор упражнений. Приложение само структурирует данные, заполнит пропуски с помощью ИИ и соберет протокол!
            </p>
            <textarea
              className="w-full h-64 border border-slate-300 rounded-xl p-4 text-sm bg-slate-50 focus:outline-none focus:border-purple-500"
              placeholder='{"diagnosis": "РАЗРЫВ ПКС", ...} \nИЛИ\nПациент Иванов Иван, 40 лет. Разрыв ПКС. Цель - вернуться в спорт...\nУпражнения: 1. Сгибание колена 10-12 раз...'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              disabled={isGeneratingAI}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowImportModal(false)}
                disabled={isGeneratingAI}
                className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                Отмена
              </button>
              <button onClick={applyImportText}
                disabled={isGeneratingAI}
                className="px-5 py-2.5 flex items-center gap-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {isGeneratingAI ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isGeneratingAI ? 'Генерация...' : 'Загрузить / Сгенерировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ СТРАНИЦА 1 ============ */}
      <div id="page-1" className="page" style={{ padding: '10mm 12mm' }}>
        <div className="w-full h-full flex flex-col box-border" style={{ gap: '4mm' }}>
          <header className="border-b-2 border-blue-600 pb-3 shrink-0 box-border">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-blue-600 shrink-0" />
                <span className="text-blue-600 font-black uppercase tracking-widest break-words" style={{ fontSize: '9px' }}>
                  <span style={textShift}>Протокол реабилитации · DocBratus</span>
                </span>
              </div>
              <VASScale textShift={vasShift} />
            </div>
            <Editable
              value={protocol.diagnosis}
              onChange={(v) => setProtocol({ ...protocol, diagnosis: v })}
              className="font-black text-slate-900 uppercase leading-tight tracking-tight block"
              style={{ fontSize: '24px', ...textShiftBlock }}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 box-border" style={{ fontSize: '11px' }}>
              {layout.showPatientName && (
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider mr-1" style={{ fontSize: '8px' }}>
                    <span style={textShift}>ФИО:</span>
                  </span>
                  <Editable
                    value={protocol.patientName}
                    onChange={(v) => setProtocol({ ...protocol, patientName: v })}
                    className="font-black text-slate-900 inline-block border-b border-dashed border-slate-300"
                    placeholder="введите имя"
                    style={textShift}
                    inline={true}
                  />
                </div>
              )}
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider mr-1" style={{ fontSize: '8px' }}>
                  <span style={textShift}>Этап:</span>
                </span>
                <Editable
                  value={protocol.stage}
                  onChange={(v) => setProtocol({ ...protocol, stage: v })}
                  className="font-bold text-slate-700 inline-block"
                  style={textShift}
                  inline={true}
                />
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider mr-1" style={{ fontSize: '8px' }}>
                  <span style={textShift}>Режим:</span>
                </span>
                <Editable
                  value={protocol.regime}
                  onChange={(v) => setProtocol({ ...protocol, regime: v })}
                  className="font-bold text-slate-700 inline-block"
                  style={textShift}
                  inline={true}
                />
              </div>
            </div>
          </header>

          <div className="grid grid-cols-6 gap-3 flex-1 box-border" style={{ gridTemplateRows: '1fr 1fr', minHeight: 0 }}>
            {layout.showGoals && (
              <div className="group relative col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col overflow-hidden box-border">
                <button
                  onClick={() => setLayout({...layout, showGoals: false})}
                  className="absolute top-2 right-2 p-1 bg-white rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm print:hidden hover:bg-red-50 cursor-pointer"
                  title="Удалить блок"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center gap-2 text-blue-700 mb-2.5 pb-2 border-b border-blue-200 shrink-0 pr-6">
                  <Target size={16} className="shrink-0" />
                  <Editable
                    value={protocol.goalsTitle}
                    onChange={(v) => setProtocol({ ...protocol, goalsTitle: v })}
                    className="font-black uppercase tracking-widest break-words block outline-none border-b border-transparent hover:border-blue-300"
                    style={{ fontSize: '10px', ...textShiftBlock }}
                    inline
                  />
                </div>
                <div className="flex-1 overflow-hidden h-full">
                  <Editable
                    value={protocol.goals}
                    onChange={(v) => setProtocol({ ...protocol, goals: v })}
                    className="text-slate-800 font-medium h-full outline-none"
                    style={{ fontSize: '9.5px', lineHeight: '1.4', ...textShiftBlock }}
                    multiline
                  />
                </div>
              </div>
            )}

            {layout.showLoads && (
              <div className="group relative col-span-2 bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col overflow-hidden box-border">
                <button
                  onClick={() => setLayout({...layout, showLoads: false})}
                  className="absolute top-2 right-2 p-1 bg-white rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm print:hidden hover:bg-red-50 cursor-pointer"
                  title="Удалить блок"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center gap-2 text-indigo-700 mb-2.5 pb-2 border-b border-indigo-200 shrink-0 pr-6">
                  <Activity size={16} className="shrink-0" />
                  <Editable
                    value={protocol.loadsTitle}
                    onChange={(v) => setProtocol({ ...protocol, loadsTitle: v })}
                    className="font-black uppercase tracking-widest break-words block outline-none border-b border-transparent hover:border-indigo-300"
                    style={{ fontSize: '10px', ...textShiftBlock }}
                    inline
                  />
                </div>
                <div className="flex-1 overflow-hidden h-full">
                  <Editable
                    value={protocol.loads}
                    onChange={(v) => setProtocol({ ...protocol, loads: v })}
                    className="text-slate-800 font-medium h-full outline-none"
                    style={{ fontSize: '9.5px', lineHeight: '1.4', ...textShiftBlock }}
                    multiline
                  />
                </div>
              </div>
            )}

            {layout.showRedFlags && (
              <div className="group relative col-span-2 bg-red-50 border border-red-300 rounded-xl p-3 flex flex-col overflow-hidden box-border">
                <button
                  onClick={() => setLayout({...layout, showRedFlags: false})}
                  className="absolute top-2 right-2 p-1 bg-white rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm print:hidden hover:bg-red-50 cursor-pointer"
                  title="Удалить блок"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center gap-2 text-red-700 mb-2.5 pb-2 border-b border-red-200 shrink-0 pr-6">
                  <ShieldAlert size={16} className="shrink-0" />
                  <Editable
                    value={protocol.redFlagsTitle}
                    onChange={(v) => setProtocol({ ...protocol, redFlagsTitle: v })}
                    className="font-black uppercase tracking-widest break-words block outline-none border-b border-transparent hover:border-red-300"
                    style={{ fontSize: '10px', ...textShiftBlock }}
                    inline
                  />
                </div>
                <div className="flex-1 overflow-hidden h-full">
                  <Editable
                    value={protocol.redFlags}
                    onChange={(v) => setProtocol({ ...protocol, redFlags: v })}
                    className="text-red-900 font-medium h-full outline-none"
                    style={{ fontSize: '9.5px', lineHeight: '1.4', ...textShiftBlock }}
                    multiline
                  />
                </div>
              </div>
            )}

            {layout.showRules && (
              <div className="group relative col-span-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col overflow-hidden box-border">
                <button
                  onClick={() => setLayout({...layout, showRules: false})}
                  className="absolute top-2 right-2 p-1 bg-white rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm print:hidden hover:bg-red-50 cursor-pointer"
                  title="Удалить блок"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center gap-2 text-amber-800 mb-2.5 pb-2 border-b border-amber-200 shrink-0 pr-6">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <Editable
                    value={protocol.rulesTitle}
                    onChange={(v) => setProtocol({ ...protocol, rulesTitle: v })}
                    className="font-black uppercase tracking-widest break-words block outline-none border-b border-transparent hover:border-amber-300"
                    style={{ fontSize: '11px', ...textShiftBlock }}
                    inline
                  />
                </div>
                <div className="flex-1 overflow-hidden h-full">
                  <Editable
                    value={protocol.rules}
                    onChange={(v) => setProtocol({ ...protocol, rules: v })}
                    className="text-slate-800 font-medium h-full outline-none"
                    style={{ fontSize: '9.5px', lineHeight: '1.4', ...textShiftBlock }}
                    multiline
                  />
                </div>
                <div className="mt-auto pt-3 border-t border-amber-300/50 text-amber-900 shrink-0 break-words flex flex-col justify-start" style={{ fontSize: '9px' }}>
                  <div>
                    <Editable
                      value={protocol.rule24Title}
                      onChange={(v) => setProtocol({ ...protocol, rule24Title: v })}
                      className="font-black uppercase tracking-wider inline-block outline-none"
                      style={textShift}
                      inline
                    />
                    <Editable
                      value={protocol.rule24Text}
                      onChange={(v) => setProtocol({ ...protocol, rule24Text: v })}
                      className="font-medium inline-block outline-none"
                      style={textShift}
                      inline
                    />
                  </div>
                </div>
              </div>
            )}

            {layout.showTransition && (
              <div className="group relative col-span-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col overflow-hidden box-border">
                <button
                  onClick={() => setLayout({...layout, showTransition: false})}
                  className="absolute top-2 right-2 p-1 bg-white rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm print:hidden hover:bg-red-50 cursor-pointer"
                  title="Удалить блок"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center gap-2 text-emerald-700 mb-2.5 pb-2 border-b border-emerald-200 shrink-0 pr-6">
                  <ArrowRight size={16} className="shrink-0" />
                  <Editable
                    value={protocol.transitionTitle}
                    onChange={(v) => setProtocol({ ...protocol, transitionTitle: v })}
                    className="font-black uppercase tracking-widest break-words block outline-none border-b border-transparent hover:border-emerald-300"
                    style={{ fontSize: '11px', ...textShiftBlock }}
                    inline
                  />
                </div>
                <div className="flex-1 overflow-hidden h-full">
                  <Editable
                    value={protocol.transition}
                    onChange={(v) => setProtocol({ ...protocol, transition: v })}
                    className="text-slate-800 font-medium h-full outline-none"
                    style={{ fontSize: '9.5px', lineHeight: '1.4', ...textShiftBlock }}
                    multiline
                  />
                </div>
                <div className="mt-auto pt-3 border-t border-emerald-300/50 shrink-0 break-words flex flex-col justify-start text-emerald-800" style={{ fontSize: '9px' }}>
                  <div>
                    <Editable
                      value={protocol.whenTitle}
                      onChange={(v) => setProtocol({ ...protocol, whenTitle: v })}
                      className="font-black uppercase tracking-wider inline-block outline-none"
                      style={textShift}
                      inline
                    />
                    <Editable
                      value={protocol.whenText}
                      onChange={(v) => setProtocol({ ...protocol, whenText: v })}
                      className="text-slate-700 font-medium inline-block outline-none"
                      style={textShift}
                      inline
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-slate-200 shrink-0 box-border mt-auto" style={{ fontSize: '8px' }}>
            <span className="text-slate-400 font-bold uppercase tracking-wider inline-block">
              <span style={footerShift}>Доктор Братусь - доказательная реабилитация и восстановление</span>
            </span>
            <span className="text-slate-400 font-bold uppercase tracking-wider inline-block">
              <span style={footerShift}>Стр. 1 / {totalPages} — Разбор протокола</span>
            </span>
          </div>
        </div>
      </div>

      {/* ============ СТРАНИЦЫ УПРАЖНЕНИЙ ============ */}
      {chunks.map((chunk, pageIndex) => {
        const currentPageNum = pageIndex + 2;
        const isLastPage = pageIndex === chunks.length - 1; 
        
        const numRows = Math.ceil(chunk.length / safeColumns);
        const isFullPage = numRows > 1;

        return (
          <div id={`page-${currentPageNum}`} key={`page-${currentPageNum}`} className="page relative" style={{ padding: '8mm 10mm' }}>
            <div className="w-full h-full flex flex-col box-border" style={{ gap: '2.5mm' }}>
              <header className="flex justify-between items-center border-b-2 border-blue-600 pb-2 shrink-0 box-border">
                <div className="flex items-center gap-3">
                  <Activity size={16} className="text-blue-600 shrink-0" />
                  <div>
                    <div className="text-blue-600 font-black uppercase tracking-widest break-words block" style={{ fontSize: '7px' }}>
                      <span style={textShift}>Протокол реабилитации · комплекс упражнений</span>
                    </div>
                    <div className="font-black text-slate-900 uppercase leading-tight break-words flex items-center flex-wrap" style={{ fontSize: '13px' }}>
                      {layout.showPatientName && (
                        <Editable
                          value={protocol.patientName}
                          onChange={(v) => setProtocol({ ...protocol, patientName: v })}
                          className="inline-block outline-none border-b border-dashed border-transparent hover:border-slate-300 focus:border-blue-500 mr-2"
                          placeholder="Имя пациента"
                          style={textShift}
                          inline={true}
                        />
                      )}
                      {protocol.diagnosis && (
                        <span className="text-slate-500 font-bold inline-block" style={{ fontSize: '10px' }}>
                          <span style={textShift}>{layout.showPatientName ? '· ' : ''}{stripHtml(protocol.diagnosis)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <VASScale textShift={vasShift} />
              </header>

              <div className={`flex flex-col gap-2 shrink-0 box-border w-full mt-1 relative ${isFullPage ? 'flex-1 min-h-0' : ''}`}>
                <div className="grid gap-2 box-border w-full h-full" style={{ 
                  gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))`, 
                  gridTemplateRows: isFullPage ? `repeat(2, minmax(0, 1fr))` : `repeat(1, minmax(${layout.cardHeight}mm, auto))` 
                }}>
                  {chunk.map((item, idx) => {
                    const globalIndex = pageIndex * exercisesPerPage + idx;
                    const exItem = item as Exercise;
                    return <ExerciseCard key={exItem.id || idx} ex={exItem} index={globalIndex} layout={layout} textShift={textShift} textShiftBlock={textShiftBlock} onUpdate={(u) => updateExercise(exItem.id, u)} onRemove={removeExercise} />;
                  })}
                </div>
              </div>

              {isLastPage ? (
                <>
                  <div className={`bg-slate-50 border-2 border-blue-100 rounded-2xl p-2.5 flex flex-col shrink-0 box-border ${isFullPage ? 'mt-auto' : 'mt-4'}`} style={{ height: '36mm' }}>
                    <div className="flex items-center justify-between flex-1 min-h-0">
                      <div className="flex flex-col justify-center h-full">
                        <div className="font-black text-blue-600 uppercase leading-none mb-1 break-words block" style={{ fontSize: '16px', letterSpacing: '-0.02em' }}>
                          <span style={footerShift}>Михаил Братусь</span>
                        </div>
                        <div className="font-black text-slate-800 uppercase mb-1.5 break-words block" style={{ fontSize: '9px' }}>
                          <span style={footerShift}>Главный врач «СМП МЕД» · DocBratus</span>
                        </div>
                        <div className="font-bold text-slate-500 uppercase tracking-widest bg-slate-200 px-2.5 py-1.5 rounded inline-block mt-1.5 mb-1 self-start" style={{ fontSize: '7px' }}>
                          <span style={footerShift}>Врач-реабилитолог · ЛФК · Спортивная медицина</span>
                        </div>
                        <div className="flex items-center gap-4 mt-auto pt-1">
                          <div className="flex items-center gap-1.5 font-black text-slate-900" style={{ fontSize: '10px' }}>
                            <Send size={12} className="text-blue-500" />
                            <span style={footerShift}>@Doc_Bratus</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-black text-slate-900" style={{ fontSize: '10px' }}>
                            <Phone size={12} className="text-blue-500" />
                            <span style={footerShift}>+7 965 761-65-43</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0 h-full py-0.5">
                        <div className="flex flex-col items-center gap-1">
                          <div className="bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                            <QRCode value={TG_URL} size={55} />
                          </div>
                          <span className="font-black text-slate-700 uppercase tracking-widest block" style={{ fontSize: '6px' }}>
                            <span style={footerShift}>Telegram</span>
                          </span>
                        </div>
                        <div className="w-px h-full bg-slate-300" />
                        <div className="flex flex-col items-center gap-1">
                          <div className="bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                            <QRCode value={MAX_URL} size={55} />
                          </div>
                          <span className="font-black text-slate-700 uppercase tracking-widest block" style={{ fontSize: '6px' }}>
                            <span style={footerShift}>Запись · MAX</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full text-center mt-2 pt-1.5 border-t border-blue-200/60 shrink-0">
                      <span className="text-slate-400 font-bold uppercase tracking-[0.2em] inline-block" style={{ fontSize: '6.5px' }}>
                        <span style={footerShift}>Передайте этот протокол тем, кому он может помочь</span>
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-auto"></div>
              )}

              <div className="flex justify-between items-center pt-1 border-t border-slate-200 shrink-0 box-border mt-auto" style={{ fontSize: '8px' }}>
                <span className="text-slate-400 font-bold uppercase tracking-wider inline-block">
                  <span style={footerShift}>Доктор Братусь - доказательная реабилитация и восстановление</span>
                </span>
                <span className="text-slate-400 font-bold uppercase tracking-wider inline-block">
                  <span style={footerShift}>Стр. {currentPageNum} / {totalPages} — Упражнения + Контакты</span>
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {showDatabaseModal && (
        <DatabaseModal 
          onClose={() => setShowDatabaseModal(false)} 
          onSelectProtocol={(p) => {
            if (p.id) {
              dbOps.incrementUsage(p.id);
              refreshHistory();
            }
            setProtocol({ ...defaultProtocolState, ...p, id: undefined });
            setShowDatabaseModal(false);
            showToast('Протокол успешно загружен!', 'success');
          }}
          onAddExercise={(ex) => {
            setProtocol((prev: any) => ({
              ...prev,
              exercises: [...prev.exercises, { ...ex, id: 'ex_' + Date.now() + Math.random(), img1: null, img2: null, img3: null }]
            }));
            showToast(`«${ex.title}» добавлено!`, 'success');
          }}
          localHistory={history}
          onDeleteLocal={(ts) => {
            dbOps.deleteProtocol(ts);
            refreshHistory();
            showToast('Удалено из архива', 'success');
          }}
        />
      )}
    </div>
  );
}

export default function SafeApp() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
