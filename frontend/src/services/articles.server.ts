import 'server-only';
import type { Article, ArticleSummary } from '@/types/articles';
import type { MediaItem } from '@/types/store';
import { journalArticles, journalArticle, journalMedia } from './journal-data.js';

export async function getArticles(): Promise<ArticleSummary[]> {
  return journalArticles();
}

export async function getMedia(): Promise<MediaItem[]> {
  return journalMedia();
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) return null;
  return journalArticle(slug);
}
