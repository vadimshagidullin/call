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
const buildTag = document.getElementById("buildTag");
const cameraSelect = document.getElementById("cameraSelect");
const microphoneSelect = document.getElementById("microphoneSelect");
const speakerSelect = document.getElementById("speakerSelect");
const newRoomSetup = document.getElementById("newRoomSetup");

const appDisplayName = "Мама звонит";
const initialParams = new URLSearchParams(window.location.search);
let roomId = initialParams.get("room") || "CC-4829";
let signalingUrl = normalizeSignalingUrl(initialParams.get("signal") || window.CLEARCALL_SIGNALING_URL || "");
const buildId = window.CLEARCALL_BUILD || "local";
const icons = {
  micOn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path></svg>`,
  micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m2 2 20 20"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path><path d="M15 9.34V5a3 3 0 0 0-5.94-.6"></path><path d="M19 10v2a7 7 0 0 1-.7 3.05"></path><path d="M5 10v2a7 7 0 0 0 7 7v3"></path></svg>`,
  cameraOn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 10.5 21 7v10l-6-3.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3.5Z"></path></svg>`,
  cameraOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 10.5 21 7v10l-6-3.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3.5Z"></path><path d="m2 2 20 20"></path></svg>`
};

let localStream = null;
let cameraOn = true;
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
const senderKinds = new WeakMap();

roomCode.textContent = roomId;
buildTag.textContent = `v-${buildId}`;
if (!new URLSearchParams(window.location.search).has("room")) {
  window.history.replaceState({}, "", `${window.location.pathname}?room=${encodeURIComponent(roomId)}`);
}
if (window.location.protocol === "file:") {
  setConnectionState(t("Use localhost", "Откройте localhost"), "error");
  cameraHelp.textContent = t("Open http://localhost:4173 to use WebRTC rooms and signaling.", "Откройте http://localhost:4173, чтобы использовать комнаты WebRTC и сигналинг.");
} else if (window.location.hostname.endsWith(".netlify.app") && !signalingUrl) {
  setConnectionState(t("Set signaling URL", "Укажите URL сигналинга"), "error");
  cameraHelp.textContent = t("Netlify is serving the page, but live calls need SIGNALING_URL set to a WebSocket backend.", "Netlify показывает страницу, но живым звонкам нужен SIGNALING_URL на WebSocket-сервер.");
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ME";
  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join("");
}

function identity() {
  const name = displayName.value.trim() || t("Guest", "Гость");
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

function t(en, ru) {
  return `${en} / ${ru}`;
}

function micLabel(enabled) {
  return enabled
    ? t("Microphone on", "Микрофон включен")
    : t("Microphone muted", "Микрофон выключен");
}

function cameraLabel(enabled) {
  return enabled
    ? t("Camera on", "Камера включена")
    : t("Camera off", "Камера выключена");
}

function mediaKindLabel(kind) {
  if (kind === "audio") return "аудио";
  if (kind === "video") return "видео";
  return `${kind}`;
}

function connectionStateRu(state) {
  const labels = {
    new: "новое",
    connecting: "подключение",
    checking: "проверка",
    connected: "подключено",
    disconnected: "отключено",
    failed: "ошибка",
    closed: "закрыто"
  };
  return labels[state] || state;
}

function connectionStateLabel(state) {
  return t(state, connectionStateRu(state));
}

function descriptionTypeRu(type) {
  const labels = {
    offer: "предложение",
    answer: "ответ"
  };
  return labels[type] || type;
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
    showToast(t("Leave the current room first", "Сначала выйдите из текущей комнаты"));
    return;
  }

  roomId = generateRoomId();
  updateRoomUrl();
  setConnectionState(window.location.protocol === "file:" ? t("Use localhost", "Откройте localhost") : t("Ready", "Готово"), window.location.protocol === "file:" ? "error" : "ready");
  showToast(t(`New room ${roomId}`, `Новая комната ${roomId}`));
}

function setConnectionState(text, tone = "ready") {
  connectionStatus.textContent = text;
  connectionStatus.className = `connection-state ${tone}`;
}

function switchToChat() {
  const chatTab = document.querySelector('[data-panel="chatPanel"]');
  chatTab?.click();
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
  if (device.label) return device.label;
  const fallbackRu = {
    Camera: "Камера",
    Microphone: "Микрофон",
    Speaker: "Динамик"
  }[fallback] || "Устройство";
  return t(`${fallback} ${index + 1}`, `${fallbackRu} ${index + 1}`);
}

