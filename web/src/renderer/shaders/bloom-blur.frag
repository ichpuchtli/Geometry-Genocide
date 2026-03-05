precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_direction; // (1/w, 0) for horizontal, (0, 1/h) for vertical
uniform float u_radius;

void main() {
    vec4 sum = vec4(0.0);
    // 9-tap Gaussian blur
    float weights[5];
    weights[0] = 0.227027;
    weights[1] = 0.1945946;
    weights[2] = 0.1216216;
    weights[3] = 0.054054;
    weights[4] = 0.016216;

    sum += texture2D(u_texture, v_texCoord) * weights[0];
    for (int i = 1; i < 5; i++) {
        vec2 offset = u_direction * float(i) * u_radius;
        sum += texture2D(u_texture, v_texCoord + offset) * weights[i];
        sum += texture2D(u_texture, v_texCoord - offset) * weights[i];
    }
    gl_FragColor = sum;
}
