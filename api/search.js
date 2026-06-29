export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
  }

  const res = await fetch(
    'https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?query=' + encodeURIComponent(query),
    { headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY } }
  );

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
