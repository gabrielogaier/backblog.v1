import { listPublishedPosts } from "@/lib/publicApi";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const posts = await listPublishedPosts({ limit: 20 });

  const items = posts.data
    .map((post) => {
      const postYear = typeof post.year === "number" && Number.isFinite(post.year) ? post.year : 0;
      const postMonth = typeof post.month === "number" && Number.isFinite(post.month) ? post.month : 1;
      const yearSegment = String(postYear).padStart(4, "0");
      const monthSegment = String(postMonth).padStart(2, "0");
      const url = `${BASE_URL}/posts/${yearSegment}/${monthSegment}/${post.slug}`;
      const description = post.excerpt || "Post com IA e revisões do Backblog.";
      const updated = post.publishedAt ?? post.updatedAt;
      return `
        <item>
          <title>${post.title}</title>
          <link>${url}</link>
          <guid>${url}</guid>
          <description><![CDATA[${description}]]></description>
          <pubDate>${updated ? new Date(updated).toUTCString() : new Date().toUTCString()}</pubDate>
        </item>
      `;
    })
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Backblog Public Feed</title>
        <link>${BASE_URL}</link>
        <description>Últimos posts publicados no Backblog.</description>
        <language>pt-br</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${items}
      </channel>
    </rss>`;

  return new Response(rss, {
    headers: { "Content-Type": "application/rss+xml; charset=UTF-8" },
  });
}
