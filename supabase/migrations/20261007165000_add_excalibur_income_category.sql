-- Categoria de receita sem procedimento/subcategoria obrigatório.
INSERT INTO public.income_categories (id, name, subcategories, type)
SELECT 'inc_excalibur', 'Excalibur', '[]'::jsonb, 'income'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.income_categories
  WHERE name = 'Excalibur'
);
