import Foundation

@MainActor
final class AppState: ObservableObject {
    @Published var currentUser: UserProfile
    @Published var conversations: [Conversation]
    @Published var selectedConversationID: Conversation.ID?
    @Published var activeCall: CallSession?
    @Published var connectionStatus = "Online"

    private let messagingClient: RealtimeMessagingClient
    private let callingClient: InternetCallingClient

    init(
        messagingClient: RealtimeMessagingClient = LocalRealtimeMessagingClient(),
        callingClient: InternetCallingClient = LocalInternetCallingClient()
    ) {
        self.messagingClient = messagingClient
        self.callingClient = callingClient

        let me = UserProfile(
            id: UUID(uuidString: "4B7B9E53-09C7-4E8B-B5DB-1C4D82786001")!,
            displayName: "You",
            handle: "@you",
            avatarInitials: "YU",
            isOnline: true
        )
        let maya = UserProfile(
            id: UUID(uuidString: "4B7B9E53-09C7-4E8B-B5DB-1C4D82786002")!,
            displayName: "Maya Chen",
            handle: "@maya",
            avatarInitials: "MC",
            isOnline: true
        )
        let ari = UserProfile(
            id: UUID(uuidString: "4B7B9E53-09C7-4E8B-B5DB-1C4D82786003")!,
            displayName: "Ari Singh",
            handle: "@ari",
            avatarInitials: "AS",
            isOnline: false
        )

        let mayaConversationID = UUID(uuidString: "4B7B9E53-09C7-4E8B-B5DB-1C4D82786010")!
        let ariConversationID = UUID(uuidString: "4B7B9E53-09C7-4E8B-B5DB-1C4D82786011")!

        currentUser = me
        conversations = [
            Conversation(
                id: mayaConversationID,
                participant: maya,
                messages: [
                    ChatMessage(
                        id: UUID(),
                        conversationID: mayaConversationID,
                        senderID: maya.id,
                        body: "Can you join a quick internet call?",
                        sentAt: .now.addingTimeInterval(-640),
                        deliveryState: .delivered
                    ),
                    ChatMessage(
                        id: UUID(),
                        conversationID: mayaConversationID,
                        senderID: me.id,
                        body: "Yes. Audio first, then video if we need it.",
                        sentAt: .now.addingTimeInterval(-520),
                        deliveryState: .delivered
                    )
                ],
                unreadCount: 1
            ),
            Conversation(
                id: ariConversationID,
                participant: ari,
                messages: [
                    ChatMessage(
                        id: UUID(),
                        conversationID: ariConversationID,
                        senderID: ari.id,
                        body: "The new chat build is feeling smooth.",
                        sentAt: .now.addingTimeInterval(-3_900),
                        deliveryState: .delivered
                    )
                ],
                unreadCount: 0
            )
        ].sorted { $0.lastActivity > $1.lastActivity }
        selectedConversationID = conversations.first?.id
    }

    var selectedConversation: Conversation? {
        guard let selectedConversationID = selectedConversationID else { return nil }
        return conversations.first { $0.id == selectedConversationID }
    }

    var contacts: [UserProfile] {
        conversations.map(\.participant).sorted { $0.displayName < $1.displayName }
    }

    func connect() {
        Task {
            connectionStatus = "Connecting"
            do {
                try await messagingClient.connect(as: currentUser)
                connectionStatus = "Online"
            } catch {
                connectionStatus = "Offline"
            }
        }
    }

    func sendMessage(_ text: String, in conversationID: Conversation.ID) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = conversations.firstIndex(where: { $0.id == conversationID }) else {
            return
        }

        let message = ChatMessage(
            id: UUID(),
            conversationID: conversationID,
            senderID: currentUser.id,
            body: trimmed,
            sentAt: .now,
            deliveryState: .sending
        )

        conversations[index].messages.append(message)
        sortConversations()

        Task {
            guard let conversation = conversations.first(where: { $0.id == conversationID }) else { return }
            do {
                let delivered = try await messagingClient.send(message, to: conversation.participant)
                updateMessage(delivered)
            } catch {
                var failed = message
                failed.deliveryState = .failed
                updateMessage(failed)
            }
        }
    }

    func startCall(kind: CallKind, in conversationID: Conversation.ID) {
        guard let conversation = conversations.first(where: { $0.id == conversationID }) else { return }
        activeCall = CallSession(
            id: UUID(),
            conversationID: conversationID,
            participant: conversation.participant,
            kind: kind,
            state: .connecting,
            startedAt: .now,
            isMuted: false,
            isCameraEnabled: kind == .video
        )

        Task {
            do {
                activeCall = try await callingClient.startCall(
                    with: conversation.participant,
                    kind: kind,
                    conversationID: conversationID
                )
            } catch {
                activeCall?.state = .ended
            }
        }
    }

    func endActiveCall() {
        guard let session = activeCall else { return }
        activeCall?.state = .ended
        Task {
            await callingClient.endCall(session)
            activeCall = nil
        }
    }

    func toggleMute() {
        activeCall?.isMuted.toggle()
    }

    func toggleCamera() {
        guard activeCall?.kind == .video else { return }
        activeCall?.isCameraEnabled.toggle()
    }

    func markRead(conversationID: Conversation.ID) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationID }) else { return }
        conversations[index].unreadCount = 0
    }

    private func updateMessage(_ updated: ChatMessage) {
        guard let conversationIndex = conversations.firstIndex(where: { $0.id == updated.conversationID }),
              let messageIndex = conversations[conversationIndex].messages.firstIndex(where: { $0.id == updated.id }) else {
            return
        }

        conversations[conversationIndex].messages[messageIndex] = updated
        sortConversations()
    }

    private func sortConversations() {
        conversations.sort { $0.lastActivity > $1.lastActivity }
    }
}
