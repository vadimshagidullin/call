import SwiftUI

struct ContactsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationView {
            List {
                ForEach(appState.contacts) { contact in
                    HStack(spacing: 12) {
                        AvatarView(profile: contact, size: 44)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(contact.displayName)
                                .font(.headline)
                            Text(contact.handle)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        if let conversation = appState.conversations.first(where: { $0.participant.id == contact.id }) {
                            Button {
                                appState.selectedConversationID = conversation.id
                            } label: {
                                Image(systemName: "message.fill")
                            }
                            .buttonStyle(.bordered)
                            .accessibilityLabel("Open chat with \(contact.displayName)")

                            Button {
                                appState.startCall(kind: .audio, in: conversation.id)
                            } label: {
                                Image(systemName: "phone.fill")
                            }
                            .buttonStyle(.bordered)
                            .accessibilityLabel("Call \(contact.displayName)")
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
            .navigationTitle("Contacts")
        }
    }
}

struct ContactsView_Previews: PreviewProvider {
    static var previews: some View {
        ContactsView()
            .environmentObject(AppState())
    }
}
