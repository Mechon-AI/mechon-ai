package ai.mechon.companion.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val ObsidianColorScheme = darkColorScheme(
    primary = ElectricViolet,
    onPrimary = TextPrimary,
    primaryContainer = DeepViolet,
    onPrimaryContainer = TextPrimary,
    secondary = SoftLavender,
    onSecondary = ObsidianBlack,
    secondaryContainer = ElevatedSurfaceHighlight,
    onSecondaryContainer = TextPrimary,
    tertiary = SoftLavender,
    background = ObsidianBlack,
    onBackground = TextPrimary,
    surface = ElevatedSurface,
    onSurface = TextPrimary,
    surfaceVariant = ElevatedSurfaceHighlight,
    onSurfaceVariant = TextSecondary,
    outline = SubtleBorder,
    outlineVariant = GlassBorder,
    error = StatusError,
    onError = TextPrimary
)

@Composable
fun MechonTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = ObsidianColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = ObsidianBlack.toArgb()
            window.navigationBarColor = ObsidianBlack.toArgb()
            val insets = WindowCompat.getInsetsController(window, view)
            insets.isAppearanceLightStatusBars = false
            insets.isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
