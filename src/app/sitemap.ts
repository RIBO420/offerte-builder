import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://your-domain.com', lastModified: new Date() },
    { url: 'https://your-domain.com/sign-in', lastModified: new Date() },
    // Add public pages
  ]
}
