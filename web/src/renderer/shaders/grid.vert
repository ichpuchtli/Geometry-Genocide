attribute vec2 a_position;
attribute float a_displacement;
attribute float a_velocity;

uniform vec2 u_resolution;
uniform vec2 u_camera;

varying float v_displacement;
varying float v_velocity;

void main() {
    vec2 screen = (a_position - u_camera) / (u_resolution * 0.5);
    gl_Position = vec4(screen, 0.0, 1.0);
    v_displacement = a_displacement;
    v_velocity = a_velocity;
}
