import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
const baseUrl = "https://yourunbound.com";

return [
{
url: baseUrl,
lastModified: new Date(),
changeFrequency: "daily",
priority: 1,
},
{
url: `${baseUrl}/feed`,
lastModified: new Date(),
changeFrequency: "daily",
priority: 0.9,
},
{
url: `${baseUrl}/explore`,
lastModified: new Date(),
changeFrequency: "daily",
priority: 0.9,
},
{
url: `${baseUrl}/fetlife-alternative`,
lastModified: new Date(),
changeFrequency: "weekly",
priority: 0.9,
},
{
url: `${baseUrl}/messages`,
lastModified: new Date(),
changeFrequency: "daily",
priority: 0.8,
},
{
url: `${baseUrl}/terms`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.5,
},
{
url: `${baseUrl}/privacy`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.5,
},
{
url: `${baseUrl}/guidelines`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.5,
},
];
}