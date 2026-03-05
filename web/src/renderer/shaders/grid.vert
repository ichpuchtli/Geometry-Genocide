attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_camera;

// Displacement forces (up to 16 active)
uniform int u_forceCount;
uniform vec3 u_forces[16]; // xy = world position, z = strength
uniform float u_forceRadii[16];

varying float v_distFromCenter;
varying float v_displacement; // how much this vertex was displaced (for glow)

void main() {
    vec2 worldPos = a_position;
    float totalDisplacement = 0.0;

    // Apply displacement forces
    for (int i = 0; i < 16; i++) {
        if (i >= u_forceCount) break;
        vec2 forcePos = u_forces[i].xy;
        float strength = u_forces[i].z;
        float radius = u_forceRadii[i];
        vec2 diff = worldPos - forcePos;
        float dist = length(diff);
        if (dist < radius && dist > 0.0) {
            float falloff = 1.0 - (dist / radius);
            falloff = falloff * falloff; // quadratic falloff
            vec2 offset = normalize(diff) * strength * falloff;
            worldPos += offset;
            totalDisplacement += abs(strength) * falloff;
        }
    }

    vec2 screen = (worldPos - u_camera) / (u_resolution * 0.5);
    gl_Position = vec4(screen.x, screen.y, 0.0, 1.0);

    // Pass distance from camera center for fading at edges
    vec2 relPos = (worldPos - u_camera) / u_resolution;
    v_distFromCenter = length(relPos);
    v_displacement = totalDisplacement;
}
