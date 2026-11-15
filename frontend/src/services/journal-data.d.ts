import type { Article, ArticleSummary } from '@/types/articles';
import type { MediaItem } from '@/types/store';

export function journalArticles(): Promise<ArticleSummary[]>;
export function journalArticle(slug: string): Promise<Article | null>;
export function journalMedia(): Promise<MediaItem[]>;
