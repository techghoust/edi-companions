import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.models.ProductRelease

plugins {
    java
    id("org.jetbrains.intellij.platform")
}

group = "com.techghoust.edi"
version = providers.gradleProperty("pluginVersion").get()

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(21)
}

dependencies {
    intellijPlatform {
        intellijIdea("2025.2.6.2")
    }
}

intellijPlatform {
    pluginConfiguration {
        name = "EDI Developer Journal Companion"
        version = project.version.toString()
        ideaVersion {
            sinceBuild = "252"
        }
    }
    pluginVerification {
        ides {
            select {
                types = listOf(
                    IntelliJPlatformType.PyCharmProfessional,
                    IntelliJPlatformType.WebStorm,
                    IntelliJPlatformType.CLion,
                )
                channels = listOf(ProductRelease.Channel.RELEASE)
                sinceBuild = "252"
                untilBuild = "252.*"
            }
        }
    }
}
