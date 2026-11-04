package ai.mechon.companion.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = MechonBlue,
    onPrimary = TextPrimary,
    primaryContainer = MechonBlueDark,
    onPrimaryContainer = TextPrimary,
    secondary = MechonCyan,
    onSecondary = MechonDarkBg,
    tertiary = MechonPurple,
    background = MechonDarkBg,
    onBackground = TextPrimary,
    surface = MechonSurface,
    onSurface = TextPrimary,
    surfaceVariant = MechonSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    outline = MechonBorder,
    error = MechonRed,
    onError = TextPrimary
)

@Composable
fun MechonTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = MechonDarkBg.toArgb()
            window.navigationBarColor = MechonDarkBg.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