function fillDeviceSelect(select, devices, fallbackLabel) {
  const previous = select.value;
  const fallbackRu = {
    Camera: "камера",
    Microphone: "микрофон",
    Speaker: "динамик"
  }[fallbackLabel] || "устройство";
  select.innerHTML = `<option value="">${t(`Default ${fallbackLabel.toLowerCase()}`, `${fallbackRu} по умолчанию`)}</option>`;
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
      showToast(t("Speaker output could not be changed", "Не удалось изменить динамик"));
    }
  }
}

async function changeInputDevice() {
  if (!localStream) return;
  setConnectionState(t("Switching device", "Переключаем устройство"), "connecting");
  const ok = await ensureLocalMedia({ audio: true, video: cameraOn, force: true });
  setConnectionState(ok ? t("Device ready", "Устройство готово") : t("Device blocked", "Устройство заблокировано"), ok ? "connected" : "error");
  if (inCall && ok) sendUserUpdate();
}

function syncIdentity() {
  const current = identity();
  previewInitials.textContent = current.initials;
  localInitials.textContent = current.initials;
  youAvatar.textContent = current.initials;
  youName.textContent = current.name;
  localTileName.textContent = current.name;
  localLabel.textContent = `${current.name} (${t("you", "вы")})`;
  sendUserUpdate();
}

function syncDeviceStatus() {
  micDot.classList.toggle("off", !micOn);
  micStatus.textContent = micLabel(micOn);
  cameraDot.classList.toggle("off", !cameraOn);
  cameraStatus.textContent = cameraLabel(cameraOn);
  localTileStatus.textContent = cameraOn ? t("Camera is on", "Камера включена") : t("Camera is off", "Камера выключена");
  youStatus.textContent = micOn ? t("You - Mic on", "Вы - микрофон включен") : t("You - Muted", "Вы - без звука");
  previewMic.innerHTML = micOn ? icons.micOn : icons.micOff;
  micTool.innerHTML = micOn ? icons.micOn : icons.micOff;
  previewCamera.innerHTML = cameraOn ? icons.cameraOn : icons.cameraOff;
  cameraTool.innerHTML = cameraOn ? icons.cameraOn : icons.cameraOff;
  setButtonState(previewMic, micOn, t("Mute microphone", "Выключить микрофон"), t("Unmute microphone", "Включить микрофон"));
  setButtonState(micTool, micOn, t("Mute microphone", "Выключить микрофон"), t("Unmute microphone", "Включить микрофон"));
  setButtonState(previewCamera, cameraOn, t("Turn camera off", "Выключить камеру"), t("Turn camera on", "Включить камеру"));
  setButtonState(cameraTool, cameraOn, t("Turn camera off", "Выключить камеру"), t("Turn camera on", "Включить камеру"));

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
    cameraHelp.textContent = t("Your browser does not expose camera or microphone access from this page.", "Браузер не дает доступ к камере или микрофону на этой странице.");
    setConnectionState(t("Media unavailable", "Медиа недоступны"), "error");
    return null;
  }

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    setConnectionState(t("Media blocked", "Медиа заблокированы"), "error");
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

function addLocalTrack(connection, track) {
  const sender = connection.addTrack(track, localStream);
  senderKinds.set(sender, track.kind);
  return sender;
}

function senderForKind(connection, kind) {
  return connection.getSenders().find(sender => sender.track?.kind === kind || senderKinds.get(sender) === kind);
}

async function replacePeerTrack(kind, track) {
  for (const peer of peers.values()) {
    const sender = senderForKind(peer.connection, kind);
    if (sender) {
      await sender.replaceTrack(track);
      senderKinds.set(sender, kind);
    } else if (track && localStream) {
      addLocalTrack(peer.connection, track);
    }
  }
}

async function replacePeerTracks() {
  for (const peer of peers.values()) {
    const tracks = localStream?.getTracks() || [];
    for (const track of tracks) {
      const sender = senderForKind(peer.connection, track.kind);
      if (sender) {
        await sender.replaceTrack(track);
        senderKinds.set(sender, track.kind);
      } else {
        addLocalTrack(peer.connection, track);
      }
    }
  }
}

function stopLocalVideoTracks() {
  const videoTracks = localStream?.getVideoTracks() || [];
  videoTracks.forEach(track => {
    track.enabled = false;
    track.stop();
    localStream?.removeTrack(track);
  });
  previewVideo.srcObject = localStream;
  localVideo.srcObject = localStream;
}

