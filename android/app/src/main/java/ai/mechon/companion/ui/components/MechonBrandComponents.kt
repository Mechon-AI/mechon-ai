package ai.mechon.companion.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lan
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.ui.theme.*
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Official Mechon Isometric Matrix Logo Mark
 * Renders the official geometric Mechon crystalline matrix with purple/obsidian identity.
 */
@Composable
fun MechonLogoMark(
    modifier: Modifier = Modifier,
    size: Dp = 32.dp,
    animated: Boolean = false
) {
    val infiniteTransition = rememberInfiniteTransition(label = "mechon_pulse")
    val pulseAlpha by if (animated) {
        infiniteTransition.animateFloat(
            initialValue = 0.4f,
            targetValue = 0.9f,
            animationSpec = infiniteRepeatable(
                animation = tween(2400, easing = EaseInOutCubic),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulse"
        )
    } else {
        remember { mutableFloatStateOf(0.7f) }
    }

    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.28f)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = this.size.width
            val h = this.size.height
            val cx = w / 2f
            val cy = h / 2f
            val r = (w.coerceAtMost(h) / 2f) * 0.88f

            // 1. Ambient Background Glow
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        ElectricViolet.copy(alpha = pulseAlpha * 0.45f),
                        DeepViolet.copy(alpha = pulseAlpha * 0.15f),
                        Color.Transparent
                    ),
                    center = Offset(cx, cy),
                    radius = r * 1.3f
                )
            )

            // 2. Outer Hexagonal Frame
            val hexPath = Path()
            for (i in 0 until 6) {
                val angle = (i * 60f - 30f) * (PI.toFloat() / 180f)
                val x = cx + r * cos(angle)
                val y = cy + r * sin(angle)
                if (i == 0) hexPath.moveTo(x, y) else hexPath.lineTo(x, y)
            }
            hexPath.close()

            drawPath(
                path = hexPath,
                color = SubtleBorder,
                style = Stroke(width = w * 0.035f)
            )

            // 3. Isometric Data Facets
            val facetR = r * 0.82f

            // Top Facet (Diamond)
            val topFacet = Path().apply {
                moveTo(cx, cy)
                lineTo(cx + facetR * cos(-30f * PI.toFloat() / 180f), cy + facetR * sin(-30f * PI.toFloat() / 180f))
                lineTo(cx, cy - facetR)
                lineTo(cx + facetR * cos(-150f * PI.toFloat() / 180f), cy + facetR * sin(-150f * PI.toFloat() / 180f))
                close()
            }
            drawPath(
                path = topFacet,
                brush = Brush.verticalGradient(
                    listOf(SoftLavender.copy(alpha = 0.95f), ElectricViolet.copy(alpha = 0.85f))
                )
            )

            // Bottom-Right Facet
            val rightFacet = Path().apply {
                moveTo(cx, cy)
                lineTo(cx + facetR * cos(-30f * PI.toFloat() / 180f), cy + facetR * sin(-30f * PI.toFloat() / 180f))
                lineTo(cx + facetR * cos(30f * PI.toFloat() / 180f), cy + facetR * sin(30f * PI.toFloat() / 180f))
                lineTo(cx, cy + facetR)
                close()
            }
            drawPath(
                path = rightFacet,
                brush = Brush.linearGradient(
                    colors = listOf(ElectricViolet.copy(alpha = 0.9f), DeepViolet.copy(alpha = 0.85f)),
                    start = Offset(cx, cy),
                    end = Offset(cx + facetR, cy + facetR)
                )
            )

            // Bottom-Left Facet
            val leftFacet = Path().apply {
                moveTo(cx, cy)
                lineTo(cx, cy + facetR)
                lineTo(cx + facetR * cos(150f * PI.toFloat() / 180f), cy + facetR * sin(150f * PI.toFloat() / 180f))
                lineTo(cx + facetR * cos(-150f * PI.toFloat() / 180f), cy + facetR * sin(-150f * PI.toFloat() / 180f))
                close()
            }
            drawPath(
                path = leftFacet,
                brush = Brush.linearGradient(
                    colors = listOf(DeepViolet.copy(alpha = 0.85f), SoftLavender.copy(alpha = 0.75f)),
                    start = Offset(cx, cy + facetR),
                    end = Offset(cx - facetR, cy)
                )
            )

            // 4. Center Crystalline Core
            drawCircle(
                color = Color.White,
                radius = facetR * 0.22f,
                center = Offset(cx, cy)
            )
            drawCircle(
                color = SoftLavender,
                radius = facetR * 0.12f,
                center = Offset(cx, cy)
            )

            // 5. Exterior Matrix Vertex Nodes
            for (i in 0 until 6) {
                val angle = (i * 60f - 30f) * (PI.toFloat() / 180f)
                val vx = cx + facetR * cos(angle)
                val vy = cy + facetR * sin(angle)
                drawCircle(
                    color = if (i % 2 == 0) SoftLavender else ElectricViolet,
                    radius = facetR * 0.08f,
                    center = Offset(vx, vy)
                )
            }
        }
    }
}

/**
 * Top App Header for MECHON MOBILE
 */
