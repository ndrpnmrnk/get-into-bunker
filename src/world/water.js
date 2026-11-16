import * as THREE from 'three';
import { palette } from '../style/palette.js';

/**
 * Stylised water: soft waves, lighter shallows and a foam band wherever terrain
 * meets the surface (read from the outline pass's depth texture). Lives on layer 1
 * so it never writes into that depth texture itself.
 */
export function createWater(outline, size = 400) {
  const geo = new THREE.PlaneGeometry(size, size, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      color: { value: new THREE.Color(palette.water) },
      foamColor: { value: new THREE.Color(palette.waterFoam) },
      tDepth: { value: null }, resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 0.1 }, cameraFar: { value: 500 }, time: { value: 0 },
    }]),
    vertexShader: /* glsl */`
      uniform float time;
      varying vec3 vWorld; varying float vViewZ;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        p.y += 0.06 * sin(p.x * 0.35 + time * 1.1) + 0.05 * sin(p.z * 0.42 - time * 0.9);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        vViewZ = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <packing>
      uniform vec3 color, foamColor; uniform sampler2D tDepth; uniform vec2 resolution;
      uniform float cameraNear, cameraFar, time;
      varying vec3 vWorld; varying float vViewZ;
      #include <fog_pars_fragment>
      void main() {
        float sceneZ = -perspectiveDepthToViewZ(texture2D(tDepth, gl_FragCoord.xy / resolution).x, cameraNear, cameraFar);
        float depth = sceneZ - vViewZ;
        float wobble = 0.1 * sin(vWorld.x * 1.3 + time * 1.7) * sin(vWorld.z * 1.1 - time * 1.3);
        float foam = 1.0 - step(0.16 + wobble * 0.5, depth);
        vec3 shallow = mix(color, foamColor, 0.35);
        vec3 c = mix(shallow, color, smoothstep(0.2, 1.6, depth));
        gl_FragColor = vec4(mix(c, foamColor, foam), 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(geo, mat);
  water.name = 'Water';
  water.layers.set(1);
  water.receiveShadow = false;
  water.onBeforeRender = (renderer, scene, camera) => {
    const u = mat.uniforms;
    u.tDepth.value = outline.normalTarget.depthTexture;
    u.resolution.value.set(outline.normalTarget.width, outline.normalTarget.height);
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
  };
  water.update = (t) => { mat.uniforms.time.value = t; };
  return water;
}
