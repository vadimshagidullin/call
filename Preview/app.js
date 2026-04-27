const joinScreen = document.getElementById("joinScreen");
const callScreen = document.getElementById("callScreen");
const displayName = document.getElementById("displayName");
const previewVideo = document.getElementById("previewVideo");
const localVideo = document.getElementById("localVideo");
const previewFrame = document.getElementById("previewFrame");
const localTile = document.getElementById("localTile");
const previewCamera = document.getElementById("previewCamera");
const cameraTool = document.getElementById("cameraTool");
const previewMic = document.getElementById("previewMic");
const micTool = document.getElementById("micTool");
const shareTool = document.getElementById("shareTool");
const reactionTool = document.getElementById("reactionTool");
const micDot = document.getElementById("micDot");
const cameraDot = document.getElementById("cameraDot");
const micStatus = document.getElementById("micStatus");
const cameraStatus = document.getElementById("cameraStatus");
const localTileStatus = document.getElementById("localTileStatus");
const localTileName = document.getElementById("localTileName");
const localLabel = document.getElementById("localLabel");
const localInitials = document.getElementById("localInitials");
const previewInitials = document.getElementById("previewInitials");
const youAvatar = document.getElementById("youAvatar");
const youName = document.getElementById("youName");
const youStatus = document.getElementById("youStatus");
const peopleList = document.getElementById("peopleList");
const chatFeed = document.getElementById("chatFeed");
const chatComposer = document.getElementById("chatComposer");
const chatInput = document.getElementById("chatInput");
const callClock = document.getElementById("callClock");
const connectionStatus = document.getElementById("connectionStatus");
const toast = document.getElementById("toast");
const cameraHelp = document.getElementById("cameraHelp");
const videoGrid = document.getElementById("videoGrid");
const roomCode = document.getElementById("roomCode");
const cameraSelect = document.getElementById("cameraSelect");
const microphoneSelect = document.getElementById("microphoneSelect");
const speakerSelect = document.getElementById("speakerSelect");
const newRoomSetup = document.getElementById("newRoomSetup");

const initialParams = new URLSearchParams(window.location.search);
let roomId = initialParams.get("room") || "CC-4829";
let signalingUrl = normalizeSignalingUrl(initialParams.get("signal") || window.CLEARCALL_SIGNALING_URL || "");
const icons = {
  micOn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path></svg>`,
  micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m2 2 20 20"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path><path d="M15 9.34V5a3 3 0 0 0-5.94-.6"></path><path d="M19 10v2a7 7 0 0 1-.7 3.05"></path><path d="M5 10v2a7 7 0 0 0 7 7v3"></path></svg>`,
  cameraOn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 10.5 21 7v10l-6-3.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3.5Z"></path></svg>`,
  cameraOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 10.5 21 7v10l-6-3.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3.5Z"></path><path d="m2 2 20 20"></path></svg>`
};

let localStream = null;
let cameraOn = false;
let micOn = true;
let inCall = false;
let callTimer = null;
let elapsed = 0;
let socket = null;
let myId = null;
let reconnectTimer = null;
let peerSyncTimer = null;
let devicesReady = false;

const peers = new Map();
const participants = new Map();

roomCode.textContent = roomId;
if (!new URLSearchParams(window.location.search).has("room")) {
  window.history.replaceState({}, "", `${window.location.pathname}?room=${encodeURIComponent(roomId)}`);
}
if (window.location.protocol === "file:") {
  setConnectionState("Use localhost", "error");
  cameraHelp.textContent = "Open http://localhost:4173 to use WebRTC rooms and signaling.";
} else if (window.location.hostname.endsWith(".netlify.app") && !signalingUrl) {
  setConnectionState("Set signaling URL", "error");
  cameraHelp.textContent = "Netlify is serving the page, but live calls need SIGNALING_URL set to a WebSocket backend.";
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ME";
  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join("");
}

function identity() {
  const name = displayName.value.trim() || "Guest";
  return { name, initials: initialsFrom(name), micOn, cameraOn };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function normalizeSignalingUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol === "http:") url.protocol = "ws:";
    if (!["ws:", "wss:"].includes(url.protocol)) return "";
    if (url.pathname === "/" || !url.pathname) url.pathname = "/ws";
    return url.toString();
  } catch (error) {
    return "";
  }
}

