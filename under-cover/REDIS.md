# Modèle de données Redis — Undercover
#
# undercover:room:{CODE}
#   → RoomState (JSON, TTL 4h)
#   Contient : joueurs, phase, rôles, mots, votes, indices
#
# undercover:presence:{CODE}:{playerId}
#   → timestamp (number) | 0 si départ volontaire (TTL 10min)
#
# Voir under-cover/shared/schemas.ts pour les schémas Zod complets.
