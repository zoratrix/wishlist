-- 010_pastel_palette.sql
-- Чистая пастельная палитра оформления: приглушённые цвета категорий и тем
-- вишлистов заменяются на более светлые пастельные — те же 8 оттенков в том же
-- порядке. Меняются только значения из предыдущей палитры; NULL («по
-- умолчанию») и любые другие значения (например, произвольный цвет темы) не
-- затрагиваются.

UPDATE categories
SET color = CASE color
  WHEN '#C4574D' THEN '#E0776A'
  WHEN '#C57A44' THEN '#EE9B63'
  WHEN '#C0A24C' THEN '#E8C466'
  WHEN '#6E9B78' THEN '#7FC290'
  WHEN '#4F8C86' THEN '#64BDB2'
  WHEN '#5A7BA6' THEN '#7FAFE2'
  WHEN '#8A7BB2' THEN '#A78FDE'
  WHEN '#B36B88' THEN '#E28FAF'
  ELSE color
END
WHERE color IN ('#C4574D', '#C57A44', '#C0A24C', '#6E9B78', '#4F8C86', '#5A7BA6', '#8A7BB2', '#B36B88');

-- Тема вишлиста может быть любым #RRGGBB-цветом, поэтому перекрашиваются
-- только пресеты палитры; произвольные цвета остаются как есть.
UPDATE wishlists
SET theme_color = CASE theme_color
  WHEN '#C4574D' THEN '#E0776A'
  WHEN '#C57A44' THEN '#EE9B63'
  WHEN '#C0A24C' THEN '#E8C466'
  WHEN '#6E9B78' THEN '#7FC290'
  WHEN '#4F8C86' THEN '#64BDB2'
  WHEN '#5A7BA6' THEN '#7FAFE2'
  WHEN '#8A7BB2' THEN '#A78FDE'
  WHEN '#B36B88' THEN '#E28FAF'
  ELSE theme_color
END
WHERE theme_color IN ('#C4574D', '#C57A44', '#C0A24C', '#6E9B78', '#4F8C86', '#5A7BA6', '#8A7BB2', '#B36B88');
