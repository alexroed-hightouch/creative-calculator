// Using sort_by=relevancy_monthly_grouped returns ads newest-first.
// We paginate and stop as soon as the oldest ad on a page falls outside our 30d window.
// This makes it efficient for large advertisers (no need to fetch all 3000+ ads).
const MAX_PAGES = 50;
const BASE = 'https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pageId = url.searchParams.get('pageId');

  if (!pageId) {
    return res.status(400).json({ error: 'Missing pageId' });
  }

  const now = Date.now() / 1000;
  const cutoff30d = now - 30 * 86400;
  const cutoff7d  = now - 7  * 86400;

  let cursor = null;
  let liveTotal = null;
  let launched30d = 0;
  let launched7d  = 0;
  let longestDays = null;
  let pagesFetched = 0;

  for (let i = 0; i < MAX_PAGES; i++) {
    const u = new URL(BASE);
    u.searchParams.set('pageId', pageId);
    u.searchParams.set('status', 'ACTIVE');
    u.searchParams.set('sort_by', 'relevancy_monthly_grouped'); // newest ads first
    u.searchParams.set('trim', 'true');
    if (cursor) u.searchParams.set('cursor', cursor);

    const apiRes = await fetch(u.toString(), {
      headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
    });
    if (!apiRes.ok) break;

    const data = await apiRes.json();
    const results = data.results || data.ads || [];
    pagesFetched++;

    // Capture accurate live total from page 1 only
    if (liveTotal === null && data.searchResultsCount != null) {
      liveTotal = data.searchResultsCount;
    }

    let oldestOnPage = Infinity;
    for (const ad of results) {
      const sd = ad.start_date || 0;
      if (sd >= cutoff30d) launched30d++;
      if (sd >= cutoff7d)  launched7d++;
      if (sd > 0 && oldestOnPage > sd) oldestOnPage = sd;

      // Track longest-running active ad
      if (sd > 0) {
        const days = Math.round((now - sd) / 86400);
        if (longestDays === null || days > longestDays) longestDays = days;
      }
    }

    cursor = data.cursor || null;

    // Stop early: if the oldest ad on this page is already outside the 30d window,
    // no subsequent pages (which are even older) can add to our counts.
    if (oldestOnPage < cutoff30d || !cursor || results.length === 0) break;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    liveAds: liveTotal !== null ? liveTotal : 0,
    launched30d,
    launched7d,
    longestRunningDays: longestDays,
    _debug: { pagesFetched },
  });
}
