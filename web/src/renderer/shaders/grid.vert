attribute vec2 a_position;
attribute float a_displacement;
attribute float a_velocity;
attribute float a_anchored;

uniform vec2 u_resolution;
uniform vec2 u_camera;

// Gravity well uniforms for spacetime fabric effect
uniform int u_wellCount;
uniform vec2 u_wellPositions[8];
uniform float u_wellStrengths[8];
uniform float u_wellRadii[8];
uniform float u_perspectiveDepth;

varying float v_displacement;
varying float v_velocity;
varying float v_wellDepth;

void main() {
    vec2 pos = a_position;
    vec2 totalContract = vec2(0.0);
    float depth = 0.0;

    // Apply perspective contraction toward gravity wells
    // All wells compute from the ORIGINAL position to prevent cascading drift
    // Skip entirely for anchored (perimeter) vertices to prevent edge detachment
    float movable = 1.0 - a_anchored;
    for (int i = 0; i < 8; i++) {
        if (i >= u_wellCount) break;
        vec2 toWell = u_wellPositions[i] - a_position;
        float dist = length(toWell);
        float radius = u_wellRadii[i];
        if (dist < radius && dist > 1.0) {
            float falloff = 1.0 - dist / radius;
            float ff2 = falloff * falloff; // squared for smooth funnel
            float normStr = abs(u_wellStrengths[i]) / 400.0;
            float d = ff2 * normStr;
            // Contract: pull vertex toward well center
            float contractAmount = d * u_perspectiveDepth * 0.15 * radius;
            // Clamp to 80% of distance to prevent self-intersection artifacts
            contractAmount = min(contractAmount, dist * 0.8);
            totalContract += normalize(toWell) * contractAmount;
            depth += d;
        }
    }
    pos += totalContract * movable;
    depth = clamp(depth, 0.0, 1.0);

    vec2 screen = (pos - u_camera) / (u_resolution * 0.5);
    gl_Position = vec4(screen, 0.0, 1.0);
    v_displacement = a_displacement;
    v_velocity = a_velocity;
    v_wellDepth = depth;
}
