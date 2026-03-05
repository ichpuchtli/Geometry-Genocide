attribute vec2 a_position;
attribute vec4 a_color;
uniform vec2 u_resolution;
uniform vec2 u_camera;
varying vec4 v_color;

void main() {
    // Convert world position to clip space, applying camera offset
    vec2 screen = (a_position - u_camera) / (u_resolution * 0.5);
    // Flip Y so +Y is up in world space
    gl_Position = vec4(screen.x, screen.y, 0.0, 1.0);
    v_color = a_color;
}
