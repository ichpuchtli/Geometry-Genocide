precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomIntensity;
uniform float u_shakeIntensity; // 0-1, drives chromatic aberration + warp
uniform float u_time;

void main() {
    vec2 uv = v_texCoord;

    // --- Vignette (darkens edges) ---
    vec2 vignetteUV = uv - 0.5;
    float vignette = 1.0 - dot(vignetteUV, vignetteUV) * 1.2;
    vignette = clamp(vignette, 0.0, 1.0);
    vignette = vignette * vignette;

    // --- Screen warp (barrel distortion driven by shake) ---
    vec2 centered = uv - 0.5;
    float dist = length(centered);
    float warpAmount = u_shakeIntensity * 0.03;
    vec2 warped = uv + centered * dist * dist * warpAmount;

    // --- Chromatic aberration (RGB channel split driven by shake) ---
    float aberration = u_shakeIntensity * 0.008 + 0.001;
    vec2 dir = normalize(centered + 0.001);
    float r = texture2D(u_scene, warped + dir * aberration).r;
    float g = texture2D(u_scene, warped).g;
    float b = texture2D(u_scene, warped - dir * aberration).b;
    vec3 scene = vec3(r, g, b);

    // --- Bloom ---
    vec3 bloom = texture2D(u_bloom, warped).rgb;

    // --- Combine ---
    vec3 color = scene + bloom * u_bloomIntensity;

    // --- Saturation boost ---
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, 1.25);

    // --- Scanline hint (very subtle) ---
    float scanline = 1.0 - 0.04 * sin(uv.y * 800.0 + u_time * 2.0);

    // --- Final output ---
    gl_FragColor = vec4(color * vignette * scanline, 1.0);
}