function roomUrl() {
  const base = window.location.protocol === "file:"
    ? "http://localhost:4173/"
    : `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams();
  params.set("room", roomId);
  if (signalingUrl) params.set("signal", signalingUrl);
  return `${base}?${params.toString()}`;
}

function updateRoomUrl() {
  roomCode.textContent = roomId;
  const params = new URLSearchParams(window.location.search);
  params.set("room", roomId);
  if (signalingUrl) params.set("signal", signalingUrl);
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
}

function generateRoomId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CC-${suffix.slice(0, 3)}-${suffix.slice(3)}`;
}

function createNewRoom() {
  if (inCall) {
    showToast("Leave the current room first");
    return;
  }

  roomId = generateRoomId();
  updateRoomUrl();
  setConnectionState(window.location.protocol === "file:" ? "Use localhost" : "Ready", window.location.protocol === "file:" ? "error" : "ready");
  showToast(`New room ${roomId}`);
}

function setConnectionState(text, tone = "ready") {
  connectionStatus.textContent = text;
  connectionStatus.className = `connection-state ${tone}`;
}

function setButtonState(button, enabled, onLabel, offLabel) {
  button.classList.toggle("active", enabled);
  button.classList.toggle("off", !enabled);
  button.setAttribute("aria-label", enabled ? onLabel : offLabel);
}

function selectedDeviceConstraints(kind) {
  const select = kind === "audioinput" ? microphoneSelect : cameraSelect;
  if (!select?.value) return true;
  return { deviceId: { exact: select.value } };
}

function mediaConstraints(options) {
  return {
    audio: options.audio ? selectedDeviceConstraints("audioinput") : false,
    video: options.video ? selectedDeviceConstraints("videoinput") : false
  };
}

function labelForDevice(device, fallback, index) {
  return device.label || `${fallback} ${index + 1}`;
}

function fillDeviceSelect(select, devices, fallbackLabel) {
  const previous = select.value;
  select.innerHTML = `<option value="">Default ${fallbackLabel.toLowerCase()}</option>`;
  devices.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = labelForDevice(device, fallbackLabel, index);
    select.appendChild(option);
  });
  if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }
}

async function loadDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  fillDeviceSelect(cameraSelect, devices.filter(device => device.kind === "videoinput"), "Camera");
  fillDeviceSelect(microphoneSelect, devices.filter(device => device.kind === "audioinput"), "Microphone");
  fillDeviceSelect(speakerSelect, devices.filter(device => device.kind === "audiooutput"), "Speaker");
  speakerSelect.disabled = !HTMLMediaElement.prototype.setSinkId;
  devicesReady = true;
}

async function applySpeakerSelection() {
  if (!HTMLMediaElement.prototype.setSinkId || !speakerSelect.value) return;

  for (const audio of document.querySelectorAll(".remote-audio")) {
    try {
      await audio.setSinkId(speakerSelect.value);
    } catch (error) {
      showToast("Speaker output could not be changed");
    }
  }
}

async function changeInputDevice() {
  if (!localStream) return;
  setConnectionState("Switching device", "connecting");
  const ok = await ensureLocalMedia({ audio: true, video: cameraOn, force: true });
  setConnectionState(ok ? "Device ready" : "Device blocked", ok ? "connected" : "error");
  if (inCall && ok) sendUserUpdate();
}

function syncIdentity() {
  const current = identity();
  previewInitials.textContent = current.initials;
  localInitials.textContent = current.initials;
  youAvatar.textContent = current.initials;
  youName.textContent = current.name;
  localTileName.textContent = current.name;
  localLabel.textContent = `${current.name} (you)`;
  sendUserUpdate();
}

function syncDeviceStatus() {
  micDot.classList.toggle("off", !micOn);
  micStatus.textContent = micOn ? "Microphone on" : "Microphone muted";
  cameraDot.classList.toggle("off", !cameraOn);
  cameraStatus.textContent = cameraOn ? "Camera on" : "Camera off";
  localTileStatus.textContent = cameraOn ? "Camera is on" : "Camera is off";
  youStatus.textContent = micOn ? "You - Mic on" : "You - Muted";
  previewMic.innerHTML = micOn ? icons.micOn : icons.micOff;
  micTool.innerHTML = micOn ? icons.micOn : icons.micOff;
  previewCamera.innerHTML = cameraOn ? icons.cameraOn : icons.cameraOff;
  cameraTool.innerHTML = cameraOn ? icons.cameraOn : icons.cameraOff;
  setButtonState(previewMic, micOn, "Mute microphone", "Unmute microphone");
  setButtonState(micTool, micOn, "Mute microphone", "Unmute microphone");
  setButtonState(previewCamera, cameraOn, "Turn camera off", "Turn camera on");
  setButtonState(cameraTool, cameraOn, "Turn camera off", "Turn camera on");

  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = micOn;
    });
    localStream.getVideoTracks().forEach(track => {
      track.enabled = cameraOn;
    });
  }

  previewFrame.classList.toggle("camera-ready", cameraOn && hasVideoTrack());
  localTile.classList.toggle("camera-ready", cameraOn && hasVideoTrack());
  renderPeople();
  sendUserUpdate();
}

