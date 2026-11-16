import * as THREE from 'three';
import { palette } from '../style/palette.js';

/** Animated toon flames + a flickering warm light at the FirePoint. Not outlined (layer 1). */
export function createCampfire(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, outer: { value: new THREE.Color(palette.fire) }, core: { value: new THREE.Color(palette.fireCore) } },
    vertexShader: /* glsl */`
      uniform float time; attribute float seed; varying float vH;
      void main() {
        vec3 p = position;
        vH = clamp(p.y / 0.8 + 0.5, 0.0, 1.0);
        p.x += sin(time * 6.0 + p.y * 4.0) * 0.06 * vH;
        p.z += cos(time * 5.0 + p.y * 3.0) * 0.06 * vH;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 outer, core; varying float vH;
      void main() {
        gl_FragColor = vec4(mix(core, outer, smoothstep(0.15, 0.55, vH)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const flames = [];
  [[0, 0, 0.24, 0.8], [0.13, 0.07, 0.17, 0.6], [-0.11, -0.08, 0.15, 0.55], [0.02, -0.14, 0.14, 0.45]].forEach(([x, z, r, h]) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16, 6), mat);
    f.position.set(x, h / 2 - 0.25, z);
    f.layers.set(1);
    f.userData.h = h;
    flames.push(f); group.add(f);
  });
  const light = new THREE.PointLight(new THREE.Color(palette.fire), 7, 10, 2);
  light.position.y = 0.4;
  group.add(light);
  group.update = (t) => {
    mat.uniforms.time.value = t;
    flames.forEach((f, i) => { f.scale.y = 1 + 0.15 * Math.sin(t * (7 + i) + i * 2); });
    light.intensity = 6.5 + 1.8 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1);
  };
  return group;
}
