import Foundation

protocol InternetCallingClient {
    func startCall(with participant: UserProfile, kind: CallKind, conversationID: UUID) async throws -> CallSession
    func endCall(_ session: CallSession) async
}

struct LocalInternetCallingClient: InternetCallingClient {
    func startCall(with participant: UserProfile, kind: CallKind, conversationID: UUID) async throws -> CallSession {
        try await Task.sleep(nanoseconds: 300_000_000)
        return CallSession(
            id: UUID(),
            conversationID: conversationID,
            participant: participant,
            kind: kind,
            state: .connected,
            startedAt: .now,
            isMuted: false,
            isCameraEnabled: kind == .video
        )
    }

    func endCall(_ session: CallSession) async {
        try? await Task.sleep(nanoseconds: 120_000_000)
    }
}