function hasVideoTrack() {
  return Boolean(localStream?.getVideoTracks().length);
}

async function getMedia(constraints) {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraHelp.textContent = "Your browser does not expose camera or microphone access from this page.";
    setConnectionState("Media unavailable", "error");
    return null;
  }

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    setConnectionState("Media blocked", "error");
    return null;
  }
}

function attachLocalStream(stream) {
  localStream = stream;
  previewVideo.srcObject = stream;
  localVideo.srcObject = stream;
  syncDeviceStatus();
  loadDevices();
}

async function replacePeerTracks() {
  for (const peer of peers.values()) {
    const senders = peer.connection.getSenders();
    const tracks = localStream?.getTracks() || [];
    for (const track of tracks) {
      const sender = senders.find(item => item.track?.kind === track.kind);
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        peer.connection.addTrack(track, localStream);
      }
    }
  }
}

async function ensureLocalMedia(options = { audio: true, video: true }) {
  const wantsAudio = Boolean(options.audio);
  const wantsVideo = Boolean(options.video);
  const hasAudio = Boolean(localStream?.getAudioTracks().length);
  const hasVideo = Boolean(localStream?.getVideoTracks().length);

  if (!options.force && localStream && (!wantsAudio || hasAudio) && (!wantsVideo || hasVideo)) {
    return true;
  }

  const stream = await getMedia(mediaConstraints({ audio: wantsAudio, video: wantsVideo }));
  if (stream) {
    localStream?.getTracks().forEach(track => track.stop());
    attachLocalStream(stream);
    await replacePeerTracks();
    return true;
  }

  if (wantsAudio && wantsVideo) {
    const audioOnly = await getMedia(mediaConstraints({ audio: true, video: false }));
    if (audioOnly) {
      localStream?.getTracks().forEach(track => track.stop());
      attachLocalStream(audioOnly);
      cameraOn = false;
      cameraHelp.textContent = "Camera was not available, but your microphone is connected.";
      await replacePeerTracks();
      return true;
    }
  }

  cameraHelp.textContent = "Camera or microphone permission was not granted. You can try joining again.";
  return false;
}

async function setCamera(nextValue) {
  if (nextValue) {
    const available = await ensureLocalMedia({ audio: inCall, video: true });
    if (!available || !hasVideoTrack()) {
      cameraOn = false;
      syncDeviceStatus();
      return;
    }
  }

  cameraOn = nextValue;
  syncDeviceStatus();
}

async function toggleMic() {
  if (!localStream?.getAudioTracks().length && !micOn) {
    await ensureLocalMedia({ audio: true, video: cameraOn });
  }

  micOn = !micOn;
  syncDeviceStatus();
}

function formatTime(value) {
  const minutes = String(Math.floor(value / 60)).padStart(2, "0");
  const seconds = String(value % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startClock() {
  clearInterval(callTimer);
  elapsed = 0;
  callClock.textContent = "Live 00:00";
  callTimer = setInterval(() => {
    elapsed += 1;
    callClock.textContent = `Live ${formatTime(elapsed)}`;
  }, 1000);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1600);
}

function wsUrl() {
  if (signalingUrl) return signalingUrl;
  if (window.location.protocol === "file:") return "ws://localhost:4173/ws";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function connectSocket() {
  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) return;
  if (window.location.hostname.endsWith(".netlify.app") && !signalingUrl) {
    setConnectionState("No signaling URL", "error");
    showToast("Set SIGNALING_URL on Netlify");
    return;
  }

  socket = new WebSocket(wsUrl());
  setConnectionState("Connecting", "connecting");

  socket.addEventListener("open", () => {
    const current = identity();
    setConnectionState("Joining room", "connecting");
    send({ type: "join", roomId, ...current });
  });

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  });

  socket.addEventListener("close", () => {
    if (!inCall) return;
    setConnectionState("Reconnecting", "connecting");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectSocket, 900);
  });

  socket.addEventListener("error", () => {
    setConnectionState("Signaling error", "error");
  });
}

