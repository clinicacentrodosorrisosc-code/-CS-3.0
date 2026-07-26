const fs = require('fs');

let code = fs.readFileSync('src/components/ClinicIdeas.tsx', 'utf8');

code = code.replace(
  /const loadIdeas = async \(\) => \{[\s\S]*?^  \};/m,
  `const loadIdeas = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('clinic_ideas');
      if (stored) {
        setIdeas(JSON.parse(stored));
      } else {
        setIdeas([]);
      }
    } catch (error: any) {
      console.error('Error loading ideas:', error);
      toast.error('Erro ao carregar ideias');
    } finally {
      setLoading(false);
    }
  };`
);

code = code.replace(
  /const handleSaveIdea = async \(\) => \{[\s\S]*?^  \};/m,
  `const handleSaveIdea = () => {
    if (!formData.title) return toast.error('O título é obrigatório');

    try {
      let currentIdeas = [...ideas];
      if (editingIdea) {
        currentIdeas = currentIdeas.map(idea => 
          idea.id === editingIdea.id 
            ? { ...idea, ...formData, updated_at: new Date().toISOString() } 
            : idea
        );
        toast.success('Ideia atualizada com sucesso');
      } else {
        const newIdea: ClinicIdea = {
          ...formData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString()
        };
        currentIdeas = [newIdea, ...currentIdeas];
        toast.success('Ideia criada com sucesso');
      }
      
      localStorage.setItem('clinic_ideas', JSON.stringify(currentIdeas));
      setIdeas(currentIdeas);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving idea:', error);
      toast.error('Erro ao salvar ideia: ' + error.message);
    }
  };`
);

code = code.replace(
  /const handleDeleteIdea = async \(id: string\) => \{[\s\S]*?^  \};/m,
  `const handleDeleteIdea = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta ideia?')) return;

    try {
      const currentIdeas = ideas.filter(idea => idea.id !== id);
      localStorage.setItem('clinic_ideas', JSON.stringify(currentIdeas));
      setIdeas(currentIdeas);
      toast.success('Ideia excluída');
    } catch (error: any) {
      console.error('Error deleting idea:', error);
      toast.error('Erro ao excluir ideia');
    }
  };`
);

// We need to remove the unused supabase import, or just leave it.

fs.writeFileSync('src/components/ClinicIdeas.tsx', code);
