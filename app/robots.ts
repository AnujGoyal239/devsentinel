import { MetadataRoute } from 'next';

/**
 * Robots.txt Generator
 * 
 * Generates robots.txt for search engine crawlers
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://devsentinel.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/project/',
          '/login/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
