"""
Realtime broadcast helpers — Backend-2 owns this file. (US-12)

Supabase Realtime lets you broadcast events to subscribed clients.
The frontend subscribes to channel "request:{request_id}" and listens
for "new_offer" events.

TODO:
  1. broadcast_new_offer() — send offer payload to the request channel
  2. broadcast_request_closed() — notify channel when request is accepted

Supabase Python client broadcast example:
  channel = db.channel("request:abc123")
  channel.send_broadcast(event="new_offer", payload={...})

Docs: https://supabase.com/docs/reference/python/broadcast
"""
from app.models.db import get_db


def broadcast_new_offer(request_id: str, offer: dict) -> None:
    """
    TODO (Backend-2):
      channel = get_db().channel(f"request:{request_id}")
      channel.send_broadcast(event="new_offer", payload=offer)
    """
    raise NotImplementedError


def broadcast_request_closed(request_id: str, accepted_offer_id: str) -> None:
    """
    TODO (Backend-2): notify all listeners that this request is now closed.
    """
    raise NotImplementedError
