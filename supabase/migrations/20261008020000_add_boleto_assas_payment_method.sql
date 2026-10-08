INSERT INTO public.payment_methods (id, name, days_to_receive)
SELECT 'pm_boleto_assas', 'Boleto Assas', 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods
  WHERE lower(name) = lower('Boleto Assas')
);
