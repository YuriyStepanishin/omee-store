import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173';

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/delivery`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/login`,
      changeFrequency: 'never',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/register`,
      changeFrequency: 'never',
      priority: 0.3,
    },
  ];

  try {
    const apiBase = process.env.API_ORIGIN || `${baseUrl}/api`;
    const response = await fetch(`${apiBase}/articles`, { cache: 'no-store' });
    
    if (response.ok) {
      const articles = await response.json() as Array<{ slug: string; updated_at?: string }>;
      const articleRoutes = articles.map(article => ({
        url: `${baseUrl}/blog/${article.slug}`,
        lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
      return [...staticRoutes, ...articleRoutes];
    }
  } catch {
    // Fallback to static routes if API unavailable
  }

  return staticRoutes;
}
