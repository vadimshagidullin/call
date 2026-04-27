import Foundation

struct UserProfile: Identifiable, Hashable {
    let id: UUID
    var displayName: String
    var handle: String
    var avatarInitials: String
    var isOnline: Bool
}

struct Conversation: Identifiable, Hashable {
    let id: UUID
    var participant: UserProfile
    var messages: [ChatMessage]
    var unreadCount: Int

    var lastMessagePreview: String {
        messages.last?.body ?? "No messages yet"
    }

    var lastActivity: Date {
        messages.last?.sentAt ?? .distantPast
    }
}

struct ChatMessage: Identifiable, Hashable {
    enum DeliveryState: String, Hashable {
        case sending = "Sending"
        case sent = "Sent"
        case delivered = "Delivered"
        case failed = "Failed"
    }

    let id: UUID
    var conversationID: UUID
    var senderID: UUID
    var body: String
    var sentAt: Date
    var deliveryState: DeliveryState
}

enum CallKind: String, CaseIterable, Hashable {
    case audio = "Audio"
    case video = "Video"
}

struct CallSession: Identifiable, Hashable {
    enum State: String, Hashable {
        case ringing = "Ringing"
        case connecting = "Connecting"
        case connected = "Connected"
        case ended = "Ended"
    }

    let id: UUID
    var conversationID: UUID
    var participant: UserProfile
    var kind: CallKind
    var state: State
    var startedAt: Date
    var isMuted: Bool
    var isCameraEnabled: Bool
}
