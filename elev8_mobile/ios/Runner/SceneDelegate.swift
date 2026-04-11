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
        guard let appDelegate = UIApplication.shared.delegate as? FlutterAppDelegate else { return }
        // iOS 26+: scene delegate lifecycle handles URL routing automatically
        // iOS < 26: forward via the legacy app delegate method
        if #available(iOS 26.0, *) {
            // No-op: URL already routed through scene(_:openURLContexts:)
        } else {
            _openURLLegacy(appDelegate: appDelegate, url: url)
        }
    }

    // Deprecated in iOS 26.0 — only called on older OS versions.
    @available(iOS, deprecated: 26.0, message: "Use scene delegate URL context routing")
    private func _openURLLegacy(appDelegate: FlutterAppDelegate, url: URL) {
        appDelegate.application(UIApplication.shared, open: url, options: [:])
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
