import * as THREE from 'three';

/** Outline width in drawing-buffer pixels, so the CSS width stays the same on any DPR. */
export function outlineThicknessPx(cssPx, dpr) {
  return cssPx * dpr;
}

const fullscreen = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

/**
 * Renders the scene with dark outlines where depth or surface direction jumps.
 * Objects on layer 1 only (fire, effects) are drawn but never outlined.
 */
export class OutlineRenderer {
  constructor(renderer, { color, thicknessCssPx = 1.5 }) {
    this.renderer = renderer;
    renderer.shadowMap.autoUpdate = false; // updated once per frame, in the colour pass
    this.thicknessCssPx = thicknessCssPx;
    const opts = { type: THREE.HalfFloatType, samples: 4 };
    this.colorTarget = new THREE.WebGLRenderTarget(1, 1, opts);
    this.colorTarget.depthTexture = new THREE.DepthTexture(1, 1);
    this.normalTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.normalTarget.depthTexture = new THREE.DepthTexture(1, 1);
    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null }, tColorDepth: { value: null },
        texel: { value: new THREE.Vector2() }, thickness: { value: 1.5 },
        outlineColor: { value: new THREE.Color(color) },
        cameraNear: { value: 0.1 }, cameraFar: { value: 500 }, fadeFar: { value: 120 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
        #include <packing>
        uniform sampler2D tColor, tNormal, tDepth, tColorDepth;
        uniform vec2 texel; uniform float thickness, cameraNear, cameraFar, fadeFar;
        uniform vec3 outlineColor;
        varying vec2 vUv;
        float viewZ(vec2 uv) {
          return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
        }
        void main() {
          vec4 col = texture2D(tColor, vUv);
          float z = viewZ(vUv);
          vec3 n = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
          float edge = 0.0;
          vec2 o[4]; o[0] = vec2(1, 0); o[1] = vec2(-1, 0); o[2] = vec2(0, 1); o[3] = vec2(0, -1);
          for (int i = 0; i < 4; i++) {
            vec2 uv = vUv + o[i] * texel * thickness;
            float dz = abs(viewZ(uv) - z) / max(z, 0.001);
            vec3 nn = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
            edge = max(edge, smoothstep(0.035, 0.08, dz));
            edge = max(edge, smoothstep(0.35, 0.6, 1.0 - dot(n, nn)));
          }
          edge *= 1.0 - smoothstep(fadeFar * 0.5, fadeFar, z);
          // something not outlined (water, fire) is in front: hide the edge behind it
          float front = -perspectiveDepthToViewZ(texture2D(tColorDepth, vUv).x, cameraNear, cameraFar);
          if (front < z - 0.05) edge = 0.0;
          gl_FragColor = vec4(mix(col.rgb, outlineColor, edge * 0.9), 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    }));
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
  }

  setSize(width, height, dpr) {
    const w = Math.floor(width * dpr), h = Math.floor(height * dpr);
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w, h);
    const u = this.quad.material.uniforms;
    u.texel.value.set(1 / w, 1 / h);
    u.thickness.value = outlineThicknessPx(this.thicknessCssPx, dpr);
  }

  render(scene, camera) {
    const r = this.renderer, u = this.quad.material.uniforms;
    // normals + depth, outlined layer only
    const layers = camera.layers.mask;
    camera.layers.set(0);
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    scene.overrideMaterial = this.normalMaterial;
    r.setRenderTarget(this.normalTarget);
    r.setClearColor(0x7f7fff, 1); r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = bg; scene.fog = fog;
    camera.layers.mask = layers;
    // colour
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.colorTarget);
    r.render(scene, camera);
    // composite to screen
    u.tColor.value = this.colorTarget.texture;
    u.tNormal.value = this.normalTarget.texture;
    u.tDepth.value = this.normalTarget.depthTexture;
    u.tColorDepth.value = this.colorTarget.depthTexture;
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
    r.setRenderTarget(null);
    r.render(this.quadScene, fullscreen);
  }
}
