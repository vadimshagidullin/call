import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "Preview");
const port = Number(process.env.PORT || 4173);
const buildId = (process.env.RENDER_GIT_COMMIT || process.env.COMMIT_REF || "local").slice(0, 12);
const rooms = new Map();

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function sendFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, build: buildId }));
    return;
  }

  if (url.pathname === "/runtime-config.js") {
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(`window.CLEARCALL_SIGNALING_URL = "";\nwindow.CLEARCALL_BUILD = ${JSON.stringify(buildId)};\n`);
    return;
  }

  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  });
}

function encodeFrame(text) {
  const payload = Buffer.from(text);
  const header = [];
  header.push(0x81);

  if (payload.length < 126) {
    header.push(payload.length);
  } else if (payload.length < 65536) {
    header.push(126, (payload.length >> 8) & 255, payload.length & 255);
  } else {
    header.push(127, 0, 0, 0, 0);
    header.push(
      (payload.length >> 24) & 255,
      (payload.length >> 16) & 255,
      (payload.length >> 8) & 255,
      payload.length & 255
    );
  }

  return Buffer.concat([Buffer.from(header), payload]);
}

function decodeFrames(socket, chunk) {
  socket.buffer = Buffer.concat([socket.buffer || Buffer.alloc(0), chunk]);
  const messages = [];

  while (socket.buffer.length >= 2) {
    const first = socket.buffer[0];
    const second = socket.buffer[1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (socket.buffer.length < offset + 2) break;
      length = socket.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (socket.buffer.length < offset + 8) break;
      const high = socket.buffer.readUInt32BE(offset);
      const low = socket.buffer.readUInt32BE(offset + 4);
      length = high * 2 ** 32 + low;
      offset += 8;
    }

    const maskOffset = masked ? 4 : 0;
    if (socket.buffer.length < offset + maskOffset + length) break;

    let payload = socket.buffer.subarray(offset + maskOffset, offset + maskOffset + length);
    if (masked) {
      const mask = socket.buffer.subarray(offset, offset + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }

    socket.buffer = socket.buffer.subarray(offset + maskOffset + length);

    if (opcode === 0x8) {
      socket.end();
      continue;
    }

    if (opcode === 0x9) {
      socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }

    if (opcode === 0x1) {
      messages.push(payload.toString("utf8"));
    }
  }

  return messages;
}

function send(socket, message) {
  if (!socket.destroyed) {
    socket.write(encodeFrame(JSON.stringify(message)));
  }
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

function publicPeer(socket) {
  return {
    id: socket.clientId,
    name: socket.name,
    initials: socket.initials,
    micOn: socket.micOn,
    cameraOn: socket.cameraOn
  };
}

function broadcast(roomId, message, exceptId) {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const peer of room.values()) {
    if (peer.clientId !== exceptId) {
      send(peer, message);
    }
  }
}

function leaveRoom(socket) {
  if (!socket.roomId) return;
  const room = rooms.get(socket.roomId);
  if (room) {
    room.delete(socket.clientId);
    broadcast(socket.roomId, { type: "peer-left", peerId: socket.clientId });
    if (room.size === 0) rooms.delete(socket.roomId);
  }
  socket.roomId = null;
}

function handleMessage(socket, messageText) {
  let message;
  try {
    message = JSON.parse(messageText);
  } catch {
    send(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (message.type === "join") {
    leaveRoom(socket);
    socket.roomId = String(message.roomId || "CC-4829").slice(0, 64);
    socket.name = String(message.name || "Guest").slice(0, 48);
    socket.initials = String(message.initials || "G").slice(0, 4);
    socket.micOn = Boolean(message.micOn);
    socket.cameraOn = Boolean(message.cameraOn);

    const room = getRoom(socket.roomId);
    const peers = [...room.values()].map(publicPeer);
    room.set(socket.clientId, socket);

    send(socket, { type: "joined", id: socket.clientId, roomId: socket.roomId, peers });
    broadcast(socket.roomId, { type: "peer-joined", peer: publicPeer(socket) }, socket.clientId);
    return;
  }

  if (!socket.roomId) {
    send(socket, { type: "error", message: "Join a room first" });
    return;
  }

  if (message.type === "signal") {
    const target = rooms.get(socket.roomId)?.get(message.to);
    if (target) {
      send(target, { type: "signal", from: socket.clientId, data: message.data });
    }
    return;
  }

  if (message.type === "sync-peers") {
    const peers = [...(rooms.get(socket.roomId)?.values() || [])]
      .filter(peer => peer.clientId !== socket.clientId)
      .map(publicPeer);
    send(socket, { type: "peers", peers });
    return;
  }

  if (message.type === "chat") {
    const text = String(message.text || "").trim().slice(0, 800);
    if (text) {
      const chatMessage = {
        type: "chat",
        from: socket.clientId,
        name: socket.name,
        text,
        sentAt: Date.now()
      };
      send(socket, chatMessage);
      broadcast(socket.roomId, chatMessage, socket.clientId);
    }
    return;
  }

  if (message.type === "user-update") {
    socket.name = String(message.name || socket.name).slice(0, 48);
    socket.initials = String(message.initials || socket.initials).slice(0, 4);
    socket.micOn = Boolean(message.micOn);
    socket.cameraOn = Boolean(message.cameraOn);
    broadcast(socket.roomId, { type: "peer-updated", peer: publicPeer(socket) }, socket.clientId);
  }
}

const server = http.createServer(sendFile);

server.on("upgrade", (req, socket) => {
  if (req.url !== "/ws" || req.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }

  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  socket.clientId = crypto.randomBytes(8).toString("hex");
  socket.buffer = Buffer.alloc(0);

  socket.on("data", chunk => {
    for (const message of decodeFrames(socket, chunk)) {
      handleMessage(socket, message);
    }
  });
  socket.on("close", () => leaveRoom(socket));
  socket.on("error", () => leaveRoom(socket));
});

server.listen(port, () => {
  console.log(`ClearCall running at http://localhost:${port}`);
});
