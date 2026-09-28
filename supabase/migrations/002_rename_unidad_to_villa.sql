-- Migración: Renombrar columna unidad a villa en la tabla proyectos
DO 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'proyectos' 
      AND column_name = 'unidad'
  ) THEN
    ALTER TABLE public.proyectos RENAME COLUMN unidad TO villa;
  END IF;
END ;