function stopLocalMedia() {
  localStream?.getTracks().forEach(track => track.stop());
  localStream = null;
  previewVideo.srcObject = null;
  localVideo.srcObject = null;
  previewFrame.classList.remove("camera-ready");
  localTile.classList.remove("camera-ready");
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
      cameraHelp.textContent = t("Camera was not available, but your microphone is connected.", "Камера недоступна, но микрофон подключен.");
      await replacePeerTracks();
      return true;
    }
  }

  cameraHelp.textContent = t("Camera or microphone permission was not granted. You can try joining again.", "Доступ к камере или микрофону не разрешен. Попробуйте войти еще раз.");
  return false;
}

async function setCamera(nextValue) {
  if (nextValue) {
    cameraOn = true;
    const available = await ensureLocalMedia({ audio: inCall, video: true });
    if (!available || !hasVideoTrack()) {
      cameraOn = false;
      syncDeviceStatus();
      return;
    }
    syncDeviceStatus();
    return;
  }

  cameraOn = false;
  stopLocalVideoTracks();
  await replacePeerTrack("video", null);
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
  callClock.textContent = t("Live 00:00", "Эфир 00:00");
  callTimer = setInterval(() => {
    elapsed += 1;
    callClock.textContent = t(`Live ${formatTime(elapsed)}`, `Эфир ${formatTime(elapsed)}`);
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
    setConnectionState(t("No signaling URL", "Нет URL сигналинга"), "error");
    showToast(t("Set SIGNALING_URL on Netlify", "Укажите SIGNALING_URL в Netlify"));
    return;
  }

  socket = new WebSocket(wsUrl());
  setConnectionState(t("Connecting", "Подключение"), "connecting");

  socket.addEventListener("open", () => {
    const current = identity();
    setConnectionState(t("Joining room", "Входим в комнату"), "connecting");
    send({ type: "join", roomId, ...current });
  });

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  });

  socket.addEventListener("close", () => {
    if (!inCall) return;
    setConnectionState(t("Reconnecting", "Переподключение"), "connecting");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectSocket, 900);
  });

  socket.addEventListener("error", () => {
    setConnectionState(t("Signaling error", "Ошибка сигналинга"), "error");
  });
}

function sendUserUpdate() {
  if (!inCall || !myId) return;
  send({ type: "user-update", ...identity() });
}

function handleServerMessage(message) {
  if (message.type === "joined") {
    myId = message.id;
    setConnectionState(t("In room", "В комнате"), "connected");
    participants.clear();
    for (const peer of message.peers) {
      participants.set(peer.id, peer);
      ensurePeer(peer, shouldInitiateOffer(peer.id));
    }
    startPeerSync();
    renderPeople();
    addSystemMessage(t(`Joined room ${message.roomId}.`, `Вы вошли в комнату ${message.roomId}.`));
    return;
  }

  if (message.type === "peer-joined") {
    participants.set(message.peer.id, message.peer);
    ensurePeer(message.peer, shouldInitiateOffer(message.peer.id));
    renderPeople();
    addSystemMessage(t(`${message.peer.name} joined.`, `${message.peer.name} вошел в комнату.`));
    return;
  }

  if (message.type === "peers") {
    for (const peer of message.peers) {
      participants.set(peer.id, peer);
      ensurePeer(peer, shouldInitiateOffer(peer.id));
    }
    renderPeople();
    return;
  }

  if (message.type === "peer-left") {
    addSystemMessage(t("A participant left.", "Участник вышел."));
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
      addSystemMessage(t(`Connection setup error: ${error.message}`, `Ошибка настройки соединения: ${error.message}`));
      setConnectionState(t("Connection error", "Ошибка соединения"), "error");
    });
    return;
  }

  if (message.type === "chat") {
    addChatMessage(message.text, message.name, message.from === myId);
    return;
  }

  if (message.type === "error") {
    addSystemMessage(t(`Server error: ${message.message}`, `Ошибка сервера: ${message.message}`));
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

function startPeerSync() {
  clearInterval(peerSyncTimer);
  send({ type: "sync-peers" });
  peerSyncTimer = setInterval(() => {
    if (inCall) send({ type: "sync-peers" });
  }, 3500);
}

function shouldInitiateOffer(peerId) {
  return Boolean(myId && peerId && myId < peerId);
}

function ensurePeer(peer, shouldOffer = false) {
  const state = createPeer(peer);
  if (shouldOffer && !state.madeOffer && !state.makingOffer && state.connection.signalingState === "stable") {
    makeOffer(peer.id);
  }
  return state;
}

function createPeer(peer) {
  if (peers.has(peer.id)) return peers.get(peer.id);

  const connection = new RTCPeerConnection(peerConfig());
  const remoteStream = new MediaStream();
  const tile = createPeerTile(peer, remoteStream);
  addSystemMessage(t(`Connecting to ${peer.name}.`, `Подключаемся к ${peer.name}.`));

  if (localStream) {
    localStream.getTracks().forEach(track => addLocalTrack(connection, track));
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
    if (event.track.kind === "video") {
      tile.classList.add("camera-ready");
      event.track.addEventListener("ended", () => {
        tile.classList.remove("camera-ready");
      });
    }
    updatePeerStatus(peer.id, t(`Receiving ${event.track.kind}`, `Получаем ${mediaKindLabel(event.track.kind)}`));
    addSystemMessage(t(`Receiving ${event.track.kind} from ${peer.name}.`, `Получаем ${mediaKindLabel(event.track.kind)} от ${peer.name}.`));
    playPeerMedia(tile);
  });

  connection.addEventListener("connectionstatechange", () => {
    tile.classList.toggle("connecting", ["connecting", "new", "checking"].includes(connection.connectionState));
    if (["connecting", "new", "checking"].includes(connection.connectionState)) {
      setConnectionState(t("Connecting peer", "Подключаем участника"), "connecting");
      updatePeerStatus(peer.id, connectionStateLabel(connection.connectionState));
    }
    if (["failed", "closed", "disconnected"].includes(connection.connectionState)) {
      updatePeerStatus(peer.id, connectionStateLabel(connection.connectionState));
      setConnectionState(t("Peer disconnected", "Участник отключился"), "error");
      addSystemMessage(t(`${peer.name} connection is ${connection.connectionState}.`, `Соединение с ${peer.name}: ${connectionStateRu(connection.connectionState)}.`));
    } else if (connection.connectionState === "connected") {
      updatePeerStatus(peer.id, t("Connected", "Подключено"));
      setConnectionState(t("Peer connected", "Участник подключен"), "connected");
      addSystemMessage(t(`${peer.name} connected.`, `${peer.name} подключен.`));
    }
  });

  const state = {
    id: peer.id,
    connection,
    remoteStream,
    tile,
    pendingCandidates: [],
    madeOffer: false,
    makingOffer: false,
    ignoreOffer: false
  };
  peers.set(peer.id, state);

  return state;
}

