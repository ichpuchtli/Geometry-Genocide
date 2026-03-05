precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_threshold;

void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > u_threshold) {
        gl_FragColor = color;
    } else {
        gl_FragColor = vec4(0.0);
    }
}
