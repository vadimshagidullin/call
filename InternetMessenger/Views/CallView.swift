import SwiftUI

struct CallView: View {
    @EnvironmentObject private var appState: AppState
    let session: CallSession

    var body: some View {
        VStack(spacing: 22) {
            Capsule()
                .fill(.white.opacity(0.45))
                .frame(width: 54, height: 5)
                .padding(.top, 10)

            Spacer()

            VStack(spacing: 14) {
                AvatarView(profile: session.participant, size: 104)

                VStack(spacing: 4) {
                    Text(session.participant.displayName)
                        .font(.title2.weight(.semibold))

                    Text("\(session.kind.rawValue) internet call")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            if session.kind == .video {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(session.isCameraEnabled ? Color.teal.opacity(0.22) : Color.black.opacity(0.08))
                    .frame(height: 190)
                    .overlay {
                        VStack(spacing: 10) {
                            Image(systemName: session.isCameraEnabled ? "video.fill" : "video.slash.fill")
                                .font(.largeTitle)
                            Text(session.isCameraEnabled ? "Camera on" : "Camera off")
                                .font(.headline)
                        }
                        .foregroundStyle(session.isCameraEnabled ? .teal : .secondary)
                    }
                    .padding(.horizontal)
            }

            VStack(spacing: 8) {
                Text(session.state.rawValue)
                    .font(.headline)

                if session.state == .connected {
                    TimelineView(.periodic(from: session.startedAt, by: 1)) { context in
                        Text(callDuration(from: session.startedAt, to: context.date))
                            .font(.system(.title3, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            HStack(spacing: 24) {
                CallControlButton(
                    systemImage: session.isMuted ? "mic.slash.fill" : "mic.fill",
                    title: session.isMuted ? "Unmute" : "Mute",
                    tint: .secondary
                ) {
                    appState.toggleMute()
                }

                if session.kind == .video {
                    CallControlButton(
                        systemImage: session.isCameraEnabled ? "video.fill" : "video.slash.fill",
                        title: "Camera",
                        tint: .secondary
                    ) {
                        appState.toggleCamera()
                    }
                }

                CallControlButton(
                    systemImage: "phone.down.fill",
                    title: "End",
                    tint: .red
                ) {
                    appState.endActiveCall()
                }
            }
            .padding(.bottom, 28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.regularMaterial)
        .ignoresSafeArea()
    }

    private func callDuration(from start: Date, to end: Date) -> String {
        let seconds = max(0, Int(end.timeIntervalSince(start)))
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

private struct CallControlButton: View {
    let systemImage: String
    let title: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.title2)
                    .frame(width: 62, height: 62)
                    .background(tint.opacity(0.16))
                    .foregroundStyle(tint)
                    .clipShape(Circle())

                Text(title)
                    .font(.caption)
                    .foregroundStyle(.primary)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

struct CallView_Previews: PreviewProvider {
    static var previews: some View {
        CallView(
            session: CallSession(
                id: UUID(),
                conversationID: UUID(),
                participant: AppState().contacts[0],
                kind: .video,
                state: .connected,
                startedAt: .now.addingTimeInterval(-75),
                isMuted: false,
                isCameraEnabled: true
            )
        )
        .environmentObject(AppState())
    }
}
