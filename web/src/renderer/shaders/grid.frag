precision mediump float;
varying float v_displacement;
varying float v_velocity;

uniform vec3 u_colorBase;
uniform vec3 u_colorStretch;
uniform vec3 u_colorCompress;

void main() {
    float alpha = 0.75;

    // Color shift based on displacement
    float t = clamp(v_displacement / 40.0, 0.0, 1.0);
    vec3 color = mix(u_colorBase, u_colorStretch, t);

    // Velocity-based glow (shimmering on rebounds)
    float vGlow = clamp(v_velocity / 200.0, 0.0, 1.0);
    color += vec3(vGlow * 0.3);
    alpha += vGlow * 0.4;
    alpha = min(alpha, 1.0);

    gl_FragColor = vec4(color, alpha);
}
