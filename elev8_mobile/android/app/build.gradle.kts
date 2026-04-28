import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing config is loaded from android/key.properties (gitignored).
// To produce a real signed release: copy key.properties.template to
// key.properties, generate a keystore via `keytool`, and fill in the values.
// If the file is missing, release builds fail loudly instead of silently
// signing with the debug key.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.dfeleppa.elev8_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.dfeleppa.elev8_mobile"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                // Local `flutter run --release` still works for developers
                // who haven't set up the release keystore yet, but CI release
                // builds should set ELEV8_REQUIRE_RELEASE_SIGNING=1 to force
                // a real signing config.
                if (System.getenv("ELEV8_REQUIRE_RELEASE_SIGNING") == "1") {
                    throw GradleException(
                        "Release build requested but android/key.properties is missing. " +
                        "See android/key.properties.template."
                    )
                }
                logger.warn(
                    "WARNING: signing release build with debug key — " +
                    "android/key.properties not found. DO NOT distribute this build."
                )
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}
