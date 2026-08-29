export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const slug = req.query.path;
    const code = (Array.isArray(slug) ? slug[0] : slug)?.toUpperCase();

    const {
      createRoom,
      getRoomMeta,
      getRoomState,
      handleAction,
    } = await import("./_lib/rooms.js");

    // POST /api/rooms — créer un salon
    if (!code && req.method === "POST") {
      const { hostName } = req.body || {};
      if (!hostName?.trim()) {
        return res.status(400).json({ error: "Nom requis" });
      }
      const room = await createRoom(hostName);
      return res.status(201).json({ room, playerId: room.hostId });
    }

    if (!code) {
      return res.status(404).json({ error: "Route introuvable" });
    }

    // GET /api/rooms/:code
    if (req.method === "GET") {
      if (req.query.meta === "1") {
        const meta = await getRoomMeta(code);
        return res.status(200).json(meta);
      }
      const room = await getRoomState(code);
      return res.status(200).json({ room });
    }

    // POST /api/rooms/:code — action
    if (req.method === "POST") {
      const room = await handleAction(code, req.body);
      return res.status(200).json({ room });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    console.error("rooms handler error:", err);
    const status = message.includes("introuvable") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
}
