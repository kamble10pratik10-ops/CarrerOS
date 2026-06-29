import json
from fastapi import WebSocket
from .datastore import save_chat_message

class ChatConnectionManager:
    def __init__(self):
        # email -> set of WebSocket connections (supports multiple tabs)
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, email: str, websocket: WebSocket):
        email = email.lower()
        await websocket.accept()
        if email not in self.active_connections:
            self.active_connections[email] = set()
        self.active_connections[email].add(websocket)

    def disconnect(self, email: str, websocket: WebSocket):
        email = email.lower()
        conns = self.active_connections.get(email)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            del self.active_connections[email]

    def is_online(self, email: str) -> bool:
        return bool(self.active_connections.get(email.lower()))

    async def send_to_user(self, email: str, payload: dict):
        email = email.lower()
        conns = self.active_connections.get(email)
        if not conns:
            return
        data = json.dumps(payload)
        dead = []
        for ws in conns:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            conns.discard(ws)

    async def handle_message(self, sender: str, receiver: str, text: str, media_urls: list = None):
        sender = sender.lower()
        receiver = receiver.lower()
        text = (text or "").strip()
        media_urls = media_urls or []
        if sender == receiver or (not text and not media_urls):
            return None

        saved = save_chat_message(sender, receiver, text, media_urls)
        if not saved:
            return None

        payload = {"type": "message", "message": saved}
        await self.send_to_user(sender, payload)
        await self.send_to_user(receiver, payload)
        return saved

    async def handle_typing(self, sender: str, receiver: str):
        await self.send_to_user(receiver.lower(), {
            "type": "typing",
            "sender": sender.lower(),
        })


chat_manager = ChatConnectionManager()
