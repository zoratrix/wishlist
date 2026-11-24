-- 008_muted_palette.sql
-- Новая палитра оформления (необрутализм): приглушённые цвета категорий и
-- тем вишлистов заменяются на чуть более спокойные — те же 8 оттенков в том же
-- порядке. Меняются только значения из старой палитры; NULL («по умолчанию») и
-- любые другие значения (например, произвольный цвет темы) не затрагиваются.

UPDATE categories
SET color = CASE color
  WHEN '#A9544C' THEN '#C4574D'
  WHEN '#B36A42' THEN '#C57A44'
  WHEN '#A98A45' THEN '#C0A24C'
  WHEN '#4F7A5B' THEN '#6E9B78'
  WHEN '#47787A' THEN '#4F8C86'
  WHEN '#4C6B92' THEN '#5A7BA6'
  WHEN '#6B5A8E' THEN '#8A7BB2'
  WHEN '#9A5F7C' THEN '#B36B88'
  ELSE color
END
WHERE color IN ('#A9544C', '#B36A42', '#A98A45', '#4F7A5B', '#47787A', '#4C6B92', '#6B5A8E', '#9A5F7C');

-- Тема вишлиста может быть любым #RRGGBB-цветом, поэтому перекрашиваются
-- только старые пресеты палитры; произвольные цвета остаются как есть.
UPDATE wishlists
SET theme_color = CASE theme_color
  WHEN '#A9544C' THEN '#C4574D'
  WHEN '#B36A42' THEN '#C57A44'
  WHEN '#A98A45' THEN '#C0A24C'
  WHEN '#4F7A5B' THEN '#6E9B78'
  WHEN '#47787A' THEN '#4F8C86'
  WHEN '#4C6B92' THEN '#5A7BA6'
  WHEN '#6B5A8E' THEN '#8A7BB2'
  WHEN '#9A5F7C' THEN '#B36B88'
  ELSE theme_color
END
WHERE theme_color IN ('#A9544C', '#B36A42', '#A98A45', '#4F7A5B', '#47787A', '#4C6B92', '#6B5A8E', '#9A5F7C');
