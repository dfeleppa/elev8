import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Group {
            if let message = session.configurationError {
                ConfigMissingView(message: message)
            } else if let auth = session.auth, let store = session.store {
                AuthenticatedRootView(auth: auth, store: store)
            } else {
                ProgressView()
            }
        }
    }
}

private struct AuthenticatedRootView: View {
    @ObservedObject var auth: AuthService
    let store: NutritionStore

    var body: some View {
        Group {
            if auth.isRestoring {
                ProgressView("Restoring session…")
                    .tint(AppTheme.cyan)
            } else if auth.isSignedIn {
                MainTabView()
                    .environmentObject(auth)
                    .environmentObject(store)
            } else {
                AuthView()
                    .environmentObject(auth)
            }
        }
    }
}

struct MainTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var auth: AuthService
    @EnvironmentObject private var store: NutritionStore

    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "flame.fill") }
            FoodsView()
                .tabItem { Label("Foods", systemImage: "carrot.fill") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
        .tint(AppTheme.cyan)
        .task {
            await store.refreshAll()
            await store.autoSyncHealthIfAuthorized()
        }
        .onChange(of: auth.memberId) { _, _ in
            Task { await store.refreshAll() }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            Task { await store.refreshFromForeground() }
        }
    }
}

struct ConfigMissingView: View {
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "key.horizontal.fill")
                .font(.system(size: 44))
                .foregroundStyle(AppTheme.cyan)
            Text("Supabase not configured")
                .font(.title2.bold())
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Text("Copy NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the web app into Elev8Nutrition/Config.xcconfig (or Config.local.xcconfig).")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(28)
    }
}
