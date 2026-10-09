plugins {
  alias(libs.plugins.android.application)
  // AGP 9 trae Kotlin integrado: no aplicar org.jetbrains.kotlin.android
}

android {
  namespace = "com.neox.aetheria"
  compileSdk { version = release(36) { minorApiLevel = 1 } }

  defaultConfig {
    applicationId = "com.neox.aetheria"
    minSdk = 24
    targetSdk = 36
    versionCode = 5
    versionName = "2.1.1"
  }

  // Firma: si existen las variables de entorno (CI/Play Store) usa keystore propio;
  // si no, firma con la clave de debug para obtener un APK instalable de prueba.
  val ksPath = System.getenv("KEYSTORE_PATH")

  buildTypes {
    release {
      isCrunchPngs = false
      isMinifyEnabled = false
      if (ksPath != null) {
        signingConfig = signingConfigs.create("release") {
          storeFile = file(ksPath)
          storePassword = System.getenv("STORE_PASSWORD")
          keyAlias = System.getenv("KEY_ALIAS") ?: "upload"
          keyPassword = System.getenv("KEY_PASSWORD")
        }
      } else {
        signingConfig = signingConfigs.getByName("debug")
      }
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
}
