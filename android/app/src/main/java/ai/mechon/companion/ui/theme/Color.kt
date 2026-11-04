package ai.mechon.companion.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// ==========================================
// MECHON MOBILE: Obsidian Design System
// ==========================================

// Primary Surfaces
val ObsidianBlack = Color(0xFF050509)
val DeepBlack = Color(0xFF080810)
val ElevatedSurface = Color(0xFF101019)
val ElevatedSurfaceHighlight = Color(0xFF181824)
val GlassSurface = Color(0xE6101019)
val GlassBorder = Color(0x26B9A0FF)
val SubtleBorder = Color(0xFF1C1B29)

// Accent Palette (Violet & Lavender)
val ElectricViolet = Color(0xFF8B5CF6)
val DeepViolet = Color(0xFF612CEB)
val SoftLavender = Color(0xFFB9A0FF)
val AmbientGlowViolet = Color(0x268B5CF6)
val AmbientGlowDeep = Color(0x14612CEB)

// Typography Palette
val TextPrimary = Color(0xFFF5F3FF)
val TextSecondary = Color(0xFF9693A8)
val TextMuted = Color(0xFF626174)

// Status & Semantic Colors
val StatusConnected = Color(0xFF10B981) // Emerald Green
val StatusWarning = Color(0xFFF59E0B)   // Amber
val StatusError = Color(0xFFEF4444)     // Soft Crimson

// Chat & Message Surfaces
val UserBubbleBg = Color(0xFF1E1736)
val UserBubbleBorder = Color(0x4D8B5CF6)
val AssistantSurface = Color(0xFF0A0A12)
val CodeBlockBg = Color(0xFF080811)
val CodeBlockBorder = Color(0xFF1E1B2E)

// Ambient Gradients
val ObsidianBackgroundGradient = Brush.verticalGradient(
    colors = listOf(
        Color(0xFF07060F),
        Color(0xFF050509),
        Color(0xFF030306)
    )
)

val AmbientVioletRadial = Brush.radialGradient(
    colors = listOf(
        Color(0x338B5CF6),
        Color(0x00050509)
    )
)

val FloatingGlassGradient = Brush.verticalGradient(
    colors = listOf(
        Color(0xCC161524),
        Color(0xB3101019)
    )
)

val VioletGlowBrush = Brush.horizontalGradient(
    colors = listOf(
        ElectricViolet,
        SoftLavender
    )
)

// Legacy compatibility aliases to prevent compile breaks in existing files
val MechonDarkBg = ObsidianBlack
val MechonSurface = ElevatedSurface
val MechonSurfaceVariant = ElevatedSurfaceHighlight
val MechonBorder = SubtleBorder
val MechonBlue = ElectricViolet
val MechonBlueLight = SoftLavender
val MechonBlueDark = DeepViolet
val MechonCyan = SoftLavender
val MechonGreen = StatusConnected
val MechonYellow = StatusWarning
val MechonRed = StatusError
val MechonPurple = ElectricViolet
val AssistantBubbleBg = AssistantSurface
