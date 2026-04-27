import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ZStack {
            TabView {
                ConversationListView()
                    .tabItem {
                        Label("Chats", systemImage: "bubble.left.and.bubble.right.fill")
                    }

                ContactsView()
                    .tabItem {
                        Label("Contacts", systemImage: "person.2.fill")
                    }
            }
            .tint(.teal)
            .onAppear {
                appState.connect()
            }

            if let activeCall = appState.activeCall {
                CallView(session: activeCall)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .zIndex(2)
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: appState.activeCall)
    }
}

struct RootView_Previews: PreviewProvider {
    static var previews: some View {
        RootView()
            .environmentObject(AppState())
    }
}
