precision mediump float;
varying float v_distFromCenter;
varying float v_displacement;
uniform vec3 u_gridColor;

void main() {
    // Fade grid at edges of viewport
    float alpha = smoothstep(1.5, 0.3, v_distFromCenter) * 0.75;

    // Glow near displacement forces — grid lines brighten where warped
    float glow = clamp(v_displacement / 30.0, 0.0, 1.0);
    vec3 color = mix(u_gridColor, vec3(0.75, 0.4, 1.0), glow * 0.8);
    // Also brighten alpha near forces
    alpha += glow * 0.5;
    alpha = min(alpha, 1.0);

    gl_FragColor = vec4(color, alpha);
}
