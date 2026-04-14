import Parser from 'rss-parser'

const FEEDS = [
  { url: 'https://feeds.apnews.com/rss/topnews', source: 'AP News' },
  { url: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR News' },
  { url: 'https://www.theguardian.com/us-news/rss', source: 'The Guardian' },
]

/**
 * Fetch top headlines from multiple RSS feeds.
 * Returns up to 3 items — one from each feed.
 * @returns {Promise<Array<{ title: string, source: string, url: string, publishedAt: string|null }>>}
 */
export async function fetchTopHeadlines() {
  const parser = new Parser({
    timeout: 5000,
    headers: {
      'User-Agent': 'DSAIL-app/1.0 RSS Reader',
    },
  })

  const headlines = []

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url)
      const item = parsed.items?.[0]
      if (item) {
        headlines.push({
          title: item.title?.trim() || '(No title)',
          source: feed.source,
          url: item.link || item.guid || '',
          publishedAt: item.isoDate || item.pubDate || null,
        })
      }
    } catch (err) {
      // Log the error but continue with other feeds
      console.error(`Failed to fetch RSS feed from ${feed.source}: ${err.message}`)
    }
  }

  return headlines
}
