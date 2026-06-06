// api/places.js — Vercel Serverless Function
// Proxy Google Places API pour éviter le blocage CORS navigateur

export default async function handler(req, res) {
  // CORS — autoriser uniquement ton domaine en prod (remplace par ton URL Vercel)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { type, query, place_id, fields } = req.query;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY non configurée" });
  }

  try {
    let url;

    if (type === "textsearch") {
      // Recherche par texte (ville + mots-clés)
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=cafe&key=${apiKey}&language=fr&region=fr`;
    
    } else if (type === "details" && place_id) {
      // Détails d'un lieu (téléphone, site web, horaires…)
      const defaultFields = "name,formatted_phone_number,website,opening_hours,url,rating,user_ratings_total,price_level,types,vicinity,formatted_address";
      url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields || defaultFields}&key=${apiKey}&language=fr`;
    
    } else if (type === "nearbysearch") {
      // Recherche par coordonnées GPS + rayon
      const { lat, lng, radius } = req.query;
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius || 5000}&type=cafe&key=${apiKey}&language=fr`;
    
    } else {
      return res.status(400).json({ error: "type requis: textsearch | details | nearbysearch" });
    }

    const response = await fetch(url);
    const data = await response.json();

    // Passer le statut Google tel quel
    if (data.status === "REQUEST_DENIED") {
      return res.status(403).json({ error: "Clé API invalide ou Places API non activée", details: data.error_message });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "Erreur proxy", details: err.message });
  }
}
