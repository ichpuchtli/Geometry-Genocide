precision mediump float;
varying float v_distFromCenter;
uniform vec3 u_gridColor;

void main() {
    // Fade grid at edges of viewport
    float alpha = smoothstep(1.5, 0.3, v_distFromCenter) * 0.55;
    gl_FragColor = vec4(u_gridColor, alpha);
}
