import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { palette } from './style/palette.js';
import { applyToonMaterials } from './render/toon.js';
import { OutlineRenderer } from './render/outline.js';
import { createWater } from './world/water.js';
import { createCampfire } from './world/campfire.js';
import { createPanel } from './ui/panel.js';
import { t } from './i18n/index.js';
import { setupCharacters } from './character/probeSetup.js';
import { setupVoice } from './voice/probeSetup.js';

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.sky);
scene.fog = new THREE.Fog(new THREE.Color(palette.fog), 35, 120);

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);
camera.layers.enable(1);
const outline = new OutlineRenderer(renderer, { color: palette.outline, thicknessCssPx: 1.5 });

scene.add(new THREE.HemisphereLight(new THREE.Color(palette.sky), new THREE.Color(palette.grassDark), 1.6));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const probe = { scene, camera, renderer, controls, world: {}, updaters: [], views: {}, panel: createPanel() };
window.__probe = probe;

const VIEWS = {
  overview: { pos: [17, 13, 19], target: [0, 4, 0] },
  closeup: { pos: [0, 5.5, 3.4], target: [0, 4.75, -2.4] },
};
probe.views.overview = () => setOrbitView('overview');
probe.views.closeup = () => setOrbitView('closeup');
function setOrbitView(name) {
  const v = VIEWS[name];
  controls.enabled = true;
  camera.position.set(...v.pos);
  controls.target.set(...v.target);
  controls.update();
  probe.view = name;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  outline.setSize(w, h, dpr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

async function init() {
  probe.panel.status(t('probe.loading'));
  const loader = new GLTFLoader();
  const island = (await loader.loadAsync('./models/island.glb')).scene;
  applyToonMaterials(island);
  island.getObjectByName('WalkBlockers').visible = false;
  // tiny tufts read as dark specks under an outline
  island.getObjectByName('Grass').traverse((o) => o.layers.set(1));
  scene.add(island);
  probe.world.island = island;

  const water = createWater(outline);
  scene.add(water);
  const firePos = island.getObjectByName('FirePoint').getWorldPosition(new THREE.Vector3());
  const fire = createCampfire(firePos);
  scene.add(fire);
  probe.updaters.push((time) => { water.update(time); fire.update(time); });

  probe.panel.button('probe.viewOverview', () => probe.views.overview());
  probe.panel.button('probe.viewCloseup', () => probe.views.closeup());

  await setupCharacters(probe, loader);
  setupVoice(probe);

  const view = new URLSearchParams(location.search).get('view') ?? 'overview';
  (probe.views[view] ?? probe.views.overview)();
  probe.panel.status('');
  window.__probeReady = true;
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  for (const u of probe.updaters) u(time, dt);
  if (controls.enabled) controls.update();
  outline.render(scene, camera);
});

init();
