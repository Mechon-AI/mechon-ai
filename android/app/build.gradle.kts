plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "ai.mechon.companion"
    compileSdk = 34

    defaultConfig {
        applicationId = "ai.mechon.companion"
        minSdk = 26
        targetSdk = 34
        versionCode = 126
        versionName = "1.2.6"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            val keystoreFile = project.findProperty("KEYSTORE_FILE")?.toString()
                ?: System.getenv("ANDROID_KEYSTORE_PATH")
                ?: "${project.rootDir}/release.keystore"
            val keystorePassword = project.findProperty("KEYSTORE_PASSWORD")?.toString()
                ?: System.getenv("KEYSTORE_PASSWORD")
            val keyAlias = project.findProperty("KEY_ALIAS")?.toString()
                ?: System.getenv("KEY_ALIAS")
            val keyPassword = project.findProperty("KEY_PASSWORD")?.toString()
                ?: System.getenv("KEY_PASSWORD")

            if (file(keystoreFile).exists() && !keystorePassword.isNullOrBlank()) {
                storeFile = file(keystoreFile)
                storePassword = keystorePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            } else {
                val debugKeystore = file("${System.getProperty("user.home")}/.android/debug.keystore")
                if (debugKeystore.exists()) {
                    storeFile = debugKeystore
                    storePassword = "android"
                    this.keyAlias = "androiddebugkey"
                    this.keyPassword = "android"
                }
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val releaseConfig = signingConfigs.getByName("release")
            if (releaseConfig.storeFile != null) {
                signingConfig = releaseConfig
            }
        }
        debug {
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    packaging {
        jniLibs {
            useLegacyPackaging = false
        }
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")

    // Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.05.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // Room
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // Network & Serialization
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.google.code.gson:gson:2.10.1")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // QR Code Scanning (Pure JVM ZXing - 16 KB Page Aligned & Zero Native .so Overhead)
    implementation("com.google.zxing:core:3.5.3")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
    testImplementation("io.mockk:mockk:1.13.10")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
