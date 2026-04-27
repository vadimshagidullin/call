# InternetMessenger

# call

InternetMessenger is a SwiftUI iOS starter app for messaging and audio/video calls that are intended to run over the internet only. It does not use SMS, MMS, or carrier telephony APIs.

## What is included

- Chat list, conversation detail, message composer, contacts, and call controls.
- Local demo clients for sending messages and starting audio/video calls.
- Protocol boundaries for replacing the demo clients with a real WebSocket messaging service and a WebRTC calling stack.
- Camera and microphone usage descriptions in the generated app Info.plist settings.

## Open the app

Open `InternetMessenger.xcodeproj` in Xcode, then run the `InternetMessenger` scheme on an iOS simulator or device.

## Open the web video-call preview

Run `npm start`, then open `http://localhost:4173`.

Open the same invite link in two browser tabs to test a local WebRTC call. The Node server serves the frontend and provides the WebSocket signaling channel for rooms, chat, peer joins, peer leaves, and WebRTC offer/answer/ICE exchange.

Use `New room` on the join screen to generate a fresh invite link. Opening `Preview/index.html` directly can show the interface, but live rooms require the local server URL.

## Publish the web app

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vadimshagidullin/call)

Deploy it as a Node web service, not static hosting, because WebRTC signaling uses the `/ws` WebSocket endpoint.

- Start command: `npm start`
- Health check path: `/healthz`
- Port: use the platform-provided `PORT` environment variable

This repo includes `render.yaml` for Render-style blueprint deploys and a `Dockerfile` for container hosts.

## Production pieces still needed

- Authentication and user identity.
- A backend for accounts, contacts, message persistence, and delivery receipts.
- Production WebSocket or MQTT transport for realtime messages.
- Production WebRTC signaling, STUN/TURN configuration, and media session handling for internet calls.
- Push notifications for offline message and incoming call alerts.
- End-to-end encryption if private communications are required.
# call