function sendUserUpdate() {
  if (!inCall || !myId) return;
  send({ type: "user-update", ...identity() });
}

function handleServerMessage(message) {
  if (message.type === "joined") {
    myId = message.id;
    setConnectionState("In room", "connected");
    participants.clear();
    for (const peer of message.peers) {
      participants.set(peer.id, peer);
      ensurePeer(peer);
    }
    startPeerSync();
    renderPeople();
    addSystemMessage(`Joined room ${message.roomId}.`);
    return;
  }

  if (message.type === "peer-joined") {
    participants.set(message.peer.id, message.peer);
    ensurePeer(message.peer);
    renderPeople();
    addSystemMessage(`${message.peer.name} joined.`);
    return;
  }

  if (message.type === "peers") {
    for (const peer of message.peers) {
      participants.set(peer.id, peer);
      ensurePeer(peer);
    }
    renderPeople();
    return;
  }

  if (message.type === "peer-left") {
    addSystemMessage("A participant left.");
    removePeer(message.peerId);
    renderPeople();
    return;
  }

  if (message.type === "peer-updated") {
    participants.set(message.peer.id, message.peer);
    updatePeerTile(message.peer);
    renderPeople();
    return;
  }

  if (message.type === "signal") {
    handleSignal(message.from, message.data).catch(error => {
      console.error("WebRTC signal failed", error);
      addSystemMessage(`Connection setup error: ${error.message}`);
      setConnectionState("Connection error", "error");
    });
    return;
  }

  if (message.type === "chat") {
    addChatMessage(message.text, message.name, message.from === myId);
  }
}

function peerConfig() {
  return {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  };
}

function shouldOfferTo(peerId) {
  return Boolean(myId && myId > peerId);
}

function startPeerSync() {
  clearInterval(peerSyncTimer);
  send({ type: "sync-peers" });
  peerSyncTimer = setInterval(() => {
    if (inCall) send({ type: "sync-peers" });
  }, 3500);
}

function ensurePeer(peer) {
  const state = createPeer(peer);
  if (shouldOfferTo(peer.id) && !state.madeOffer && state.connection.signalingState === "stable") {
    makeOffer(peer.id);
  }
  return state;
}

function createPeer(peer) {
  if (peers.has(peer.id)) return peers.get(peer.id);

  const connection = new RTCPeerConnection(peerConfig());
  const remoteStream = new MediaStream();
  const tile = createPeerTile(peer, remoteStream);
  addSystemMessage(`Connecting to ${peer.name}.`);

  if (localStream) {
    localStream.getTracks().forEach(track => connection.addTrack(track, localStream));
  }

  connection.addEventListener("icecandidate", event => {
    if (event.candidate) {
      send({ type: "signal", to: peer.id, data: { candidate: event.candidate } });
    }
  });

  connection.addEventListener("track", event => {
    if (!remoteStream.getTracks().includes(event.track)) {
      remoteStream.addTrack(event.track);
    }
    tile.classList.add("camera-ready");
    updatePeerStatus(peer.id, `Receiving ${event.track.kind}`);
    addSystemMessage(`Receiving ${event.track.kind} from ${peer.name}.`);
    playPeerMedia(tile);
  });

  connection.addEventListener("connectionstatechange", () => {
    tile.classList.toggle("connecting", ["connecting", "new", "checking"].includes(connection.connectionState));
    if (["connecting", "new", "checking"].includes(connection.connectionState)) {
      setConnectionState("Connecting peer", "connecting");
      updatePeerStatus(peer.id, connection.connectionState);
    }
    if (["failed", "closed", "disconnected"].includes(connection.connectionState)) {
      updatePeerStatus(peer.id, connection.connectionState);
      setConnectionState("Peer disconnected", "error");
      addSystemMessage(`${peer.name} connection is ${connection.connectionState}.`);
    } else if (connection.connectionState === "connected") {
      updatePeerStatus(peer.id, "Connected");
      setConnectionState("Peer connected", "connected");
      addSystemMessage(`${peer.name} connected.`);
    }
  });

  const state = { id: peer.id, connection, remoteStream, tile, pendingCandidates: [], madeOffer: false };
  peers.set(peer.id, state);

  return state;
}

