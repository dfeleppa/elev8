import UIKit
import Flutter

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }

        // Handle deep link URLs that launched the app (cold start)
        if let urlContext = connectionOptions.urlContexts.first {
            handleIncomingURL(urlContext.url)
        }
    }

    // Handle deep link URLs when the app is already running (warm start)
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        handleIncomingURL(url)
    }

    private func handleIncomingURL(_ url: URL) {
        // Forward the deep link URL to Flutter/Supabase to complete the OAuth flow
        guard let appDelegate = UIApplication.shared.delegate as? FlutterAppDelegate else { return }
        appDelegate.application(UIApplication.shared, open: url, options: [:])
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
