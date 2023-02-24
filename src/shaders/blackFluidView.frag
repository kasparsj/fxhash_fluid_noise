// Based on https://www.shadertoy.com/view/XlsBDf by davidar

precision highp float;

#define TWO_PI 6.28

uniform sampler2D tMap;
uniform vec2 uResolution;
uniform vec4 uColor;

void main() {
    vec4 c = texture2D(tMap, gl_FragCoord.xy / uResolution.xy);

    // Velocity
//      gl_FragColor.rgb = 0.6 + 0.6 * cos(6.3 * atan(c.y, c.x) / TWO_PI + uColor.rgb);
    gl_FragColor.rgb = vec3(0.6 + 0.6 * cos(6.3 * atan(c.y, c.x) / TWO_PI));
//    gl_FragColor.rgb = vec3(c.rgb);

    // Ink
    gl_FragColor.rgb *= c.w / 5.0;

    // Local fluid density
    gl_FragColor.rgb += clamp(c.z - 1.0, 0.0, 1.0) / 8.0;
    gl_FragColor.rgb = 1.0 - gl_FragColor.rgb / 1.2;
    gl_FragColor.a = c.w / uColor.w;
}