async function makeOffer(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;

  peer.madeOffer = true;
  const participant = participants.get(peerId);
  addSystemMessage(`Sending connection offer${participant ? ` to ${participant.name}` : ""}.`);
  const offer = await peer.connection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
  await peer.connection.setLocalDescription(offer);
  send({ type: "signal", to: peerId, data: { description: peer.connection.localDescription } });
}

async function handleSignal(peerId, data) {
  let peer = peers.get(peerId);
  const participant = participants.get(peerId) || { id: peerId, name: "Guest", initials: "G", micOn: true, cameraOn: true };
  if (!peer) peer = createPeer(participant);

  if (data.description) {
    addSystemMessage(`Received ${data.description.type} from ${participant.name}.`);
    await peer.connection.setRemoteDescription(data.description);
    while (peer.pendingCandidates.length) {
      await peer.connection.addIceCandidate(peer.pendingCandidates.shift());
    }
    if (data.description.type === "offer") {
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);
      send({ type: "signal", to: peerId, data: { description: peer.connection.localDescription } });
    }
  }

  if (data.candidate) {
    if (!peer.connection.remoteDescription) {
      peer.pendingCandidates.push(data.candidate);
      return;
    }

    try {
      await peer.connection.addIceCandidate(data.candidate);
    } catch (error) {
      console.warn("Could not add ICE candidate", error);
    }
  }
}

function createPeerTile(peer, stream) {
  let tile = document.getElementById(`peer-${peer.id}`);
  if (tile) return tile;

  tile = document.createElement("article");
  tile.className = "tile connecting";
  tile.id = `peer-${peer.id}`;
  tile.innerHTML = `
    <video autoplay playsinline muted></video>
    <audio class="remote-audio" autoplay></audio>
    <div class="participant-art">
      <div>
        <div class="initials">${escapeHtml(peer.initials)}</div>
        <h3>${escapeHtml(peer.name)}</h3>
        <p>${peer.cameraOn ? "Connecting video" : "Camera is off"}</p>
      </div>
    </div>
    <div class="tile-label"><span class="tile-status"></span><span>${escapeHtml(peer.name)}</span></div>
  `;

  tile.querySelector("video").srcObject = stream;
  tile.querySelector("audio").srcObject = stream;
  videoGrid.appendChild(tile);
  applySpeakerSelection();
  syncVideoGrid();
  return tile;
}

function playPeerMedia(tile) {
  const video = tile.querySelector("video");
  const audio = tile.querySelector("audio");
  video?.play?.().catch(() => {});
  audio?.play?.().catch(() => {
    updatePeerStatus(tile.id.replace("peer-", ""), "Click Join again if audio is blocked");
  });
}

function updatePeerTile(peer) {
  const tile = document.getElementById(`peer-${peer.id}`);
  if (!tile) return;

  tile.querySelector("h3").textContent = peer.name;
  tile.querySelector(".initials").textContent = peer.initials;
  tile.querySelector(".tile-label span:last-child").textContent = peer.name;
  const status = tile.querySelector(".participant-art p");
  if (status) {
    status.textContent = peer.cameraOn ? "Connected" : "Camera is off";
  }
}

function updatePeerStatus(peerId, status) {
  const tile = document.getElementById(`peer-${peerId}`);
  const label = tile?.querySelector(".participant-art p");
  if (label) label.textContent = status;
}

function removePeer(peerId) {
  const peer = peers.get(peerId);
  if (peer) {
    peer.connection.close();
    peer.tile.remove();
    peers.delete(peerId);
  }
  participants.delete(peerId);
  syncVideoGrid();
}

function syncVideoGrid() {
  localTile.classList.toggle("large", peers.size === 0);
}

function renderPeople() {
  for (const item of peopleList.querySelectorAll("[data-peer-id]")) {
    item.remove();
  }

  const current = identity();
  youAvatar.textContent = current.initials;
  youName.textContent = current.name;
  youStatus.textContent = micOn ? "You - Mic on" : "You - Muted";

  for (const peer of participants.values()) {
    const row = document.createElement("div");
    row.className = "person";
    row.dataset.peerId = peer.id;
    row.innerHTML = `
      <div class="avatar">${escapeHtml(peer.initials)}</div>
      <div><strong>${escapeHtml(peer.name)}</strong><span>${peer.micOn ? "Mic on" : "Muted"} - ${peer.cameraOn ? "Camera on" : "Camera off"}</span></div>
      <div class="person-icons">${peer.cameraOn ? icons.cameraOn : icons.cameraOff}</div>
    `;
    peopleList.appendChild(row);
  }

  if (!participants.size && inCall) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.dataset.peerId = "empty";
    empty.textContent = "Waiting for another tab to join this room.";
    peopleList.appendChild(empty);
  }
}