async function makeOffer(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;
  if (peer.makingOffer || peer.connection.signalingState !== "stable") return;

  peer.makingOffer = true;
  try {
    peer.madeOffer = true;
    const participant = participants.get(peerId);
    addSystemMessage(participant
      ? t(`Sending connection offer to ${participant.name}.`, `Отправляем предложение соединения для ${participant.name}.`)
      : t("Sending connection offer.", "Отправляем предложение соединения."));
    const offer = await peer.connection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await peer.connection.setLocalDescription(offer);
    send({ type: "signal", to: peerId, data: { description: peer.connection.localDescription } });
  } catch (error) {
    peer.madeOffer = false;
    throw error;
  } finally {
    peer.makingOffer = false;
  }
}

async function handleSignal(peerId, data) {
  let peer = peers.get(peerId);
  const participant = participants.get(peerId) || { id: peerId, name: t("Guest", "Гость"), initials: "G", micOn: true, cameraOn: true };
  if (!peer) peer = createPeer(participant);

  if (data.description) {
    const { connection } = peer;
    const description = data.description;
    const isOffer = description.type === "offer";
    const isAnswer = description.type === "answer";
    const offerCollision = isOffer && (peer.makingOffer || connection.signalingState !== "stable");

    if (offerCollision && shouldInitiateOffer(peerId)) {
      peer.ignoreOffer = true;
      console.warn("Ignored colliding offer from", peerId);
      return;
    }

    if (offerCollision) {
      if (connection.signalingState !== "have-local-offer") {
        console.warn("Ignored duplicate offer from", peerId, "while", connection.signalingState);
        return;
      }
      await connection.setLocalDescription({ type: "rollback" });
    }

    if (isAnswer && connection.signalingState !== "have-local-offer") {
      console.warn("Ignored stale answer from", peerId, "while", connection.signalingState);
      return;
    }

    peer.ignoreOffer = false;
    addSystemMessage(t(`Received ${description.type} from ${participant.name}.`, `Получено ${descriptionTypeRu(description.type)} от ${participant.name}.`));
    await connection.setRemoteDescription(description);
    while (peer.pendingCandidates.length) {
      await connection.addIceCandidate(peer.pendingCandidates.shift());
    }
    if (isOffer) {
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      send({ type: "signal", to: peerId, data: { description: connection.localDescription } });
    }
  }

  if (data.candidate) {
    if (peer.ignoreOffer) return;

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
        <p>${peer.cameraOn ? t("Connecting video", "Подключаем видео") : t("Camera is off", "Камера выключена")}</p>
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
    updatePeerStatus(tile.id.replace("peer-", ""), t("Click Join again if audio is blocked", "Нажмите «Войти» еще раз, если звук заблокирован"));
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
    status.textContent = peer.cameraOn ? t("Connected", "Подключено") : t("Camera is off", "Камера выключена");
  }
  const hasLiveVideo = Boolean(tile.querySelector("video")?.srcObject?.getVideoTracks().some(track => track.readyState === "live"));
  tile.classList.toggle("camera-ready", peer.cameraOn && hasLiveVideo);
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
  const participantCount = peers.size + 1;
  videoGrid.dataset.count = String(Math.min(participantCount, 4));
  localTile.classList.toggle("large", participantCount === 1);
}

