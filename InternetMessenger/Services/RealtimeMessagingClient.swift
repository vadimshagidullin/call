import Foundation

protocol RealtimeMessagingClient {
    func connect(as user: UserProfile) async throws
    func send(_ message: ChatMessage, to participant: UserProfile) async throws -> ChatMessage
    func disconnect() async
}

struct LocalRealtimeMessagingClient: RealtimeMessagingClient {
    func connect(as user: UserProfile) async throws {
        try await Task.sleep(nanoseconds: 150_000_000)
    }

    func send(_ message: ChatMessage, to participant: UserProfile) async throws -> ChatMessage {
        try await Task.sleep(nanoseconds: 250_000_000)
        var delivered = message
        delivered.deliveryState = .delivered
        return delivered
    }

    func disconnect() async {}
}
