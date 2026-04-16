import Parser from 'rss-parser'

const FEEDS = [
  { url: 'https://feeds.apnews.com/rss/topnews',              source: 'AP News' },
  { url: 'https://feeds.npr.org/1001/rss.xml',               source: 'NPR' },
  { url: 'https://feeds.bbci.co.uk/news/rss.xml',            source: 'BBC News' },
  { url: 'https://www.theguardian.com/world/rss',            source: 'The Guardian' },
]

/**
 * Fetch top headlines from four RSS feeds.
 * Returns up to 4 items — one from each feed, all from different sources.
 */
export async function fetchTopHeadlines() {
  const parser = new Parser({
    timeout: 6000,
    headers: { 'User-Agent': 'Mozilla/5.0 DSAIL-app/1.0 RSS Reader' },
  })

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url)
      const item = parsed.items?.[0]
      if (!item) throw new Error('No items')
      return {
        title: item.title?.trim() || '(No title)',
        source: feed.source,
        url: item.link || item.guid || '',
        publishedAt: item.isoDate || item.pubDate || null,
      }
    })
  )

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
}
