import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, ExternalLink, Folder, ArrowLeft, BookOpen
} from 'lucide-react';
import { SpotlightCard } from './ui/spotlight-card';

interface LinkDocument {
  id: string;
  title: string;
  url: string;
  category: string;
  emoji?: string;
}

const generateId = () => Math.random().toString(36).substring(7);

const EMOJIS = ['📄', '📚', '📋', '📁', '💡', '📌', '📈', '🏥', '🦷', '💰', '🚀', '⭐', '📱', '⚙️', '🔍'];
const getRandomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

export const Biblioteca: React.FC = () => {
  const [links, setLinks] = useState<LinkDocument[]>(() => {
    try {
      const savedLinks = localStorage.getItem('clinica-biblioteca-links');
      if (savedLinks) {
          try {
              return JSON.parse(savedLinks);
          } catch {
              return [];
          }
      }
    } catch (e) {
      console.warn("Could not read from localStorage inside Biblioteca.tsx:", e);
    }
    return [
      { id: '1', title: 'Apresentação Institucional', url: 'https://example.com', category: 'Marketing', emoji: '📢' },
      { id: '2', title: 'Tabela de Preços', url: 'https://example.com', category: 'Comercial', emoji: '💰' },
      { id: '3', title: 'Manual de Equipamentos', url: 'https://example.com', category: 'Clínica', emoji: '🏥' }
    ];
  });
  
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  useEffect(() => {
    try {
      localStorage.setItem('clinica-biblioteca-links', JSON.stringify(links));
    } catch (e) {
      console.warn("Could not write to localStorage inside Biblioteca.tsx:", e);
    }
  }, [links]);

  const removeLink = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLinks(links.filter(l => l.id !== id));
    if (selectedPreviewId === id) setSelectedPreviewId(null);
  };

  const handleAddPage = (category: string = 'Geral') => {
    const newPage: LinkDocument = {
        id: generateId(),
        title: '',
        url: '',
        category: category,
        emoji: getRandomEmoji()
    };
    setLinks([...links, newPage]);
    setSelectedPreviewId(newPage.id);
  };

  const selectedLink = links.find(l => l.id === selectedPreviewId);

  const updateCurrentPage = (updates: Partial<LinkDocument>) => {
    if (!selectedLink) return;
    const updated = { ...selectedLink, ...updates };
    setLinks(links.map(l => l.id === updated.id ? updated : l));
  };

  // Obter categorias únicas
  const categories = useMemo(() => {
    const cats = links.map(l => l.category || 'Geral');
    return ['Todos', ...Array.from(new Set(cats))];
  }, [links]);

  // Filtrar links
  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      const matchesSearch = (link.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (link.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || link.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [links, searchTerm, selectedCategory]);

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar relative z-10 w-full">
        <div className="w-full h-full max-w-7xl mx-auto relative z-10">
          
          {selectedLink ? (
            /* ================= DETAILED VIEW / EDITOR ================= */
            <div className="w-full mx-auto py-4 flex flex-col min-h-full animate-in fade-in duration-300">
              
              {/* Back to Library Header */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
                <button 
                  onClick={() => setSelectedPreviewId(null)}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-text transition-all glass-button px-4 py-2 rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para Biblioteca
                </button>
                
                {selectedLink.url && (
                  <a 
                    href={selectedLink.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-all glass-button bg-emerald-500/10 border-emerald-500/20 px-4 py-2 rounded-xl"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir link original
                  </a>
                )}
              </div>

              {/* Document Header */}
              <div className="mb-6 group relative">
                {/* Title Input */}
                <input 
                  type="text" 
                  value={selectedLink.title} 
                  onChange={e => updateCurrentPage({ title: e.target.value })}
                  placeholder="Documento sem título"
                  className="text-4xl md:text-5xl font-bold text-text bg-transparent outline-none w-full placeholder-white/20 block resize-none leading-tight"
                />
              </div>
              
              {/* Properties */}
              <div className="flex flex-col gap-2 mb-10 w-full max-w-xl border-b border-border pb-6">
                <div className="flex items-center group/prop">
                  <div className="w-32 flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Folder className="w-4 h-4 text-indigo-400" />
                    <span>Categoria</span>
                  </div>
                  <input 
                    className="flex-1 bg-transparent border-b border-transparent hover:border-border focus:border-white/20 text-text outline-none text-sm transition-colors py-1.5 px-2 rounded-lg hover:bg-panel focus:bg-panel"
                    value={selectedLink.category}
                    onChange={e => updateCurrentPage({ category: e.target.value })}
                    placeholder="Defina uma categoria..."
                  />
                </div>
                <div className="flex items-center group/prop">
                  <div className="w-32 flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                    <span>URL / Link</span>
                  </div>
                  <input 
                    className="flex-1 bg-transparent border-b border-transparent hover:border-border focus:border-white/20 text-blue-400 outline-none text-sm transition-colors py-1.5 px-2 rounded-lg hover:bg-panel focus:bg-panel font-mono"
                    value={selectedLink.url}
                    onChange={e => updateCurrentPage({ url: e.target.value })}
                    placeholder="Cole a URL ou link do manual aqui..."
                  />
                </div>
              </div>

              {/* Main body: Iframe or empty content placeholder */}
              <div className="flex-1 flex flex-col pb-20 min-h-[500px]">
                {selectedLink.url ? (
                  <div className="flex-1 w-full flex flex-col gap-2 relative h-full">
                    <div className="w-full h-[600px] bg-transparent border border-border rounded-2xl overflow-hidden group/iframe relative shadow-2xl">
                      <iframe src={selectedLink.url} className="w-full h-full absolute inset-0 border-0" title={selectedLink.title} />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-2xl bg-white/[0.01]">
                    <BookOpen className="w-12 h-12 text-slate-500 mb-4 stroke-1" />
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-1">Nenhum Link Cadastrado</p>
                    <p className="text-xs text-slate-500 max-w-sm text-center">Cole uma URL de um manual, documento do Google Drive ou site no campo de link acima para incorporá-lo aqui.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= MAIN GALLERY VIEW ================= */
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Header Title section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-text leading-tight tracking-tight mb-2">
                    Biblioteca de Manuais
                  </h1>
                  <p className="text-slate-400 text-sm">
                    Acesso centralizado aos documentos, links, manuais e materiais de apoio da clínica.
                  </p>
                </div>

                <div className="flex gap-2 text-sm justify-end">
                  <button 
                    onClick={() => handleAddPage()}
                    className="px-6 py-2 glass-button glass-button-primary text-text rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Link
                  </button>
                </div>
              </div>

              {/* Sub-navigation style Search and Category Pills Bar */}
              <div className="border-b border-border pb-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Category Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`
                          px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap glass-button
                          ${selectedCategory === cat 
                            ? 'bg-panel/80 text-text shadow-lg' 
                            : 'text-slate-500 opacity-60 hover:opacity-100'}
                        `}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Search bar */}
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Pesquisar manuais..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-panel hover:bg-panel/80 focus:bg-panel/80 border border-border rounded-xl py-2 pl-9 pr-4 text-xs text-text outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Grid of Documents */}
              {filteredLinks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLinks.map(link => (
                    <SpotlightCard
                      key={link.id}
                      onClick={() => setSelectedPreviewId(link.id)}
                      className="glass-panel rounded-2xl border border-border bg-surface p-6 relative overflow-hidden flex flex-col justify-between group transition-all hover:border-white/20 cursor-pointer h-48"
                      spotlightColor="rgba(99, 102, 241, 0.3)"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-4xl">{link.emoji || '📄'}</span>
                          <button
                            onClick={(e) => removeLink(link.id, e)}
                            className="p-1.5 rounded bg-panel hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remover documento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <h3 className="text-text font-bold text-lg leading-snug line-clamp-2">
                            {link.title || 'Documento sem título'}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 pt-4 border-t border-border">
                        <Folder className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{link.category || 'Geral'}</span>
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 border border-dashed border-border rounded-2xl bg-white/[0.01]">
                  <BookOpen className="w-12 h-12 mx-auto stroke-1 text-slate-600 mb-4" />
                  <p className="font-bold text-sm uppercase tracking-wider mb-1 text-slate-400">Nenhum manual encontrado</p>
                  <p className="text-xs text-slate-500">Tente buscar por outro termo ou adicione um novo documento.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
