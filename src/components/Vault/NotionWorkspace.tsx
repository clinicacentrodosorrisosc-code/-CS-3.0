import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, Edit3, Save, Star, Pin, 
  CheckSquare, Square, 
  Heading1, Heading2, Heading3, List, Quote, 
  Sparkles, Folder, Tag, Download, Copy, Check,
  X, ChevronRight
} from 'lucide-react';
import { VAULT_TEMPLATES, VaultTemplate } from './vaultTemplates';

export interface NotionPage {
  id: string;
  title: string;
  emoji: string;
  coverGradient?: string;
  category: string;
  tags: string[];
  isPinned?: boolean;
  content: string;
  updatedAt: string;
  createdAt: string;
}

const EMOJI_PRESETS = [
  '📑', '🏛️', '🎯', '💰', '🛡️', '💼', '🔒', '🔑', '📊', '📈', 
  '🚀', '⭐', '💡', '🤝', '⚖️', '🏥', '🦷', '💎', '🔥', '📌', 
  '📋', '🛠️', '📱', '🌐', '👥', '🏆', '🎁', '⚡', '🧠', '✨'
];

const COVER_GRADIENTS = [
  { id: 'rose', label: 'Rubi Gestão', css: 'from-rose-950/80 via-purple-950/40 to-slate-950/80 border-rose-500/30' },
  { id: 'indigo', label: 'Índigo Executivo', css: 'from-indigo-950/80 via-blue-950/40 to-slate-950/80 border-indigo-500/30' },
  { id: 'emerald', label: 'Esmeralda Prosperidade', css: 'from-emerald-950/80 via-teal-950/40 to-slate-950/80 border-emerald-500/30' },
  { id: 'amber', label: 'Ouro Estratégico', css: 'from-amber-950/80 via-orange-950/40 to-slate-950/80 border-amber-500/30' },
  { id: 'slate', label: 'Grafite Minimalista', css: 'from-slate-900 via-slate-950 to-slate-950 border-slate-700/40' },
  { id: 'cyan', label: 'Ciano Inovação', css: 'from-cyan-950/80 via-sky-950/40 to-slate-950/80 border-cyan-500/30' }
];

const CATEGORIES = [
  'Todas',
  'Estratégia & Sócios',
  'Finanças & Acordos',
  'Operações Confidenciais',
  'RH & Remuneração',
  'Contratos & Jurídico',
  'Ideias & Inovação',
  'Geral'
];

