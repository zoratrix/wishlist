import type { CategoryFilter } from '../lib/categories';
import { categoryDotStyle, categoryTint } from '../lib/category-colors';
import type { CategoryDTO } from '../lib/types';

export interface CategoryFilterProps {
 categories: CategoryDTO[];
 value: CategoryFilter;
 onChange: (value: CategoryFilter) => void;
}

/* Стикерная «кнопка-чип»: рамка 2px, жёсткая тень, тач-цель 44px. */
const CHIP_BASE = [
 'nb-focus inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink px-3 active:translate-y-px',
 'text-sm font-medium transition-colors',
].join(' ');

const CHIP_ACTIVE = 'bg-accent text-ink';
const CHIP_IDLE = 'bg-card text-ink hover:bg-paper';

function neutralChipClass(active: boolean): string {
 return [CHIP_BASE, active ? CHIP_ACTIVE : CHIP_IDLE].join(' ');
}

/** Фильтр «Все / категории / Без категории». При отсутствии категорий скрыт. */
export function CategoryFilter({ categories, value, onChange }: CategoryFilterProps) {
 if (categories.length === 0) {
 return null;
 }

 return (
 <div
 role="group"
 aria-label="Фильтр по категориям"
 className="mt-3 flex flex-wrap items-center gap-2"
 >
 <button
 type="button"
 aria-pressed={value === 'all'}
 onClick={() => onChange('all')}
 className={neutralChipClass(value === 'all')}
 >
 Все
 </button>

 {categories.map((category) => {
 const active = value === category.id;
 const tint = categoryTint(category.color);
 return (
 <button
 key={category.id}
 type="button"
 aria-pressed={active}
 data-color={category.color ?? 'none'}
 style={tint ? { backgroundColor: tint.backgroundColor } : undefined}
 onClick={() => onChange(category.id)}
 className={[
 CHIP_BASE,
 tint ? 'text-ink' : neutralChipClass(active),
 tint && active
 ? ' ring-2 ring-ink ring-offset-2 ring-offset-paper'
 : '',
 tint && !active ? '' : '',
 ]
 .filter(Boolean)
 .join(' ')
 .trim()}
 >
 {category.color ? (
 <span
 aria-hidden="true"
 className="h-2 w-2 rounded-full"
 style={categoryDotStyle(category.color)}
 />
 ) : null}
 {category.name}
 </button>
 );
 })}

 <button
 type="button"
 aria-pressed={value === 'none'}
 onClick={() => onChange('none')}
 className={neutralChipClass(value === 'none')}
 >
 Без категории
 </button>
 </div>
 );
}
