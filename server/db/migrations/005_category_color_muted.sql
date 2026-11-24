-- 005_category_color_muted.sql
-- Приглушённая палитра: яркие цвета заменяются на спокойные (те же 8 оттенков).
-- Меняются только значения из старой палитры; NULL («по умолчанию») и любые
-- другие значения не затрагиваются.

UPDATE categories
SET color = CASE color
  WHEN '#DC2626' THEN '#A9544C'
  WHEN '#EA580C' THEN '#B36A42'
  WHEN '#CA8A04' THEN '#A98A45'
  WHEN '#16A34A' THEN '#4F7A5B'
  WHEN '#0D9488' THEN '#47787A'
  WHEN '#2563EB' THEN '#4C6B92'
  WHEN '#7C3AED' THEN '#6B5A8E'
  WHEN '#DB2777' THEN '#9A5F7C'
  ELSE color
END
WHERE color IN ('#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0D9488', '#2563EB', '#7C3AED', '#DB2777');
