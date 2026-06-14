import React, { useState, useEffect } from 'react';
import { X, BookTemplate, Archive, Dumbbell, Play, Plus, Trash2, Heart, CheckSquare, Search } from 'lucide-react';
import { SYSTEM_PROTOCOLS, EXERCISE_LIBRARY } from '../data/db';

const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/ig, ' ');
};

interface Props {
  onClose: () => void;
  onSelectProtocol: (protocol: any) => void;
  onAddExercise: (exercise: any) => void;
  localHistory: any[];
  onDeleteLocal: (id: string) => void;
}

export function DatabaseModal({ onClose, onSelectProtocol, onAddExercise, localHistory, onDeleteLocal }: Props) {
  const [activeTab, setActiveTab] = useState<'system' | 'local' | 'exercises' | 'favorites'>('system');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'popular'>('newest');
  
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [exerciseSortOrder, setExerciseSortOrder] = useState<'alpha-asc' | 'alpha-desc' | 'popular'>('alpha-asc');
  const [exerciseUsage, setExerciseUsage] = useState<Record<string, number>>({});

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem('docbratus_favorites') || '[]');
    setFavorites(favs);
    
    const usage = JSON.parse(localStorage.getItem('docbratus_exercise_usage') || '{}');
    setExerciseUsage(usage);
  }, []);

  const handleAddExercise = (ex: any) => {
    const newUsage = { ...exerciseUsage, [ex.title]: (exerciseUsage[ex.title] || 0) + 1 };
    setExerciseUsage(newUsage);
    localStorage.setItem('docbratus_exercise_usage', JSON.stringify(newUsage));
    onAddExercise(ex);
  };

  const toggleFavorite = (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavs = favorites.includes(title) ? favorites.filter((f: string) => f !== title) : [...favorites, title];
    setFavorites(newFavs);
    localStorage.setItem('docbratus_favorites', JSON.stringify(newFavs));
  };

  const toggleSelection = (title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedExercises);
    if (newSet.has(title)) newSet.delete(title);
    else newSet.add(title);
    setSelectedExercises(newSet);
  };

  const addSelected = () => {
    const toAdd = EXERCISE_LIBRARY.filter(ex => selectedExercises.has(ex.title));
    const newUsage = { ...exerciseUsage };
    toAdd.forEach(ex => {
      newUsage[ex.title] = (newUsage[ex.title] || 0) + 1;
      onAddExercise(ex);
    });
    setExerciseUsage(newUsage);
    localStorage.setItem('docbratus_exercise_usage', JSON.stringify(newUsage));
    setSelectedExercises(new Set());
  };

  // Safe localHistory resolving since it could be incorrectly mapped previously
  const safeHistory = localHistory.map(item => item.data ? item.data : item);

  const sortedHistory = [...safeHistory].sort((a, b) => {
    if (sortOrder === 'newest') return (b.savedAt || b.timestamp || 0) - (a.savedAt || a.timestamp || 0);
    if (sortOrder === 'oldest') return (a.savedAt || a.timestamp || 0) - (b.savedAt || b.timestamp || 0);
    if (sortOrder === 'popular') return (b.usageCount || 0) - (a.usageCount || 0);
    return 0;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 shrink-0 bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <BookTemplate className="text-purple-600" /> База протоколов и упражнений
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">Готовые пресеты для быстрой сборки реабилитационных программ</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg cursor-pointer transition">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-slate-200 shrink-0 gap-6 overflow-x-auto no-scrollbar relative">
          <button 
            onClick={() => setActiveTab('system')}
            className={`whitespace-nowrap pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === 'system' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Play size={16} /> Системные ({SYSTEM_PROTOCOLS.length})
          </button>
          <button 
            onClick={() => setActiveTab('local')}
            className={`whitespace-nowrap pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === 'local' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Archive size={16} /> Мой архив ({safeHistory.length})
          </button>
          <button 
            onClick={() => setActiveTab('exercises')}
            className={`whitespace-nowrap pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === 'exercises' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Dumbbell size={16} /> Библиотека
          </button>
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`whitespace-nowrap pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === 'favorites' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Heart size={16} className={activeTab === 'favorites' ? 'fill-rose-500' : ''}/> Избранное
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {/* TAB: SYSTEM */}
          {activeTab === 'system' && (
            <div className="flex flex-col gap-6">
              {Object.entries(SYSTEM_PROTOCOLS.reduce((acc, p) => {
                const cat = p.category || 'Прочее';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(p);
                return acc;
              }, {} as Record<string, typeof SYSTEM_PROTOCOLS>)).map(([cat, prots]) => (
                <div key={cat} className="space-y-3">
                  <h3 className="font-black text-xl text-slate-800 border-b-2 border-slate-200 pb-2">{cat}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {prots.map((p) => (
                      <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-purple-400 hover:shadow-md transition flex flex-col">
                        <h3 className="font-bold text-slate-900 text-lg leading-tight mb-2">{p.diagnosis}</h3>
                        <div className="flex flex-wrap gap-2 mb-4 mt-auto">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{p.exercises.length} упражнений</span>
                          <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded text-xs font-bold">Одобрено</span>
                        </div>
                        <button 
                          onClick={() => onSelectProtocol(p)}
                          className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition cursor-pointer">
                          Загрузить протокол
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: LOCAL */}
          {activeTab === 'local' && (
            <div className="space-y-3">
              {safeHistory.length > 0 && (
                <div className="flex justify-end mb-4">
                  <select 
                    value={sortOrder} 
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 bg-white shadow-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                    <option value="popular">Часто используемые</option>
                  </select>
                </div>
              )}
              
              {sortedHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <Archive size={48} className="mx-auto mb-3 opacity-20" />
                  У вас пока нет сохранённых протоколов.
                </div>
              ) : (
                sortedHistory.map((item, idx) => {
                  const ts = item.savedAt || item.timestamp || Date.now();
                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col hover:border-blue-300 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg">{stripHtml(item.diagnosis) || 'Без названия'}</h3>
                          <p className="text-sm text-slate-500">Пациент: {stripHtml(item.patientName) || '—'}</p>
                          {(item.usageCount || 0) > 0 && (
                            <span className="inline-block mt-2 bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded text-xs font-bold">Использовано: {item.usageCount} раз</span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          {new Date(ts).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2 mt-4">
                        <button 
                          onClick={() => onDeleteLocal(item.id || item.timestamp)}
                          className="px-4 py-2 text-red-600 border border-red-200 hover:bg-red-50 rounded-lg text-sm font-bold transition cursor-pointer flex items-center gap-1">
                          <Trash2 size={16} /> Удалить
                        </button>
                        <button 
                          onClick={() => onSelectProtocol(item)}
                          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition cursor-pointer">
                          Загрузить
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB: EXERCISES */}
          {activeTab === 'exercises' && (
            <div className="flex flex-col gap-6 relative pb-20">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm flex justify-between items-center gap-4 mt-2">
                <span>Отметьте чекбоксы и нажмите <b>«Добавить выбранные»</b>, либо добавляйте их по одному.</span>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 mb-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Поиск упражнений..." 
                    value={exerciseSearchQuery}
                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition text-sm font-medium"
                  />
                </div>
                <select
                  value={exerciseSortOrder}
                  onChange={(e) => setExerciseSortOrder(e.target.value as any)}
                  className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 bg-white shadow-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 shrink-0"
                >
                  <option value="alpha-asc">По алфавиту (А-Я)</option>
                  <option value="alpha-desc">По алфавиту (Я-А)</option>
                  <option value="popular">По популярности</option>
                </select>
              </div>

              {Object.entries(EXERCISE_LIBRARY
                .filter(ex => {
                  if (!exerciseSearchQuery) return true;
                  const q = exerciseSearchQuery.toLowerCase();
                  return ex.title.toLowerCase().includes(q) || ex.desc.toLowerCase().includes(q);
                })
                .sort((a, b) => {
                  if (exerciseSortOrder === 'popular') {
                    return (exerciseUsage[b.title] || 0) - (exerciseUsage[a.title] || 0);
                  } else if (exerciseSortOrder === 'alpha-asc') {
                    return a.title.localeCompare(b.title);
                  } else {
                    return b.title.localeCompare(a.title);
                  }
                })
                .reduce((acc, ex) => {
                const cat = (ex as any).category || 'Прочее';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(ex);
                return acc;
              }, {} as Record<string, typeof EXERCISE_LIBRARY>)).map(([cat, exercises]: [string, any[]]) => (
                <div key={cat} className="space-y-3">
                  <h3 className="font-black text-xl text-slate-800 border-b-2 border-slate-200 pb-2">{cat}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {exercises.map((ex, idx) => {
                      const isSelected = selectedExercises.has(ex.title);
                      const isFav = favorites.includes(ex.title);
                      return (
                        <div 
                          key={idx} 
                          onClick={() => toggleSelection(ex.title)}
                          className={`relative bg-white border rounded-xl p-4 shadow-sm transition flex flex-col cursor-pointer ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/50' : 'border-slate-200 hover:border-emerald-300'}`}>
                          
                          <div className="absolute top-4 right-4 text-slate-300">
                            <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 rounded border-slate-300 text-emerald-600 pointer-events-none" />
                          </div>

                          <button 
                            onClick={(e) => toggleFavorite(ex.title, e)} 
                            className={`absolute top-3 right-12 p-1.5 rounded-full transition ${isFav ? 'text-rose-500' : 'text-slate-300 hover:text-slate-400 hover:bg-slate-100'}`}>
                            <Heart size={20} className={isFav ? 'fill-rose-500' : ''} />
                          </button>

                          <h3 className="font-bold text-slate-900 mb-2 pr-20 leading-tight">{ex.title}</h3>
                          <p className="text-xs text-slate-600 line-clamp-2 mb-3">{ex.desc}</p>
                          <div className="mt-auto flex justify-between items-center pr-2 pt-2">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded truncate max-w-[60%]" title={ex.dose}>{ex.dose}</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAddExercise(ex); }}
                              className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition cursor-pointer flex items-center gap-1 shrink-0">
                              <Plus size={14} /> В список
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: FAVORITES */}
          {activeTab === 'favorites' && (
            <div className="flex flex-col gap-6 relative pb-20">
              {favorites.length === 0 ? (
                <div className="text-center py-10 text-slate-500 mt-8">
                  <Heart size={48} className="mx-auto mb-3 opacity-20" />
                  У вас пока нет избранных упражнений.<br />
                  <span className="text-sm mt-2 inline-block">Можете добавить их в библиотеке упражнений, нажав на иконку сердечка.</span>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 mt-4">
                  {EXERCISE_LIBRARY.filter(ex => favorites.includes(ex.title)).map((ex, idx) => {
                    const isSelected = selectedExercises.has(ex.title);
                    return (
                      <div 
                        key={idx} 
                        onClick={() => toggleSelection(ex.title)}
                        className={`relative bg-white border rounded-xl p-4 shadow-sm transition flex flex-col cursor-pointer ${isSelected ? 'border-rose-500 ring-2 ring-rose-500/50' : 'border-slate-200 hover:border-rose-300'}`}>
                        
                        <div className="absolute top-4 right-4 text-slate-300">
                          <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 rounded border-slate-300 text-rose-600 pointer-events-none" />
                        </div>

                        <button 
                          onClick={(e) => toggleFavorite(ex.title, e)} 
                          className="absolute top-3 right-12 p-1.5 rounded-full text-rose-500 transition hover:bg-rose-50">
                          <Heart size={20} className="fill-rose-500" />
                        </button>

                        <h3 className="font-bold text-slate-900 mb-2 pr-20 leading-tight">{ex.title}</h3>
                        <p className="text-xs text-slate-600 line-clamp-2 mb-3">{ex.desc}</p>
                        <div className="mt-auto flex justify-between items-center pr-2 pt-2">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded truncate max-w-[60%]" title={ex.dose}>{ex.dose}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAddExercise(ex); }}
                            className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-200 transition cursor-pointer flex items-center gap-1 shrink-0">
                            <Plus size={14} /> В список
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* FLOATING ACTION BAR FOR SELECTED EXERCISES */}
        {selectedExercises.size > 0 && (activeTab === 'exercises' || activeTab === 'favorites') && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-sm shadow-2xl rounded-2xl py-3 px-6 border border-slate-700 flex items-center gap-6 z-50 animate-fade-in shadow-emerald-900/20">
            <div className="flex flex-col text-slate-200">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Выбрано</span>
              <span className="font-black text-xl leading-none text-white">{selectedExercises.size}</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setSelectedExercises(new Set())} className="text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center hover:bg-slate-800 cursor-pointer bg-slate-800/50">
                Очистить выбор
              </button>
              <button onClick={addSelected} className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-400 transition shadow-lg shrink-0 cursor-pointer">
                <CheckSquare size={18} /> Добавить выбранные
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
