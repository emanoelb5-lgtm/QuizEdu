plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "br.com.quizedu.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "br.com.quizedu.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 10000 + (System.getenv("QUIZEDU_BUILD_NUMBER")?.toIntOrNull() ?: 1)
        versionName = "1.1.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "SITE_URL", "\"https://quizedu-emanuel.emanuelb5.chatgpt.site\"")
    }
    val signingFile = System.getenv("QUIZEDU_KEYSTORE")
    if (!signingFile.isNullOrBlank()) {
        signingConfigs.create("quizEdu") {
            storeFile = file(signingFile)
            storePassword = System.getenv("QUIZEDU_STORE_PASSWORD")
            keyAlias = System.getenv("QUIZEDU_KEY_ALIAS")
            keyPassword = System.getenv("QUIZEDU_KEY_PASSWORD")
            storeType = "PKCS12"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (!signingFile.isNullOrBlank()) signingConfig = signingConfigs.getByName("quizEdu")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    lint { abortOnError = true; checkReleaseBuilds = true }
}
dependencies {
    val compose = platform("androidx.compose:compose-bom:2025.05.01")
    implementation(compose)
    androidTestImplementation(compose)
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