function addSystemMessage(text) {
  addChatMessage(text, "ClearCall", false);
}

function addChatMessage(text, name, mine) {
  const message = document.createElement("div");
  message.className = mine ? "message mine" : "message";
  message.innerHTML = `<strong>${escapeHtml(mine ? "You" : name)}</strong><div class="bubble"></div>`;
  message.querySelector(".bubble").textContent = text;
  chatFeed.appendChild(message);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

async function joinCall() {
  syncIdentity();
  setConnectionState("Checking devices", "connecting");
  const mediaReady = await ensureLocalMedia({ audio: true, video: true });
  if (!mediaReady) {
    showToast("Camera or microphone blocked");
    setConnectionState("Media blocked", "error");
    return;
  }

  localStream.getAudioTracks().forEach(track => {
    track.enabled = micOn;
  });
  localStream.getVideoTracks().forEach(track => {
    track.enabled = cameraOn;
  });

  inCall = true;
  joinScreen.classList.add("hidden");
  callScreen.classList.add("active");
  window.scrollTo(0, 0);
  connectSocket();
  startClock();
  renderPeople();
}

function leaveCall() {
  inCall = false;
  clearInterval(callTimer);
  clearTimeout(reconnectTimer);
  clearInterval(peerSyncTimer);
  callClock.textContent = "00:00";
  setConnectionState("Ready", "ready");
  callScreen.classList.remove("active");
  joinScreen.classList.remove("hidden");
  window.scrollTo(0, 0);

  socket?.close();
  socket = null;
  myId = null;
  for (const peerId of [...peers.keys()]) {
    removePeer(peerId);
  }
  participants.clear();
  renderPeople();
}

async function copyInvite() {
  const invite = roomUrl();
  try {
    await navigator.clipboard.writeText(invite);
    showToast("Invite link copied");
  } catch (error) {
    showToast(invite);
  }
}

function sendReaction() {
  send({ type: "chat", text: "(like)" });
  document.querySelector('[data-panel="chatPanel"]').click();
}

previewCamera.addEventListener("click", () => setCamera(!cameraOn));
cameraTool.addEventListener("click", () => setCamera(!cameraOn));
previewMic.addEventListener("click", toggleMic);
micTool.addEventListener("click", toggleMic);
displayName.addEventListener("input", syncIdentity);
document.getElementById("joinCall").addEventListener("click", joinCall);
document.getElementById("leaveCall").addEventListener("click", leaveCall);
document.getElementById("copyInvite").addEventListener("click", copyInvite);
document.getElementById("copyInviteSetup").addEventListener("click", copyInvite);
newRoomSetup.addEventListener("click", createNewRoom);
reactionTool.addEventListener("click", sendReaction);
cameraSelect.addEventListener("change", changeInputDevice);
microphoneSelect.addEventListener("change", changeInputDevice);
speakerSelect.addEventListener("change", applySpeakerSelection);
navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
shareTool.addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showToast("Screen sharing is not available");
    return;
  }

  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    for (const peer of peers.values()) {
      const sender = peer.connection.getSenders().find(item => item.track?.kind === "video");
      await sender?.replaceTrack(screenTrack);
    }
    shareTool.classList.add("active");
    showToast("Screen sharing on");
    screenTrack.addEventListener("ended", async () => {
      const cameraTrack = localStream?.getVideoTracks()[0] || null;
      for (const peer of peers.values()) {
        const sender = peer.connection.getSenders().find(item => item.track?.kind === "video");
        await sender?.replaceTrack(cameraTrack);
      }
      shareTool.classList.remove("active");
      showToast("Screen sharing off");
    });
  } catch (error) {
    showToast("Screen sharing cancelled");
  }
});

document.querySelectorAll(".panel-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".panel-tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".panel-body").forEach(panel => panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.panel).classList.add("active");
  });
});

chatComposer.addEventListener("submit", event => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  send({ type: "chat", text });
  chatInput.value = "";
});

window.addEventListener("beforeunload", () => {
  socket?.close();
  localStream?.getTracks().forEach(track => track.stop());
});

syncIdentity();
syncDeviceStatus();
loadDevices();
