import type {ProductBadge} from '@/types/store';
import css from './ProductBadges.module.css';

export default function ProductBadges({badges,limit}:{
  badges?: ProductBadge[];
  limit?: number;
}) {
  if (!badges?.length) return null;
  const visible = limit ? badges.slice(0,limit) : badges;
  return (
    <div className={css.list} aria-label="Позначки товару">
      {visible.map((badge,index)=>(
        <span
          key={index}
          className={css.badge}
          style={{backgroundColor:badge.background,color:badge.color}}
        >
          {badge.label}
        </span>
      ))}
      {limit && badges.length>limit&&<span className={css.more}>+{badges.length-limit}</span>}
    </div>
  );
}