function renderPeople() {
  for (const item of peopleList.querySelectorAll("[data-peer-id]")) {
    item.remove();
  }

  const current = identity();
  youAvatar.textContent = current.initials;
  youName.textContent = current.name;
  youStatus.textContent = micOn ? t("You - Mic on", "Вы - микрофон включен") : t("You - Muted", "Вы - без звука");

  for (const peer of participants.values()) {
    const row = document.createElement("div");
    row.className = "person";
    row.dataset.peerId = peer.id;
    row.innerHTML = `
      <div class="avatar">${escapeHtml(peer.initials)}</div>
      <div><strong>${escapeHtml(peer.name)}</strong><span>${peer.micOn ? t("Mic on", "Микрофон включен") : t("Muted", "Без звука")} - ${peer.cameraOn ? cameraLabel(true) : cameraLabel(false)}</span></div>
      <div class="person-icons">${peer.cameraOn ? icons.cameraOn : icons.cameraOff}</div>
    `;
    peopleList.appendChild(row);
  }

  if (!participants.size && inCall) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.dataset.peerId = "empty";
    empty.textContent = t("Waiting for another tab to join this room.", "Ждем, пока другая вкладка войдет в эту комнату.");
    peopleList.appendChild(empty);
  }
}

function addSystemMessage(text) {
  console.info(`[${appDisplayName}] ${text}`);
  addChatMessage(text, appDisplayName, false);
}

function addChatMessage(text, name, mine) {
  const message = document.createElement("div");
  message.className = mine ? "message mine" : "message";
  message.innerHTML = `<strong>${escapeHtml(mine ? t("You", "Вы") : name)}</strong><div class="bubble"></div>`;
  message.querySelector(".bubble").textContent = text;
  chatFeed.appendChild(message);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

async function joinCall() {
  syncIdentity();
  setConnectionState(t("Checking devices", "Проверяем устройства"), "connecting");
  cameraOn = true;
  const mediaReady = await ensureLocalMedia({ audio: true, video: true });
  if (!mediaReady) {
    showToast(t("Camera or microphone blocked", "Камера или микрофон заблокированы"));
    setConnectionState(t("Media blocked", "Медиа заблокированы"), "error");
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
  addSystemMessage(t(`Client ${buildId} joined locally.`, `Клиент ${buildId} вошел локально.`));
  switchToChat();
}

function leaveCall() {
  inCall = false;
  clearInterval(callTimer);
  clearTimeout(reconnectTimer);
  clearInterval(peerSyncTimer);
  callClock.textContent = "00:00";
  setConnectionState(t("Ready", "Готово"), "ready");
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
  cameraOn = false;
  micOn = true;
  stopLocalMedia();
  syncDeviceStatus();
  renderPeople();
}

async function copyInvite() {
  const invite = roomUrl();
  try {
    await navigator.clipboard.writeText(invite);
    showToast(t("Invite link copied", "Ссылка-приглашение скопирована"));
  } catch (error) {
    showToast(invite);
  }
}

function sendReaction() {
  send({ type: "chat", text: t("(like)", "(лайк)") });
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
    showToast(t("Screen sharing is not available", "Демонстрация экрана недоступна"));
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
    showToast(t("Screen sharing on", "Демонстрация экрана включена"));
    screenTrack.addEventListener("ended", async () => {
      const cameraTrack = localStream?.getVideoTracks()[0] || null;
      for (const peer of peers.values()) {
        const sender = peer.connection.getSenders().find(item => item.track?.kind === "video");
        await sender?.replaceTrack(cameraTrack);
      }
      shareTool.classList.remove("active");
      showToast(t("Screen sharing off", "Демонстрация экрана выключена"));
    });
  } catch (error) {
    showToast(t("Screen sharing cancelled", "Демонстрация экрана отменена"));
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
setCamera(true);
