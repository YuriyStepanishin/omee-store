import 'server-only';
import { getPool } from '../../../backend/src/config/db.js';
import { articleRepository } from '../../../backend/src/models/articles.js';
import { contentRepository } from '../../../backend/src/models/content.js';

// Use the same published-content repositories as the API, without a protected
// deployment URL or an extra HTTP request during server rendering.
const isDemo = () => !process.env.DATABASE_URL && process.env.NODE_ENV !== 'production';

export async function journalArticles() {
  return isDemo() ? [] : articleRepository(getPool()).list();
}

export async function journalArticle(slug) {
  return isDemo() ? null : articleRepository(getPool()).bySlug(slug);
}

export async function journalMedia() {
  return isDemo() ? [] : (await contentRepository(getPool()).publicContent()).media;
}