@Composable
fun MechonMobileHeader(
    isPaired: Boolean,
    workstationName: String?,
    onPairingClick: () -> Unit,
    modifier: Modifier = Modifier,
    connectionState: ai.mechon.companion.data.remote.ConnectionState = if (isPaired) ai.mechon.companion.data.remote.ConnectionState.READY else ai.mechon.companion.data.remote.ConnectionState.DISCONNECTED,
    onDiagnosticsClick: (() -> Unit)? = null
) {
    val statusColor = when (connectionState) {
        ai.mechon.companion.data.remote.ConnectionState.READY -> StatusConnected
        ai.mechon.companion.data.remote.ConnectionState.CONNECTED,
        ai.mechon.companion.data.remote.ConnectionState.SYNCHRONIZING,
        ai.mechon.companion.data.remote.ConnectionState.DEGRADED -> StatusWarning
        ai.mechon.companion.data.remote.ConnectionState.ERROR -> StatusError
        else -> TextMuted
    }

    val statusText = when (connectionState) {
        ai.mechon.companion.data.remote.ConnectionState.READY -> workstationName?.take(14) ?: "Ready"
        ai.mechon.companion.data.remote.ConnectionState.CONNECTED -> "Connected"
        ai.mechon.companion.data.remote.ConnectionState.SYNCHRONIZING -> "Syncing"
        ai.mechon.companion.data.remote.ConnectionState.DEGRADED -> "Degraded"
        ai.mechon.companion.data.remote.ConnectionState.ERROR -> "Error"
        ai.mechon.companion.data.remote.ConnectionState.RECONNECTING -> "Reconnecting"
        else -> "Offline"
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 18.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left: MECHON MOBILE Branding
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            MechonLogoMark(
                size = 28.dp,
                animated = true
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "MECHON",
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.8.sp
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "MOBILE",
                    color = SoftLavender,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.4.sp
                )
            }
        }

        // Right: Desktop Connection Status Pill
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(ElevatedSurface)
                .border(1.dp, if (connectionState == ai.mechon.companion.data.remote.ConnectionState.READY) StatusConnected.copy(alpha = 0.35f) else GlassBorder, RoundedCornerShape(20.dp))
                .clickable {
                    if (onDiagnosticsClick != null) onDiagnosticsClick() else onPairingClick()
                }
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(statusColor)
            )

            Text(
                text = statusText,
                color = if (connectionState == ai.mechon.companion.data.remote.ConnectionState.READY) TextPrimary else TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )

            Icon(
                imageVector = if (connectionState == ai.mechon.companion.data.remote.ConnectionState.READY) Icons.Default.Lan else Icons.Default.CloudOff,
                contentDescription = "Desktop Pairing",
                tint = statusColor,
                modifier = Modifier.size(14.dp)
            )
        }
    }
}

/**
 * Atmospheric Mechon Welcome Banner (Shown when conversation is empty)
 */
@Composable
fun MechonAtmosphericWelcome(
    onPromptClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Atmospheric Core Mark with Ambient Radial Violet Glow
        Box(
            modifier = Modifier
                .size(110.dp)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            AmbientGlowViolet,
                            Color.Transparent
                        )
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            MechonLogoMark(
                size = 72.dp,
                animated = true
            )
        }

        Spacer(modifier = Modifier.height(18.dp))

        Text(
            text = "MECHON MOBILE",
            color = SoftLavender,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 3.sp
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = "What can I help you with?",
            color = TextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.5).sp
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Connected to Mechon Workstation. Ready for inference, roleplay & dataset curation.",
            color = TextSecondary,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            fontWeight = FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 16.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )

        Spacer(modifier = Modifier.height(28.dp))

        // Minimalist quick prompts with glass borders
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            listOf(
                "Write an immersive roleplay scenario...",
                "Explain fine-tuning alignment and DPO...",
                "Analyze code or debug a Rust service..."
            ).forEach { prompt ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(ElevatedSurface)
                        .border(1.dp, GlassBorder, RoundedCornerShape(16.dp))
                        .clickable { onPromptClick(prompt) }
                        .padding(horizontal = 16.dp, vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = prompt,
                        color = TextSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

enum class NavTab {
    CHAT,
    HISTORY,
    SETTINGS
}

/**
 * Floating Obsidian Bottom Navigation Bar
 */
@Composable
fun MechonFloatingBottomNav(
    currentTab: NavTab,
    onTabSelected: (NavTab) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 12.dp)
            .navigationBarsPadding(),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = Modifier
                .shadow(elevation = 16.dp, shape = RoundedCornerShape(28.dp), spotColor = ElectricViolet.copy(alpha = 0.25f))
                .clip(RoundedCornerShape(28.dp))
                .background(GlassSurface)
                .border(1.dp, GlassBorder, RoundedCornerShape(28.dp))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            NavTabItem(
                label = "Chat",
                selected = currentTab == NavTab.CHAT,
                onClick = { onTabSelected(NavTab.CHAT) }
            )
            NavTabItem(
                label = "History",
                selected = currentTab == NavTab.HISTORY,
                onClick = { onTabSelected(NavTab.HISTORY) }
            )
            NavTabItem(
                label = "Settings",
                selected = currentTab == NavTab.SETTINGS,
                onClick = { onTabSelected(NavTab.SETTINGS) }
            )
        }
    }
}

@Composable
private fun NavTabItem(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (selected) ElectricViolet.copy(alpha = 0.22f) else Color.Transparent
    val border = if (selected) ElectricViolet.copy(alpha = 0.5f) else Color.Transparent
    val textColor = if (selected) TextPrimary else TextMuted

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(20.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) { onClick() }
            .padding(horizontal = 20.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}
