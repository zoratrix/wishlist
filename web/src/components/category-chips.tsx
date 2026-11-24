import { categoryDotStyle, categoryTint } from '../lib/category-colors';
import type { CategoryDTO } from '../lib/types';

export interface CategoryChipsProps {
 categories?: CategoryDTO[];
 className?: string;
}

/** Маленькие chips категорий: светлая подложка/точка выбранного цвета, стикер-рамка. */
export function CategoryChips({ categories = [], className }: CategoryChipsProps) {
 if (categories.length === 0) {
 return null;
 }

 return (
 <span
 aria-label="Категории подарка"
 className={['flex flex-wrap items-center gap-1.5', className ?? ''].join(' ').trim()}
 >
 {categories.map((category) => {
 const tint = categoryTint(category.color);
 return (
 <span
 key={category.id}
 data-color={category.color ?? 'none'}
 style={tint ? { backgroundColor: tint.backgroundColor } : undefined}
 className={[
 'nb-badge px-2 py-1 text-[11px] font-medium leading-tight',
 tint ? 'border-ink text-ink' : 'border-ink bg-paper text-muted',
 ].join(' ')}
 >
 {category.color ? (
 <span
 aria-hidden="true"
 className="h-1.5 w-1.5 rounded-full"
 style={categoryDotStyle(category.color)}
 />
 ) : null}
 {category.name}
 </span>
 );
 })}
 </span>
 );
}
