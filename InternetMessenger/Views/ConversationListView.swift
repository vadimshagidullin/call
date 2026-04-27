import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationView {
            List(selection: $appState.selectedConversationID) {
                Section {
                    ForEach(appState.conversations) { conversation in
                        NavigationLink(
                            destination: ConversationView(conversation: conversation),
                            tag: conversation.id,
                            selection: $appState.selectedConversationID
                        ) {
                            ConversationRow(conversation: conversation)
                        }
                    }
                } header: {
                    HStack {
                        Text(appState.connectionStatus)
                        Spacer()
                        Image(systemName: appState.connectionStatus == "Online" ? "wifi" : "wifi.slash")
                    }
                }
            }
            .navigationTitle("Messages")

            if let conversation = appState.selectedConversation {
                ConversationView(conversation: conversation)
                    .id(conversation.id)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "message")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("Select a Chat")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct ConversationRow: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(profile: conversation.participant, size: 48)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.participant.displayName)
                        .font(.headline)
                        .lineLimit(1)

                    Spacer()

                    Text(conversation.lastActivity, style: .time)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Text(conversation.lastMessagePreview)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                    Spacer()

                    if conversation.unreadCount > 0 {
                        Text("\(conversation.unreadCount)")
                            .font(.caption2.bold())
                            .foregroundStyle(.white)
                            .frame(minWidth: 22, minHeight: 22)
                            .background(Circle().fill(.teal))
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }
}

struct AvatarView: View {
    let profile: UserProfile
    let size: CGFloat

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(LinearGradient(colors: [.teal, .indigo], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: size, height: size)
                .overlay {
                    Text(profile.avatarInitials)
                        .font(.system(size: size * 0.32, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }

            Circle()
                .fill(profile.isOnline ? .green : .gray)
                .frame(width: size * 0.24, height: size * 0.24)
                .overlay(Circle().stroke(.background, lineWidth: 2))
        }
        .accessibilityLabel("\(profile.displayName), \(profile.isOnline ? "online" : "offline")")
    }
}

struct ConversationListView_Previews: PreviewProvider {
    static var previews: some View {
        ConversationListView()
            .environmentObject(AppState())
    }
}
