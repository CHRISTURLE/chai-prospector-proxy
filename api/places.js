// api/places.js — Vercel Serverless Function
// Proxy Google Places API — multi-requêtes + pagination

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { type, query, place_id, fields, city, pagetoken } = req.query;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY non configurée" });

  // Mots-clés de recherche specialty coffee
  const KEYWORDS = [
    "coffee shop",
    "café specialty",
    "brunch",
    "chai latte",
    "flat white",
    "matcha café",
    "breakfast café",
    "V60 café"
  ];

  try {

    // ── MULTI-SEARCH : lance toutes les requêtes en parallèle ──
    if (type === "multisearch" && city) {
      const decodedCity = decodeURIComponent(city);

      const fetchKeyword = async (keyword) => {
        const q = encodeURIComponent(`${keyword} ${decodedCity} France`);
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&key=${apiKey}&language=fr&region=fr`;
        const r = await fetch(url);
        const data = await r.json();
        if (data.status === "REQUEST_DENIED") throw new Error(data.error_message);
        return data.results || [];
      };

      // Lancer toutes les recherches en parallèle
      const allResults = await Promise.allSettled(KEYWORDS.map(fetchKeyword));

      // Fusionner et dédupliquer par place_id
      const seen = new Set();
      const merged = [];
      allResults.forEach(r => {
        if (r.status === "fulfilled") {
          r.value.forEach(place => {
            if (!seen.has(place.place_id)) {
              seen.add(place.place_id);
              merged.push(place);
            }
          });
        }
      });

      return res.status(200).json({ results: merged, total: merged.length });
    }

    // ── TEXTSEARCH simple (fallback) ──
    if (type === "textsearch") {
      let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=fr&region=fr`;
      if (pagetoken) url += `&pagetoken=${encodeURIComponent(pagetoken)}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.status === "REQUEST_DENIED") return res.status(403).json({ error: "Clé API invalide", details: data.error_message });
      return res.status(200).json(data);
    }

    // ── DETAILS ──
    if (type === "details" && place_id) {
      const defaultFields = "name,formatted_phone_number,website,opening_hours,url,rating,user_ratings_total,price_level,types,vicinity,formatted_address";
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields || defaultFields}&key=${apiKey}&language=fr`;
      const r = await fetch(url);
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "type requis: multisearch | textsearch | details" });

  } catch (err) {
    return res.status(500).json({ error: "Erreur proxy", details: err.message });
  }
}
