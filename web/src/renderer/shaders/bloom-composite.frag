precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomIntensity;

void main() {
    vec3 scene = texture2D(u_scene, v_texCoord).rgb;
    vec3 bloom = texture2D(u_bloom, v_texCoord).rgb;
    gl_FragColor = vec4(scene + bloom * u_bloomIntensity, 1.0);
}
