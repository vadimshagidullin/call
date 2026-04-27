import SwiftUI

struct ConversationView: View {
    @EnvironmentObject private var appState: AppState
    let conversation: Conversation

    @State private var draft = ""
    @FocusState private var isComposerFocused: Bool

    private var liveConversation: Conversation {
        appState.conversations.first { $0.id == conversation.id } ?? conversation
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(liveConversation.messages) { message in
                            MessageBubble(
                                message: message,
                                isMine: message.senderID == appState.currentUser.id
                            )
                            .id(message.id)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 12)
                }
                .background(Color(.systemGroupedBackground))
                .onChange(of: liveConversation.messages.count) { _ in
                    scrollToBottom(proxy: proxy)
                }
                .onAppear {
                    appState.markRead(conversationID: conversation.id)
                    scrollToBottom(proxy: proxy)
                }
            }

            Divider()

            composer
        }
        .navigationTitle(liveConversation.participant.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                Button {
                    appState.startCall(kind: .audio, in: liveConversation.id)
                } label: {
                    Image(systemName: "phone.fill")
                }
                .accessibilityLabel("Start audio call")

                Button {
                    appState.startCall(kind: .video, in: liveConversation.id)
                } label: {
                    Image(systemName: "video.fill")
                }
                .accessibilityLabel("Start video call")
            }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Message", text: $draft)
                .textFieldStyle(.roundedBorder)
                .focused($isComposerFocused)

            Button {
                appState.sendMessage(draft, in: conversation.id)
                draft = ""
                isComposerFocused = true
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.headline)
                    .frame(width: 42, height: 42)
                    .background(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .gray.opacity(0.25) : .teal)
                    .foregroundStyle(.white)
                    .clipShape(Circle())
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Send message")
        }
        .padding()
        .background(Color(.systemBackground))
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        guard let lastMessage = liveConversation.messages.last else { return }
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(lastMessage.id, anchor: .bottom)
            }
        }
    }
}

private struct MessageBubble: View {
    let message: ChatMessage
    let isMine: Bool

    var body: some View {
        HStack {
            if isMine { Spacer(minLength: 48) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                Text(message.body)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isMine ? Color.teal : Color(.secondarySystemGroupedBackground))
                    .foregroundStyle(isMine ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                HStack(spacing: 6) {
                    Text(message.sentAt, style: .time)
                    if isMine {
                        Text(message.deliveryState.rawValue)
                    }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)
            }

            if !isMine { Spacer(minLength: 48) }
        }
    }
}

struct ConversationView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            ConversationView(conversation: AppState().conversations[0])
                .environmentObject(AppState())
        }
    }
}
