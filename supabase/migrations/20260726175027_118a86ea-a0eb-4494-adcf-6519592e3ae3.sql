-- === Corrida ENEJ: schema base ===
CREATE TABLE public.squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.squads TO anon, authenticated;
GRANT ALL ON public.squads TO service_role;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squads_read_all" ON public.squads FOR SELECT USING (true);

CREATE TABLE public.guardioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guardioes TO anon, authenticated;
GRANT ALL ON public.guardioes TO service_role;
ALTER TABLE public.guardioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardioes_read_all" ON public.guardioes FOR SELECT USING (true);

CREATE TABLE public.ejs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  guardiao_id UUID REFERENCES public.guardioes(id) ON DELETE SET NULL,
  squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL,
  presente BOOLEAN NOT NULL DEFAULT false,
  meta NUMERIC(14,2) NOT NULL DEFAULT 0,
  faturamento NUMERIC(14,2) NOT NULL DEFAULT 0,
  verde_agosto NUMERIC(14,2) NOT NULL DEFAULT 0,
  gap NUMERIC(14,2) NOT NULL DEFAULT 0,
  atingiu_agosto TEXT,
  farol TEXT,
  pi BOOLEAN NOT NULL DEFAULT false,
  aposta_pi TEXT,
  aposta_verde TEXT,
  aposta_sde TEXT,
  alcancou BOOLEAN NOT NULL DEFAULT false,
  informacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ejs TO anon, authenticated;
GRANT ALL ON public.ejs TO service_role;
ALTER TABLE public.ejs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ejs_read_all" ON public.ejs FOR SELECT USING (true);

CREATE INDEX idx_ejs_squad ON public.ejs(squad_id);
CREATE INDEX idx_ejs_guardiao ON public.ejs(guardiao_id);
CREATE INDEX idx_ejs_farol ON public.ejs(farol);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ejs_updated BEFORE UPDATE ON public.ejs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ej_id UUID NOT NULL REFERENCES public.ejs(id) ON DELETE CASCADE,
  semana DATE NOT NULL,
  faturamento NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ej_id, semana)
);
GRANT SELECT ON public.checkpoints TO anon, authenticated;
GRANT ALL ON public.checkpoints TO service_role;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkpoints_read_all" ON public.checkpoints FOR SELECT USING (true);

-- Squads & Guardiões
INSERT INTO public.squads (nome) VALUES ('Ana Clara'),('Bruno'),('Gabi'),('Lucas'),('Mari'),('Rafael');
INSERT INTO public.guardioes (nome) VALUES ('Ana Clara'),('Breno'),('Bruno'),('Buzzato'),('Deb'),('Dri'),('Duda T'),('Gabi'),('Gabriel'),('Gabriel L'),('Julia'),('Karol'),('Let'),('Lucas'),('Mafe'),('Manu'),('Mari'),('Miguel'),('Rafael'),('Rian'),('Sofi'),('Victor'),('Vini');