export const NotionWorkspace: React.FC = () => {
  const [pages, setPages] = useState<NotionPage[]>(() => {
    try {
      const saved = localStorage.getItem('odontomanager_vault_notion_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading vault pages from storage:', e);
    }
    // Pre-populate with initial rich templates
    return VAULT_TEMPLATES.filter(t => t.id !== 'tpl_blank').map((t, idx) => ({
      id: 'page_' + (idx + 1),
      title: t.title,
      emoji: t.emoji,
      coverGradient: COVER_GRADIENTS[idx % COVER_GRADIENTS.length].css,
      category: t.category,
      tags: t.tags,
      isPinned: idx === 0 || idx === 1,
      content: t.content,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }));
  });

  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    return pages.length > 0 ? pages[0].id : null;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todas');
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [pageToDelete, setPageToDelete] = useState<NotionPage | null>(null);

  // Form State during Edit
  const [editTitle, setEditTitle] = useState('');
  const [editEmoji, setEditEmoji] = useState('📑');
  const [editCategory, setEditCategory] = useState('Estratégia & Sócios');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editContent, setEditContent] = useState('');
  const [editCover, setEditCover] = useState(COVER_GRADIENTS[0].css);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('odontomanager_vault_notion_pages', JSON.stringify(pages));
    } catch (e) {
      console.warn('Error writing vault pages to storage:', e);
    }
  }, [pages]);

  const activePage = useMemo(() => {
    return pages.find(p => p.id === selectedPageId) || pages[0] || null;
  }, [pages, selectedPageId]);

  const startEditingPage = () => {
    if (!activePage) return;
    setEditTitle(activePage.title);
    setEditEmoji(activePage.emoji);
    setEditCategory(activePage.category);
    setEditTags(activePage.tags || []);
    setEditContent(activePage.content);
    setEditCover(activePage.coverGradient || COVER_GRADIENTS[0].css);
    setIsEditing(true);
  };

  const handleSelectPage = (id: string) => {
    setSelectedPageId(id);
    setIsEditing(false);
  };

  // Filtered pages for sidebar
  const filteredPages = useMemo(() => {
    return pages.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCat = selectedCategoryFilter === 'Todas' || p.category === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [pages, searchQuery, selectedCategoryFilter]);

  const pinnedPages = useMemo(() => {
    return filteredPages.filter(p => p.isPinned);
  }, [filteredPages]);

  const unpinnedPages = useMemo(() => {
    return filteredPages.filter(p => !p.isPinned);
  }, [filteredPages]);

  // Create page from template or blank
  const handleCreateFromTemplate = (template: VaultTemplate) => {
    const newPage: NotionPage = {
      id: 'page_' + Date.now(),
      title: template.title,
      emoji: template.emoji,
      coverGradient: COVER_GRADIENTS[Math.floor(Math.random() * COVER_GRADIENTS.length)].css,
      category: template.category,
      tags: [...template.tags],
      isPinned: false,
      content: template.content,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    setPages(prev => [newPage, ...prev]);
    setSelectedPageId(newPage.id);
    setShowTemplateModal(false);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!activePage) return;
    const updated: NotionPage = {
      ...activePage,
      title: editTitle.trim() || 'Sem Título',
      emoji: editEmoji,
      category: editCategory,
      tags: editTags,
      coverGradient: editCover,
      content: editContent,
      updatedAt: new Date().toISOString()
    };

    setPages(prev => prev.map(p => p.id === activePage.id ? updated : p));
    setIsEditing(false);
  };

  const handleDeletePage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = pages.find(p => p.id === id);
    if (target) {
      setPageToDelete(target);
    }
  };

  const confirmDeletePage = () => {
    if (!pageToDelete) return;
    const remaining = pages.filter(p => p.id !== pageToDelete.id);
    
    if (remaining.length === 0) {
      const fallbackPage: NotionPage = {
        id: 'page_' + Date.now(),
        title: 'Documento em Branco',
        emoji: '📑',
        coverGradient: COVER_GRADIENTS[0].css,
        category: 'Geral',
        tags: ['Geral'],
        isPinned: false,
        content: '# Documento em Branco\n\nComece a digitar anotações ou escolha um modelo para as diretrizes da clínica...',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      setPages([fallbackPage]);
      setSelectedPageId(fallbackPage.id);
    } else {
      setPages(remaining);
      if (selectedPageId === pageToDelete.id) {
        setSelectedPageId(remaining[0].id);
      }
    }
    
    setPageToDelete(null);
    setIsEditing(false);
  };

  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPages(prev => prev.map(p => p.id === id ? { ...p, isPinned: !p.isPinned } : p));
  };

  const handleDuplicatePage = () => {
    if (!activePage) return;
    const duplicate: NotionPage = {
      ...activePage,
      id: 'page_' + Date.now(),
      title: `${activePage.title} (Cópia)`,
      isPinned: false,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    setPages(prev => [duplicate, ...prev]);
    setSelectedPageId(duplicate.id);
    setIsEditing(false);
  };

  // Interactive Checklist toggle on rendered view
  const handleToggleChecklistItem = (itemText: string) => {
    if (!activePage) return;
    const lines = activePage.content.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes(`[ ] ${itemText}`)) {
        return line.replace(`[ ] ${itemText}`, `[x] ${itemText}`);
      } else if (line.includes(`[x] ${itemText}`)) {
        return line.replace(`[x] ${itemText}`, `[ ] ${itemText}`);
      }
      return line;
    });
    const newContent = updatedLines.join('\n');
    const updatedPage = {
      ...activePage,
      content: newContent,
      updatedAt: new Date().toISOString()
    };
    setPages(prev => prev.map(p => p.id === activePage.id ? updatedPage : p));
    setEditContent(newContent);
  };

  // Insert block helpers for Notion editor
  const insertBlock = (snippet: string) => {
    setEditContent(prev => {
      if (!prev) return snippet;
      return prev + '\n\n' + snippet;
    });
  };

  const handleCopyContent = () => {
    if (!activePage) return;
    navigator.clipboard.writeText(`${activePage.emoji} ${activePage.title}\n\n${activePage.content}`);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const handleExportText = () => {
    if (!activePage) return;
    const element = document.createElement('a');
    const file = new Blob([`${activePage.emoji} ${activePage.title}\n\n${activePage.content}`], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${activePage.title.replace(/\s+/g, '_').toLowerCase()}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      if (!editTags.includes(newTagInput.trim())) {
        setEditTags([...editTags, newTagInput.trim()]);
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(t => t !== tagToRemove));
  };

  // Simple and beautiful Markdown/Notion renderer
  const renderNotionContent = (content: string) => {
    if (!content) {
      return (
        <div className="text-slate-500 italic py-10 text-center">
          Página em branco. Clique em <span className="text-rose-400 font-bold">Editar Página</span> para adicionar conteúdo estruturado.
        </div>
      );
    }

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();

      // Table parsing
      if (line.startsWith('|') && line.endsWith('|')) {
        inTable = true;
        const cols = line.split('|').slice(1, -1).map(c => c.trim());
        // Skip separator row like |---|---|
        if (!cols.every(c => c.match(/^:?-+:?$/))) {
          tableRows.push(cols);
        }
        return;
      } else if (inTable) {
        // Render completed table
        if (tableRows.length > 0) {
          const header = tableRows[0];
          const body = tableRows.slice(1);
          elements.push(
            <div key={`table_${idx}`} className="my-4 overflow-x-auto rounded-xl border border-border bg-panel/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-900/50">
                    {header.map((th, hIdx) => (
                      <th key={hIdx} className="px-4 py-2.5 font-bold text-slate-300 uppercase tracking-wider">{th}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {body.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-surface/50 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2 text-slate-300">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          tableRows = [];
        }
        inTable = false;
      }

      // Empty line
      if (!line) {
        elements.push(<div key={`blank_${idx}`} className="h-3" />);
        return;
      }

      // Horizontal Divider
      if (line === '---' || line === '***' || line === '___') {
        elements.push(<hr key={`hr_${idx}`} className="border-border my-6" />);
        return;
      }

      // Headings
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={`h1_${idx}`} className="text-2xl md:text-3xl font-extrabold text-text mt-6 mb-3 tracking-tight flex items-center gap-2">
            {line.replace('# ', '')}
          </h1>
        );
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={`h2_${idx}`} className="text-xl md:text-2xl font-bold text-text mt-5 mb-2 tracking-tight flex items-center gap-2">
            {line.replace('## ', '')}
          </h2>
        );
        return;
      }
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={`h3_${idx}`} className="text-base md:text-lg font-bold text-slate-200 mt-4 mb-2 tracking-wide">
            {line.replace('### ', '')}
          </h3>
        );
        return;
      }

      // Callout / Blockquote
      if (line.startsWith('> ')) {
        const text = line.replace('> ', '');
        elements.push(
          <div key={`callout_${idx}`} className="my-3 p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-200 text-sm flex items-start gap-3 shadow-inner">
            <span className="text-lg">🔒</span>
            <div className="flex-1 font-medium">{text}</div>
          </div>
        );
        return;
      }

      // Interactive Checklist / Todo Item
      if (line.startsWith('- [ ] ') || line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
        const isChecked = line.startsWith('- [x] ') || line.startsWith('- [X] ');
        const itemText = line.replace(/^- \[[ xX]\] /, '');
        elements.push(
          <div 
            key={`todo_${idx}`} 
            onClick={() => handleToggleChecklistItem(itemText)}
            className="flex items-start gap-3 my-1.5 py-1 px-2 rounded-lg hover:bg-surface/60 transition-colors cursor-pointer group select-none"
          >
            <button className="mt-0.5 text-slate-400 group-hover:text-rose-400 transition-colors">
              {isChecked ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
            </button>
            <span className={`text-sm ${isChecked ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}`}>
              {itemText}
            </span>
          </div>
        );
        return;
      }

      // Bullet List
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.substring(2);
        elements.push(
          <div key={`bullet_${idx}`} className="flex items-start gap-2.5 my-1 text-sm text-slate-300 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 flex-shrink-0" />
            <span className="leading-relaxed">{text}</span>
          </div>
        );
        return;
      }

      // Numbered List
      const numberMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numberMatch) {
        elements.push(
          <div key={`num_${idx}`} className="flex items-start gap-2.5 my-1 text-sm text-slate-300 pl-2">
            <span className="font-bold text-rose-400 text-xs mt-0.5 flex-shrink-0">{numberMatch[1]}.</span>
            <span className="leading-relaxed">{numberMatch[2]}</span>
          </div>
        );
        return;
      }

      // Standard Paragraph
      elements.push(
        <p key={`p_${idx}`} className="text-sm text-slate-300 leading-relaxed my-1.5">
          {line}
        </p>
      );
    });

    return elements;
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full w-full bg-transparent overflow-hidden">
      
      {/* ================= LEFT SIDEBAR (NOTION STYLE) ================= */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-surface/40 flex flex-col h-full overflow-hidden">
        
        {/* Sidebar Header & Search */}
        <div className="p-4 border-b border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📁</span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-text">Páginas da Gestão</h3>
                <span className="text-[10px] text-slate-500">{pages.length} docs confidenciais</span>
              </div>
            </div>

            <button
              onClick={() => setShowTemplateModal(true)}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/30 transition-all active:scale-95"
              title="Nova Página ou Template"
            >
              <Plus className="w-4 h-4" />
              <span>Criar</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar em todos os docs..."
              className="w-full bg-panel border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text outline-none focus:border-rose-500/50 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-text">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            {CATEGORIES.slice(0, 5).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  selectedCategoryFilter === cat 
                    ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' 
                    : 'text-slate-400 hover:text-slate-200 bg-panel border border-border/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Pages List Navigation */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          
          {/* Pinned / Favorites Section */}
          {pinnedPages.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>Fixados & Favoritos</span>
              </div>
              <div className="mt-1 space-y-1">
                {pinnedPages.map(page => (
                  <div
                    key={page.id}
                    onClick={() => handleSelectPage(page.id)}
                    className={`group w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer border ${
                      activePage?.id === page.id
                        ? 'bg-rose-950/40 border-rose-500/40 text-text shadow-sm'
                        : 'border-transparent hover:bg-panel hover:border-border text-slate-400 hover:text-text'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-base flex-shrink-0">{page.emoji}</span>
                      <span className="text-xs font-semibold truncate flex-1">{page.title}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleTogglePin(page.id, e)}
                        className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-surface"
                        title="Desafixar"
                      >
                        <Pin className="w-3 h-3 fill-amber-400" />
                      </button>
                      <button
                        onClick={(e) => handleDeletePage(page.id, e)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-surface"
                        title="Excluir documento"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Workspace Pages */}
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Folder className="w-3 h-3" />
              <span>Documentos ({unpinnedPages.length})</span>
            </div>
            <div className="mt-1 space-y-1">
              {unpinnedPages.length === 0 && pinnedPages.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">Nenhum documento encontrado.</div>
              ) : (
                unpinnedPages.map(page => (
                  <div
                    key={page.id}
                    onClick={() => handleSelectPage(page.id)}
                    className={`group w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer border ${
                      activePage?.id === page.id
                        ? 'bg-rose-950/40 border-rose-500/40 text-text shadow-sm'
                        : 'border-transparent hover:bg-panel hover:border-border text-slate-400 hover:text-text'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-base flex-shrink-0">{page.emoji}</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold truncate">{page.title}</span>
                        <span className="text-[9px] text-slate-500 truncate">{page.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleTogglePin(page.id, e)}
                        className="p-1 text-slate-500 hover:text-amber-400 rounded hover:bg-surface"
                        title="Fixar no topo"
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeletePage(page.id, e)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-surface"
                        title="Excluir documento"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Sidebar Footer Quick Action */}
        <div className="p-3 border-t border-border bg-panel/50">
          <button
            onClick={() => handleCreateFromTemplate(VAULT_TEMPLATES.find(t => t.id === 'tpl_blank')!)}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-border hover:border-rose-500/50 hover:bg-rose-950/20 text-slate-400 hover:text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Página em Branco</span>
          </button>
        </div>
      </div>

      {/* ================= MAIN NOTION CANVAS / EDITOR ================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activePage ? (
          <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar">
            
            {/* Top Cover Banner */}
            <div className={`w-full h-32 md:h-40 bg-gradient-to-r ${activePage.coverGradient || COVER_GRADIENTS[0].css} relative border-b border-border flex items-end p-6 transition-all`}>
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {isEditing ? (
                  <button
                    onClick={() => setShowCoverPicker(!showCoverPicker)}
                    className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Alterar Capa
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyContent}
                      className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
                      title="Copiar Conteúdo"
                    >
                      {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedNotification ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                    <button
                      onClick={handleExportText}
                      className="p-1.5 rounded-lg bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 text-slate-200 hover:text-white transition-all"
                      title="Exportar Markdown"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTogglePin(activePage.id)}
                      className={`p-1.5 rounded-lg backdrop-blur-md border transition-all ${
                        activePage.isPinned 
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                          : 'bg-black/40 border-white/10 text-slate-300 hover:text-white'
                      }`}
                      title={activePage.isPinned ? 'Desafixar' : 'Fixar nos favoritos'}
                    >
                      <Star className={`w-4 h-4 ${activePage.isPinned ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Cover Gradient Selection Menu */}
              {showCoverPicker && isEditing && (
                <div className="absolute top-14 right-4 bg-surface border border-border p-3 rounded-2xl shadow-2xl z-30 grid grid-cols-2 gap-2 w-64 animate-in fade-in zoom-in-95">
                  {COVER_GRADIENTS.map(cg => (
                    <button
                      key={cg.id}
                      onClick={() => { setEditCover(cg.css); setShowCoverPicker(false); }}
                      className={`p-2 rounded-xl border text-[11px] font-bold text-left bg-gradient-to-r ${cg.css} hover:brightness-125 transition-all text-white`}
                    >
                      {cg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Document Header & Emoji Icon */}
            <div className="px-6 md:px-12 pt-0 pb-6 max-w-5xl w-full mx-auto relative -mt-10 flex-1 flex flex-col">
              
              <div className="flex items-end justify-between gap-4 mb-4">
                {/* Emoji Selector */}
                <div className="relative">
                  <button
                    onClick={() => isEditing && setShowEmojiPicker(!showEmojiPicker)}
                    disabled={!isEditing}
                    className={`w-20 h-20 rounded-2xl bg-surface border-2 border-border flex items-center justify-center text-4xl shadow-xl transition-all ${
                      isEditing ? 'hover:scale-105 hover:border-rose-500/50 cursor-pointer' : ''
                    }`}
                  >
                    {isEditing ? editEmoji : activePage.emoji}
                  </button>

                  {showEmojiPicker && isEditing && (
                    <div className="absolute top-22 left-0 bg-surface border border-border p-3 rounded-2xl shadow-2xl z-30 grid grid-cols-6 gap-2 w-64 animate-in fade-in zoom-in-95">
                      {EMOJI_PRESETS.map(em => (
                        <button
                          key={em}
                          onClick={() => { setEditEmoji(em); setShowEmojiPicker(false); }}
                          className="w-8 h-8 rounded-lg hover:bg-panel flex items-center justify-center text-xl transition-transform hover:scale-125"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Main Action Bar */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 rounded-xl bg-panel hover:bg-surface border border-border text-slate-300 text-xs font-bold transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-900/40 transition-all active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        Salvar Alterações
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleDuplicatePage}
                        className="px-3 py-2 rounded-xl bg-panel hover:bg-surface border border-border text-slate-300 text-xs font-bold transition-all"
                        title="Duplicar Página"
                      >
                        Duplicar
                      </button>
                      <button
                        onClick={(e) => handleDeletePage(activePage.id, e)}
                        className="p-2 rounded-xl bg-panel hover:bg-rose-950/40 border border-border hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all"
                        title="Excluir Página"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={startEditingPage}
                        className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-900/40 transition-all active:scale-95"
                      >
                        <Edit3 className="w-4 h-4" />
                        Editar Página
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Title & Metadata */}
              {isEditing ? (
                <div className="space-y-4 mb-6">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Título do Documento..."
                    className="text-2xl md:text-3xl font-extrabold text-text bg-panel/50 border border-border rounded-xl px-4 py-2.5 w-full outline-none focus:border-rose-500/50 transition-colors"
                  />

                  <div className="flex flex-wrap items-center gap-3 p-3 bg-panel/30 border border-border rounded-xl">
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-xs font-bold text-slate-400">Categoria:</span>
                      <select
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        className="bg-panel border border-border rounded-lg px-2.5 py-1 text-xs text-text font-bold outline-none"
                      >
                        {CATEGORIES.filter(c => c !== 'Todas').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-400">Tags:</span>
                      <div className="flex flex-wrap items-center gap-1.5 flex-1">
                        {editTags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1">
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-rose-400"><X className="w-2.5 h-2.5" /></button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={handleAddTag}
                          placeholder="+ Tag (Enter)"
                          className="bg-transparent border-none text-xs text-text outline-none w-24"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notion Block Inserter Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface border border-border rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">Inserir Bloco:</span>
                    <button
                      type="button"
                      onClick={() => insertBlock('# Título da Seção')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold flex items-center gap-1"
                    >
                      <Heading1 className="w-3.5 h-3.5" /> H1
                    </button>
                    <button
                      type="button"
                      onClick={() => insertBlock('## Subtítulo')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold flex items-center gap-1"
                    >
                      <Heading2 className="w-3.5 h-3.5" /> H2
                    </button>
                    <button
                      type="button"
                      onClick={() => insertBlock('### Tópico Menor')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold flex items-center gap-1"
                    >
                      <Heading3 className="w-3.5 h-3.5" /> H3
                    </button>
                    <button
                      type="button"
                      onClick={() => insertBlock('- [ ] Nova Ação / Tarefa')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> To-Do
                    </button>
                    <button
                      type="button"
                      onClick={() => insertBlock('- Item da Lista')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold flex items-center gap-1"
                    >
                      <List className="w-3.5 h-3.5 text-rose-400" /> Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => insertBlock('> 🔒 Nota Confidencial da Gestão')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold flex items-center gap-1"
                    >
                      <Quote className="w-3.5 h-3.5 text-amber-400" /> Callout
                    </button>
                    <button
                      type="button"
                      onClick={() => insertBlock('| Item / Meta | Responsável | Prazo |\n|---|---|---|\n| Negociação de Contrato | Direção | 15 dias |\n| Revisão DRE | Financeiro | 10 dias |')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold flex items-center gap-1"
                    >
                      Tabela
                    </button>
                    <button
                      type="button"
                      onClick={() => insertBlock('---')}
                      className="px-2.5 py-1 rounded-lg bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold"
                    >
                      Divisor
                    </button>
                  </div>

                  {/* Textarea Editor */}
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    placeholder="Escreva seu documento executivo... Suporta títulos (#, ##), listas (- ), checklists (- [ ]), notas em destaque (> ), tabelas (| col |) e divisores (---)."
                    className="w-full h-96 p-4 rounded-xl bg-panel/60 border border-border text-text font-mono text-sm leading-relaxed outline-none focus:border-rose-500/50 resize-y custom-scrollbar"
                  />
                </div>
              ) : (
                <div className="space-y-4 mb-8">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-text tracking-tight mb-2 flex items-center gap-3">
                      {activePage.title}
                    </h1>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                        {activePage.category}
                      </span>
                      {activePage.tags && activePage.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-panel text-slate-400 border border-border text-[10px] font-bold">
                          #{t}
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-500 ml-auto">
                        Atualizado em {new Date(activePage.updatedAt).toLocaleDateString('pt-BR')} às {new Date(activePage.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <hr className="border-border my-4" />

                  {/* Rendered Notion Body */}
                  <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-sans min-h-[300px]">
                    {renderNotionContent(activePage.content)}
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 gap-4">
            <Folder className="w-16 h-16 opacity-20" />
            <p className="text-sm font-semibold">Nenhum documento selecionado.</p>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all"
            >
              Criar Primeira Página
            </button>
          </div>
        )}
      </div>

      {/* ================= NOTION TEMPLATE PICKER MODAL ================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xl">
                  ✨
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">Escolher Template da Gestão</h3>
                  <p className="text-xs text-slate-400">Modelos prontos e estruturados para governança, reuniões e estratégia.</p>
                </div>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 text-slate-400 hover:text-text rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
              {VAULT_TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => handleCreateFromTemplate(tpl)}
                  className="p-4 rounded-2xl border border-border bg-panel hover:bg-surface hover:border-rose-500/40 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl p-2 rounded-xl bg-surface border border-border group-hover:scale-110 transition-transform">
                      {tpl.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-text group-hover:text-rose-300 transition-colors truncate">
                        {tpl.title}
                      </h4>
                      <span className="text-[10px] text-rose-400 font-bold uppercase">{tpl.category}</span>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {tpl.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-slate-500">
                    <div className="flex gap-1 overflow-hidden">
                      {tpl.tags.slice(0, 2).map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-surface text-slate-400">#{t}</span>
                      ))}
                    </div>
                    <span className="text-rose-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Usar <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border bg-panel flex justify-end">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-5 py-2 text-slate-400 hover:text-text text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {pageToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-3xl mb-4 shadow-inner">
                {pageToDelete.emoji || '🗑️'}
              </div>
              
              <h3 className="text-base font-extrabold text-text mb-1">
                Excluir Documento?
              </h3>
              
              <div className="my-2 px-3 py-1.5 bg-rose-950/40 rounded-xl border border-rose-500/30 max-w-full">
                <p className="text-xs text-rose-300 font-bold truncate">
                  "{pageToDelete.title}"
                </p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mt-2 mb-6">
                Esta ação é irreversível e removerá este documento e suas anotações estratégicas do cofre da gestão.
              </p>

              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setPageToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl bg-panel hover:bg-panel/80 border border-border text-slate-300 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeletePage}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
