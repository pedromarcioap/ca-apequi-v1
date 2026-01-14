
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Settings as SettingsIcon, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  DollarSign, 
  ArrowRight,
  Filter,
  Layers,
  ShieldCheck,
  Target,
  Globe,
  MessageSquare,
  X,
  Send,
  Upload,
  ExternalLink,
  Ban,
  ClipboardList,
  ChevronRight,
  Info,
  RefreshCcw,
  Sparkles,
  MapPin,
  Building2,
  Tag,
  FileUp,
  Banknote,
  LayoutGrid,
  ListFilter,
  CalendarDays,
  SortAsc,
  SortDesc,
  Eraser,
  Map as MapIcon,
  Bell,
  Mail,
  Plus,
  Trash2,
  Clock,
  Briefcase,
  Radar,
  Check,
  Cpu,
  BrainCircuit,
  HeartHandshake,
  Users,
  Leaf
} from 'lucide-react';
import { Edital, SearchResult, AnalysisStatus, Message, UserPreferences } from './types';
import { analyzeEditalWithAI } from './services/aiService';
import { scrapeUrl } from './services/scraperService';
import { searchEditais } from './services/searchService';
import { streamChatResponse } from './services/chatService';

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO", "Nacional"];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'map' | 'radar'>('search');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [analyzedEditais, setAnalyzedEditais] = useState<Edital[]>([]);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [processingUrl, setProcessingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzedSectionRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [preferences, setPreferences] = useState<UserPreferences>({
    keywords: ['Impacto Social', 'Audiovisual Comunitário', 'Educação Ambiental', 'Direitos Humanos'],
    regions: ['Nacional', 'SP', 'TO'],
    notificationTime: '08:00',
    emailStyle: 'direto',
    autoExpand: true
  });

  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterRegiao, setFilterRegiao] = useState('Todas');
  const [filterYear, setFilterYear] = useState('Todos');
  const [sortBy, setSortBy] = useState<'recent' | 'value'>('recent');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToUse = (customQuery || searchQuery).trim();
    if (!queryToUse) return;
    
    setIsSearching(true);
    setError(null);
    try {
      const results = await searchEditais(queryToUse, preferences.autoExpand ? preferences.keywords : []);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message || "Falha na busca.");
    } finally {
      setIsSearching(false);
    }
  };

  const getYearFromText = (text?: string): string | null => {
    if (!text) return null;
    const match = text.match(/\d{4}/);
    return match ? match[0] : null;
  };

  const availableYears = useMemo(() => {
    const years = searchResults
      .map(r => getYearFromText(r.data_publicacao))
      .filter((y): y is string => y !== null);
    return Array.from(new Set(years)).sort((a: string, b: string) => b.localeCompare(a));
  }, [searchResults]);

  const filteredResults = useMemo(() => {
    let results = searchResults.filter(result => {
      const matchStatus = filterStatus === 'Todos' || result.status === filterStatus;
      const matchRegiao = filterRegiao === 'Todas' || result.regiao === filterRegiao;
      
      let matchYear = true;
      if (filterYear !== 'Todos') {
        const itemYear = getYearFromText(result.data_publicacao);
        matchYear = itemYear === filterYear;
      }
      
      return matchStatus && matchRegiao && matchYear;
    });

    if (sortBy === 'value') {
      results.sort((a, b) => {
        const valA = parseFloat((a.valor_estimado || '0').replace(/[^\d]/g, '')) || 0;
        const valB = parseFloat((b.valor_estimado || '0').replace(/[^\d]/g, '')) || 0;
        return valB - valA;
      });
    } else {
      results.sort((a, b) => {
        const dateA = a.data_publicacao ? new Date(a.data_publicacao.split('/').reverse().join('-')).getTime() : 0;
        const dateB = b.data_publicacao ? new Date(b.data_publicacao.split('/').reverse().join('-')).getTime() : 0;
        return dateB - dateA;
      });
    }
    return results;
  }, [searchResults, filterStatus, filterRegiao, filterYear, sortBy]);

  const radarMatches = useMemo(() => {
    return searchResults.filter(result => 
      preferences.keywords.some(kw => 
        result.title.toLowerCase().includes(kw.toLowerCase()) || 
        result.snippet.toLowerCase().includes(kw.toLowerCase())
      )
    );
  }, [searchResults, preferences.keywords]);

  const regionStats = useMemo(() => {
    const stats: Record<string, number> = {};
    searchResults.forEach(r => {
      const reg = r.regiao || 'Nacional';
      stats[reg] = (stats[reg] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [searchResults]);

  const handleAnalyze = async (result: SearchResult) => {
    if (processingUrl) return; 
    setProcessingUrl(result.url);
    setStatus(AnalysisStatus.SCRAPING);
    setError(null);
    try {
      const rawText = await scrapeUrl(result.url);
      setStatus(AnalysisStatus.ANALYZING);
      const extractedData = await analyzeEditalWithAI(rawText);
      const newEdital = { 
        ...extractedData, 
        id: Math.random().toString(36).substr(2,9), 
        link_origem: result.url 
      };
      setAnalyzedEditais(prev => [newEdital, ...prev]);
      setStatus(AnalysisStatus.COMPLETED);
      setTimeout(() => {
        setProcessingUrl(null);
        setStatus(AnalysisStatus.IDLE);
        setTimeout(() => {
          analyzedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }, 2000);
    } catch (err: any) {
      setError(`Erro ao analisar o edital: ${err.message}`);
      setStatus(AnalysisStatus.ERROR);
      setProcessingUrl(null);
    }
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;
    const userMsg = currentInput;
    setCurrentInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);
    try {
      let fullResponse = "";
      setChatMessages(prev => [...prev, { role: 'model', text: "" }]);
      for await (const chunk of streamChatResponse(userMsg, chatMessages)) {
        fullResponse += chunk;
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].text = fullResponse;
          return updated;
        });
      }
    } catch (err: any) {
      setError(`Chat Error: ${err.message}`);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-lime-400 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('search')}>
            <div className="bg-lime-400 p-2 rounded-lg text-slate-900 shadow-[0_0_20px_rgba(163,230,53,0.3)]">
              <HeartHandshake size={24} />
            </div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase">Caça<span className="text-yellow-400">Pequi</span> <span className="text-[10px] text-lime-400 bg-white/5 px-2 py-1 rounded-md ml-1 hidden sm:inline">OSC EDITION</span></h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('search')}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${activeTab === 'search' ? 'bg-lime-400 text-slate-900 shadow-[0_0_15px_rgba(163,230,53,0.4)]' : 'text-slate-400 hover:text-white'}`}
            >
              Fomento & Impacto
            </button>
            <button 
              onClick={() => setActiveTab('radar')}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${activeTab === 'radar' ? 'bg-lime-400 text-slate-900 shadow-[0_0_15px_rgba(163,230,53,0.4)]' : 'text-slate-400 hover:text-white'}`}
            >
              Radar Social
            </button>
            <button 
              onClick={() => setActiveTab('map')}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${activeTab === 'map' ? 'bg-lime-400 text-slate-900 shadow-[0_0_15px_rgba(163,230,53,0.4)]' : 'text-slate-400 hover:text-white'}`}
            >
              Mapa
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-white/5 text-lime-400 rounded-xl hover:bg-lime-400 hover:text-slate-900 transition-all border border-white/10">
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-12 flex-1">
        {error && (
          <div className="mb-8 bg-red-50 border-l-8 border-red-500 p-6 rounded-2xl flex items-start gap-4 shadow-lg animate-in slide-in-from-top-4">
            <AlertCircle className="text-red-500 shrink-0" size={24} />
            <div>
              <p className="text-sm font-black text-slate-900 uppercase mb-1">Erro no Motor de Busca</p>
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={18} /></button>
          </div>
        )}

        {/* TAB: SEARCH */}
        {activeTab === 'search' && (
          <div className="animate-in fade-in duration-700">
            <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border-b-8 border-yellow-400 mb-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-lime-400/5 rounded-full blur-[100px] -mr-40 -mt-40 transition-all group-hover:bg-lime-400/10"></div>
              <div className="relative z-10 mb-6 flex items-center gap-3">
                <div className="p-2 bg-lime-400/20 text-lime-400 rounded-lg"><Users size={18} className="animate-pulse" /></div>
                <h2 className="text-white text-xs font-black uppercase tracking-[0.3em]">Busca Conceitual para OSCs (MROSC & Chamamentos)</h2>
              </div>
              <form onSubmit={handleSearch} className="relative z-10">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-lime-400" size={24} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ex: 'Projetos de impacto social em favelas' ou 'Educação ambiental'..."
                  className="w-full pl-16 pr-44 py-7 bg-white/10 border-2 border-white/20 rounded-2xl outline-none focus:border-lime-400 text-white font-bold text-xl placeholder:text-slate-600 backdrop-blur-md transition-all shadow-inner"
                />
                <button type="submit" disabled={isSearching} className="absolute right-3 top-3 bottom-3 px-8 bg-lime-400 text-slate-900 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-yellow-400 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-lime-400/20 flex items-center gap-2">
                  {isSearching ? <Loader2 className="animate-spin" size={20} /> : <><Sparkles size={18} /> Rastrear Recursos</>}
                </button>
              </form>
              <div className="mt-4 flex flex-wrap gap-2 px-2">
                 <span className="text-[9px] font-black text-lime-400 bg-lime-400/10 px-2 py-1 rounded border border-lime-400/20 uppercase">Chamamentos Públicos</span>
                 <span className="text-[9px] font-black text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20 uppercase">Editais de Fundações</span>
                 <span className="text-[9px] font-black text-blue-400 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20 uppercase">Incentivo Fiscal</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <aside className="lg:col-span-3 space-y-8">
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <div className="p-2 bg-slate-900 text-lime-400 rounded-lg"><ListFilter size={16} /></div>
                    Filtros da OSC
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Foco de Impacto</label>
                      <select value={filterRegiao} onChange={(e) => setFilterRegiao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-lime-400/10 transition-all cursor-pointer">
                        <option value="Todas">Brasil (Todas)</option>
                        {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Ente Financiador</label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-lime-400/10 transition-all cursor-pointer">
                        <option value="Todos">Todos</option>
                        <option value="Privado">Fundações Privadas</option>
                        <option value="Federal">Governo Federal</option>
                        <option value="Estadual">Governo Estadual</option>
                        <option value="Municipal">Prefeituras</option>
                      </select>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="col-span-full mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-lime-500 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {filteredResults.length} editais com potencial de impacto
                    </span>
                  </div>
                </div>
                {filteredResults.map((result, idx) => (
                  <div key={idx} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 hover:border-lime-400 hover:shadow-2xl hover:-translate-y-1 transition-all relative flex flex-col group animate-in fade-in slide-in-from-bottom-4">
                    <div className="absolute top-0 right-0 px-4 py-2 rounded-bl-2xl text-[9px] font-black uppercase bg-slate-900 text-lime-400 shadow-md">
                      {result.status}
                    </div>
                    <div className="mb-6 flex items-center gap-2">
                      <span className="px-3 py-1 bg-yellow-400/10 text-yellow-600 text-[9px] font-black rounded-lg uppercase">{result.regiao}</span>
                      <span className="px-3 py-1 bg-lime-400/10 text-lime-700 text-[9px] font-black rounded-lg uppercase">Score OSC</span>
                    </div>
                    <h4 className="font-black text-slate-900 mb-3 text-xl leading-tight group-hover:text-emerald-700 transition-colors line-clamp-2">{result.title}</h4>
                    <p className="text-xs font-medium text-slate-500 mb-8 line-clamp-3 leading-relaxed">{result.snippet}</p>
                    <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin size={14} className="text-yellow-500" />
                        <span className="text-[10px] font-black uppercase">{result.regiao}</span>
                      </div>
                      <button onClick={() => handleAnalyze(result)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-lime-400 hover:text-slate-900 transition-all shadow-xl shadow-slate-100 group-hover:shadow-lime-400/20">Analisar Elegibilidade</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MEU RADAR */}
        {activeTab === 'radar' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-12">
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-lime-400 via-yellow-400 to-lime-400"></div>
               <div className="relative z-10 text-center md:text-left">
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 italic">Radar de <span className="text-yellow-400">Impacto Social</span></h2>
                <p className="text-sm font-bold text-lime-400/80 uppercase tracking-widest">Oportunidades alinhadas à missão da sua OSC</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center md:justify-end max-w-md relative z-10">
                {preferences.keywords.map(kw => (
                  <span key={kw} className="px-4 py-2 bg-white/10 text-white text-[10px] font-black rounded-xl border border-white/20 uppercase backdrop-blur-md">{kw}</span>
                ))}
              </div>
            </div>

            {radarMatches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {radarMatches.map((result, idx) => (
                  <div key={idx} className="bg-white border-4 border-lime-400/20 rounded-[3rem] p-8 shadow-xl hover:shadow-2xl transition-all flex flex-col group relative">
                    <div className="absolute -top-4 -right-4 bg-yellow-400 text-slate-900 p-3 rounded-2xl shadow-lg rotate-12 group-hover:rotate-0 transition-transform">
                       <Leaf size={20} />
                    </div>
                    <div className="mb-6">
                      <span className="text-[10px] font-black text-slate-900 uppercase bg-lime-400 px-3 py-1 rounded-lg shadow-sm shadow-lime-400/20">Impacto Direto</span>
                    </div>
                    <h4 className="font-black text-slate-900 mb-4 text-2xl leading-tight group-hover:text-lime-600 transition-colors">{result.title}</h4>
                    <p className="text-sm font-medium text-slate-500 mb-8 flex-1 line-clamp-5 leading-relaxed">{result.snippet}</p>
                    <button onClick={() => handleAnalyze(result)} className="w-full py-5 bg-slate-900 text-lime-400 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] hover:bg-lime-400 hover:text-slate-900 transition-all shadow-xl shadow-slate-200">Ver Plano de Ação</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-[4rem] py-32 text-center shadow-inner">
                <Radar className="mx-auto mb-8 text-slate-200 animate-pulse" size={80} />
                <h3 className="text-2xl font-black text-slate-400 uppercase mb-4 tracking-tighter">Horizonte de Atuação</h3>
                <p className="text-sm font-bold text-slate-300 max-w-md mx-auto leading-relaxed">Nenhum edital de fomento direto encontrado para seus temas de impacto no momento.</p>
              </div>
            )}
          </div>
        )}

        {/* ANALYZED DOSSIERS SECTION */}
        {analyzedEditais.length > 0 && (
          <div ref={analyzedSectionRef} className="mt-32 space-y-16 scroll-mt-24 animate-in fade-in duration-1000">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-slate-900 text-lime-400 rounded-3xl flex items-center justify-center shadow-2xl border-b-4 border-yellow-400">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Dossiês de <span className="text-yellow-500 italic">Elegibilidade</span></h3>
                <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Análise técnica para Organizações da Sociedade Civil</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-16">
              {analyzedEditais.map(edital => (
                <div key={edital.id} className="bg-white border-x-4 border-slate-50 rounded-[4rem] p-16 shadow-[0_40px_100px_-15px_rgba(0,0,0,0.08)] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-lime-400 group-hover:w-4 transition-all"></div>
                  <div className="flex flex-wrap items-center gap-4 mb-12">
                    <span className="px-6 py-2.5 bg-slate-900 text-lime-400 text-[11px] font-black rounded-2xl uppercase tracking-[0.2em] shadow-xl">{edital.ente_pagador}</span>
                    {edital.areas.map(a => <span key={a} className="px-6 py-2.5 bg-yellow-400/10 text-yellow-700 text-[11px] font-black rounded-2xl uppercase border border-yellow-200">{a}</span>)}
                  </div>
                  <h4 className="text-5xl font-black text-slate-900 mb-10 leading-[1.1] tracking-tighter">{edital.nome_edital}</h4>
                  
                  <div className="p-12 bg-slate-50 rounded-[3rem] border-2 border-slate-100 mb-16 flex items-start gap-10 shadow-inner">
                    <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-lime-500 shadow-xl shrink-0">
                      <HeartHandshake size={40} />
                    </div>
                    <div>
                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Oportunidade para sua ONG</p>
                      <p className="text-slate-800 font-bold text-2xl leading-relaxed">{edital.objeto_resumido}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">
                     <div className="p-10 bg-white border-2 border-slate-50 rounded-[3rem] shadow-lg">
                        <h5 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <ShieldCheck size={18} className="text-lime-500" /> Requisitos de Elegibilidade
                        </h5>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed">{edital.elegibilidade}</p>
                     </div>
                     <div className="p-10 bg-white border-2 border-slate-50 rounded-[3rem] shadow-lg">
                        <h5 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <Ban size={18} className="text-red-500" /> Impedimentos & Vedações
                        </h5>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed">{edital.vedacoes}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
                    <div className="p-10 bg-white border-2 border-slate-50 rounded-[3rem] shadow-lg flex flex-col items-center text-center group/card hover:border-lime-400 transition-all">
                      <div className="w-16 h-16 bg-lime-50 text-lime-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm group-hover/card:bg-lime-400 group-hover/card:text-slate-900 transition-colors"><DollarSign size={32} /></div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Teto do Recurso</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">{edital.valor_teto}</p>
                    </div>
                    <div className="p-10 bg-white border-2 border-slate-50 rounded-[3rem] shadow-lg flex flex-col items-center text-center group/card hover:border-yellow-400 transition-all">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm group-hover/card:bg-yellow-400 group-hover/card:text-slate-900 transition-colors"><Calendar size={32} /></div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Data Limite</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">{edital.data_limite}</p>
                    </div>
                    <div className="p-10 bg-white border-2 border-slate-50 rounded-[3rem] shadow-lg flex flex-col items-center text-center group/card hover:border-slate-900 transition-all">
                      <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm group-hover/card:bg-slate-900 group-hover/card:text-white transition-colors"><Target size={32} /></div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Nível de Rigor</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">{edital.grau_dificuldade}/5</p>
                    </div>
                  </div>

                  <div className="p-10 bg-slate-900 text-white rounded-[3rem] mb-16">
                     <h5 className="text-[12px] font-black text-lime-400 uppercase tracking-widest mb-8 border-b border-white/10 pb-4">Checklist de Documentação Crítica</h5>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {edital.documentos_exigidos.map((doc, i) => (
                           <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                              <div className="w-5 h-5 bg-lime-400 rounded-full flex items-center justify-center text-slate-900 shrink-0"><Check size={12} strokeWidth={4} /></div>
                              {doc}
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between pt-12 border-t border-slate-100 gap-8">
                    <div className="flex items-center gap-6">
                       <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Analista Especialista em OSCs</p>
                    </div>
                    <a href={edital.link_origem} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 px-12 py-6 bg-slate-900 text-lime-400 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-lime-400 hover:text-slate-900 transition-all shadow-2xl hover:scale-[1.05] active:scale-95">
                      Abrir Chamamento <ExternalLink size={20} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* CHATBOT FAB & WINDOW */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-12 right-12 w-20 h-20 bg-slate-900 text-lime-400 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.4)] flex items-center justify-center hover:bg-lime-400 hover:text-slate-900 hover:scale-110 hover:-rotate-6 transition-all z-50 border-4 border-white group">
        {isChatOpen ? <X size={40} /> : <MessageSquare size={40} className="group-hover:animate-bounce" />}
      </button>

      {isChatOpen && (
        <div className="fixed bottom-36 right-12 w-[480px] h-[720px] max-w-[calc(100vw-4rem)] bg-white border-2 border-slate-200 rounded-[4rem] shadow-[0_40px_160px_-20px_rgba(0,0,0,0.5)] z-[60] flex flex-col overflow-hidden animate-in slide-in-from-bottom-16 duration-500">
          <div className="bg-slate-900 p-10 text-white flex items-center justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl"></div>
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-14 h-14 bg-lime-400 text-slate-900 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-xl shadow-lime-400/20 rotate-3">OSC</div>
              <div>
                <p className="text-xl font-black tracking-tight leading-none mb-2">Mentor <span className="text-yellow-400 italic">Pequi</span></p>
                <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 bg-lime-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(163,230,53,1)]" />
                   <span className="text-[11px] font-black text-lime-400 uppercase tracking-widest opacity-90">Consultoria do 3º Setor</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-4 hover:bg-white/10 rounded-2xl transition-colors relative z-10"><X size={24}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-slate-50/50 custom-scrollbar">
            {chatMessages.length === 0 && (
               <div className="text-center py-20 space-y-8">
                 <div className="w-24 h-24 bg-white rounded-[2rem] text-lime-500 mx-auto flex items-center justify-center shadow-xl border border-slate-100">
                    <HeartHandshake size={48} />
                 </div>
                 <div className="space-y-3">
                   <p className="text-slate-900 text-2xl font-black uppercase tracking-tighter italic">Como vamos transformar o mundo?</p>
                   <p className="text-slate-400 text-sm font-bold px-12 leading-relaxed opacity-70">Dúvidas sobre MROSC, certidões ou como enquadrar sua ONG em um edital? Pergunte aqui.</p>
                 </div>
               </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4`}>
                <div className={`max-w-[88%] p-8 rounded-[2.5rem] text-sm shadow-xl leading-relaxed ${msg.role === 'user' ? 'bg-slate-900 text-lime-400 font-bold rounded-tr-sm border-b-4 border-yellow-400' : 'bg-white border border-slate-200 text-slate-700 font-medium rounded-tl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-8 rounded-[2rem] rounded-tl-sm shadow-md">
                  <Loader2 size={24} className="animate-spin text-lime-500" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-8 bg-white border-t border-slate-100 shadow-inner">
            <div className="flex gap-4 bg-slate-100 p-3 rounded-[3rem] border-2 border-slate-200 focus-within:border-lime-500 focus-within:ring-8 focus-within:ring-lime-500/5 transition-all shadow-sm">
              <input 
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Pergunte sobre captação ou OSCs..."
                className="flex-1 bg-transparent px-8 py-5 text-sm font-black outline-none text-slate-900 placeholder:text-slate-400"
              />
              <button 
                onClick={handleSendMessage}
                disabled={isChatLoading || !currentInput.trim()}
                className="bg-slate-900 text-lime-400 p-6 rounded-[2.5rem] hover:bg-lime-400 hover:text-slate-900 transition-all disabled:opacity-50 shadow-xl shadow-slate-200 active:scale-95"
              >
                <Send size={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl z-[100] flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white rounded-[5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_40px_200px_-40px_rgba(0,0,0,0.6)] border-[16px] border-slate-50 p-16">
            <div className="flex justify-between items-center mb-16">
               <div className="flex items-center gap-6">
                  <div className="p-5 bg-slate-900 text-lime-400 rounded-[2rem] shadow-2xl border-b-4 border-yellow-400">
                    <SettingsIcon size={32} />
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter italic">Perfil da <span className="text-yellow-500">Missão</span></h2>
               </div>
               <button onClick={() => setIsSettingsOpen(false)} className="p-5 hover:bg-slate-100 rounded-[2rem] transition-all"><X size={36} className="text-slate-300" /></button>
            </div>
            
            <div className="space-y-16">
              <div className="space-y-8">
                <label className="text-[13px] font-black text-slate-900 uppercase tracking-[0.4em] block px-4 border-l-4 border-lime-500">Causas Sociais Prioritárias</label>
                <div className="flex flex-wrap gap-4 px-2">
                  {preferences.keywords.map(kw => (
                    <span key={kw} className="bg-slate-900 text-white px-6 py-4 rounded-[1.5rem] text-[12px] font-black border border-slate-700 flex items-center gap-4 group shadow-xl">
                      {kw}
                      <Trash2 size={16} className="cursor-pointer text-slate-500 hover:text-red-400 transition-colors" onClick={() => {
                        setPreferences(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));
                      }} />
                    </span>
                  ))}
                  <button className="px-6 py-4 bg-lime-100 text-lime-700 rounded-[1.5rem] text-[12px] font-black border-2 border-lime-200 border-dashed hover:border-lime-500 hover:bg-lime-50 transition-all flex items-center gap-3">
                    <Plus size={20} /> Adicionar Causa
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-8 bg-slate-900 text-lime-400 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm hover:bg-lime-400 hover:text-slate-900 transition-all shadow-[0_25px_60px_rgba(0,0,0,0.2)] active:scale-95 border-b-8 border-yellow-400 italic"
              >
                Ativar Radar Social
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY MODALS */}
      {processingUrl && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-3xl z-[100] flex items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="bg-white rounded-[5rem] p-20 max-w-xl w-full text-center shadow-[0_50px_150px_-30px_rgba(0,0,0,0.8)] border-[20px] border-slate-50">
            {status === AnalysisStatus.COMPLETED ? (
              <div className="animate-in zoom-in-75 duration-700">
                <div className="w-40 h-40 bg-lime-100 text-lime-600 rounded-full mx-auto mb-12 flex items-center justify-center shadow-inner ring-8 ring-lime-50">
                  <ShieldCheck size={80} strokeWidth={3} className="animate-in slide-in-from-bottom-8" />
                </div>
                <h3 className="text-4xl font-black text-slate-900 mb-6 uppercase tracking-tighter italic">Elegibilidade Mapeada!</h3>
                <p className="text-slate-500 font-bold text-lg leading-relaxed max-w-sm mx-auto">Verificamos os requisitos para sua ONG. O dossiê está pronto.</p>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="relative w-40 h-40 mx-auto">
                   <div className="absolute inset-0 border-[12px] border-slate-100 rounded-full shadow-inner" />
                   <div className="absolute inset-0 border-[12px] border-lime-500 rounded-full border-t-transparent animate-spin" />
                   <div className="absolute inset-0 m-auto w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-xl rotate-12 animate-pulse">
                      <HeartHandshake className="text-lime-400" size={48} />
                   </div>
                </div>
                <div className="space-y-6">
                  <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Sincronizando...</h3>
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-lime-600 text-[11px] font-black uppercase tracking-[0.5em] animate-pulse">
                      {status === AnalysisStatus.SCRAPING ? 'Infiltrando no Chamamento' : 'Auditando Documentos'}
                    </p>
                    <p className="text-slate-400 text-base font-bold opacity-80 max-w-xs mx-auto">
                      O CaçaPequi está lendo o edital sob a ótica da Lei 13.019 (MROSC).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
