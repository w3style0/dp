import "./style.css";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

const modelModules = import.meta.glob("../model/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
});
const soundModules = import.meta.glob("../sound/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});
const mapModelEntry = Object.entries(modelModules).find(([path]) =>
  path.toLowerCase().includes("/map.glb"),
);
const walkSoundEntry =
  Object.entries(soundModules).find(([path]) => path.toLowerCase().includes("walk")) ??
  Object.entries(soundModules)[0] ??
  null;
const gunSoundEntry =
  Object.entries(soundModules).find(([path]) => path.toLowerCase().includes("gun")) ?? null;
const STARTER_CHAMPION_TOKENS = [
  "chibi_jinx",
  "chibi_iblitzcrank",
  "chibi_battle_academia_katarina",
];
const MAP_SCALE_DISPLAY_BASE = 100;

const MAP_CONFIG = {
  position: { x: 0, y: -18, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  groundY: 0,
};
const SPAWN_CONFIG = {
  offset: { x: 0, z: 0 },
};
const CAMERA_CONFIG = {
  minDistance: 0.12,
  maxDistance: 16,
  defaultDistance: 9.5,
  followLerp: 7,
};

const DEBUG_VIEW = true;

const app = document.querySelector("#app");
const canvas = document.createElement("canvas");
app.append(canvas);

const goldHud = document.createElement("div");
goldHud.className = "gold-hud";
goldHud.innerHTML = `
  <span class="gold-hud__label">Gold</span>
  <strong class="gold-hud__value">0</strong>
`;
app.append(goldHud);

const timeHud = document.createElement("div");
timeHud.className = "time-hud";
timeHud.innerHTML = `
  <span class="time-hud__label">Time</span>
  <strong class="time-hud__value">06:00</strong>
`;
app.append(timeHud);

const skillHud = document.createElement("div");
skillHud.className = "skill-hud";
skillHud.innerHTML = `
  <div class="skill-slot" data-slot="q">
    <span class="skill-slot__key">Q</span>
    <span class="skill-slot__icon">Q</span>
    <span class="skill-slot__name">Skill</span>
    <span class="skill-slot__cooldown"></span>
  </div>
  <div class="skill-slot" data-slot="w">
    <span class="skill-slot__key">W</span>
    <span class="skill-slot__icon">W</span>
    <span class="skill-slot__name">Skill</span>
    <span class="skill-slot__cooldown"></span>
  </div>
  <div class="skill-slot" data-slot="e">
    <span class="skill-slot__key">E</span>
    <span class="skill-slot__icon">E</span>
    <span class="skill-slot__name">Skill</span>
    <span class="skill-slot__cooldown"></span>
  </div>
  <div class="skill-slot skill-slot--ultimate" data-slot="r">
    <span class="skill-slot__key">R</span>
    <span class="skill-slot__icon">R</span>
    <span class="skill-slot__name">Ultimate</span>
    <span class="skill-slot__cooldown"></span>
  </div>
`;
app.append(skillHud);

const mobileHud = document.createElement("div");
mobileHud.className = "mobile-hud";
mobileHud.innerHTML = `
  <div class="mobile-joystick" id="mobile-joystick">
    <div class="mobile-joystick__ring">
      <div class="mobile-joystick__thumb"></div>
    </div>
  </div>
  <div class="mobile-actions">
    <button class="mobile-button mobile-button--attack" data-mobile-action="attack" type="button">ATK</button>
    <button class="mobile-button mobile-button--jump" data-mobile-action="jump" type="button">JUMP</button>
    <button class="mobile-button mobile-button--run" data-mobile-action="run" type="button">RUN</button>
  </div>
`;
app.append(mobileHud);

const mapEditor = document.createElement("div");
mapEditor.className = "map-editor";
mapEditor.innerHTML = `
  <h2>Map Adjust</h2>
  <label class="map-editor__row">
    <span>X</span>
    <input id="map-pos-x" type="range" min="-2000" max="2000" step="1" value="${MAP_CONFIG.position.x}">
    <strong id="map-pos-x-value">${MAP_CONFIG.position.x}</strong>
  </label>
  <label class="map-editor__row">
    <span>Y</span>
    <input id="map-pos-y" type="range" min="-2000" max="2000" step="1" value="${MAP_CONFIG.position.y}">
    <strong id="map-pos-y-value">${MAP_CONFIG.position.y}</strong>
  </label>
  <label class="map-editor__row">
    <span>Z</span>
    <input id="map-pos-z" type="range" min="-2000" max="2000" step="1" value="${MAP_CONFIG.position.z}">
    <strong id="map-pos-z-value">${MAP_CONFIG.position.z}</strong>
  </label>
  <label class="map-editor__row">
    <span>Scale</span>
    <input id="map-scale" type="range" min="-99" max="100" step="1" value="${MAP_CONFIG.scale - MAP_SCALE_DISPLAY_BASE}">
    <strong id="map-scale-value">${MAP_CONFIG.scale - MAP_SCALE_DISPLAY_BASE}</strong>
  </label>
  <label class="map-editor__row">
    <span>SX</span>
    <input id="spawn-offset-x" type="range" min="-200" max="200" step="1" value="${SPAWN_CONFIG.offset.x}">
    <strong id="spawn-offset-x-value">${SPAWN_CONFIG.offset.x}</strong>
  </label>
  <label class="map-editor__row">
    <span>SZ</span>
    <input id="spawn-offset-z" type="range" min="-200" max="200" step="1" value="${SPAWN_CONFIG.offset.z}">
    <strong id="spawn-offset-z-value">${SPAWN_CONFIG.offset.z}</strong>
  </label>
`;
app.append(mapEditor);
mapEditor.style.display = "none";

const teamBanner = document.createElement("div");
teamBanner.className = "team-banner";
teamBanner.innerHTML = `
  <div class="team-card blue">
    <span class="team-label">Blue Team</span>
  </div>
  <div class="team-card red">
    <span class="team-label">Red Team</span>
  </div>
`;
app.append(teamBanner);

const healthLayer = document.createElement("div");
healthLayer.className = "health-layer";
app.append(healthLayer);

const combatControls = document.createElement("div");
combatControls.className = "combat-controls";
combatControls.innerHTML = `
  <button class="fight-button" type="button">FIGHT</button>
`;
app.append(combatControls);

const fightButton = combatControls.querySelector(".fight-button");

const resultOverlay = document.createElement("div");
resultOverlay.className = "result-overlay";
app.append(resultOverlay);

const transitionOverlay = document.createElement("div");
transitionOverlay.className = "transition-overlay";
transitionOverlay.innerHTML = `<div class="transition-card">Preparing next round...</div>`;
app.append(transitionOverlay);

const characterSelectOverlay = document.createElement("div");
characterSelectOverlay.className = "character-select";
characterSelectOverlay.innerHTML = `
  <div class="character-select__backdrop"></div>
  <div class="character-select__panel">
    <div class="character-select__eyebrow">Champion Select</div>
    <h2>Choose Your Little Legend</h2>
    <p>Pick a champion card to begin your adventure.</p>
    <div class="character-select__cards"></div>
  </div>
`;
app.append(characterSelectOverlay);
teamBanner.style.display = "none";
combatControls.style.display = "none";
resultOverlay.style.display = "none";
transitionOverlay.style.display = "none";

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#90b8d8");

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.03,
  1000000,
);
camera.position.set(14, 15, 14);

const cameraTarget = new THREE.Vector3();
const arenaCenter = new THREE.Vector3(0, 1.5, 0);
const cameraOffset = new THREE.Vector3(22, 24, 22);
const moveDirection = new THREE.Vector3();
const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();
const tempWorldPosition = new THREE.Vector3();
const tempDirection = new THREE.Vector3();
const tempHitPoint = new THREE.Vector3();
const tempMapOrigin = new THREE.Vector3();
const tempSurfaceNormal = new THREE.Vector3();
const tempNextPosition = new THREE.Vector3();
const tempRespawnPoint = new THREE.Vector3();
const tempProjectedPoint = new THREE.Vector3();
const downwardRay = new THREE.Vector3(0, -1, 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const mapGround = {
  y: 0.18,
};
const spawnOrigin = new THREE.Vector3();
const playerAnchor = new THREE.Vector3();
const desiredCameraTarget = new THREE.Vector3();
const cameraDelta = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const explorationSlots = [
  { x: 0, z: 0, rotation: 0 },
];
const minionExplorationSlots = [
  { x: 10, z: -6, rotation: -2.3 },
  { x: -12, z: 4, rotation: 0.9 },
  { x: 16, z: 8, rotation: -2.7 },
  { x: -8, z: -12, rotation: 0.35 },
  { x: 4, z: 16, rotation: Math.PI },
  { x: -15, z: -6, rotation: 0.55 },
  { x: 14, z: -15, rotation: -1.9 },
  { x: -18, z: 12, rotation: 1.2 },
];

const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.copy(arenaCenter);
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.mouseButtons.RIGHT = null;
controls.minDistance = CAMERA_CONFIG.minDistance;
controls.maxDistance = CAMERA_CONFIG.maxDistance;
controls.minPolarAngle = Math.PI / 3.2;
controls.maxPolarAngle = Math.PI / 2.02;
controls.update();

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode("translate");
transformControls.setSize(1.35);
transformControls.visible = false;
scene.add(transformControls);

const clock = new THREE.Clock();
const loader = new GLTFLoader();
const mixers = [];
const keys = new Set();

const actors = [];
const blueTeam = [];
const redTeam = [];
const scheduledStrikes = [];
const projectiles = [];
const impactEffects = [];
const damagePopups = [];
const goldPopups = [];
const previewRenderers = [];
const moveClickEffects = [];
const playerSkillEffects = [];
const minionRespawnQueue = [];
const DAY_DURATION_SECONDS = 180;
const GAME_DAY_START = 15;

const player = {
  actor: null,
  modelName: "",
  moveTarget: null,
  jumpRequested: false,
  combatTarget: null,
  gold: 0,
  abilityCooldowns: { q: 0, w: 0, e: 0, r: 0 },
  jinxRocketMode: false,
  blitzOverdriveTimer: 0,
  blitzPowerFistReady: false,
  katarinaUltimateTimer: 0,
  katarinaUltimateTick: 0,
};
const walkAudio = walkSoundEntry ? new Audio(walkSoundEntry[1]) : null;
if (walkAudio) {
  walkAudio.loop = true;
  walkAudio.volume = 0.55;
}
const gunAudioUrl = gunSoundEntry?.[1] ?? null;
const PLAYER_GRAVITY = 28;
const PLAYER_JUMP_SPEED = 10.5;
const PLAYER_RUN_MULTIPLIER = 1.75;
const PLAYER_MAX_STEP_UP = 0.58;
const PLAYER_MAX_STEP_DOWN = 1.85;
const PLAYER_MAX_WALKABLE_SLOPE = 0.62;

const mapEditorInputs = {
  x: mapEditor.querySelector("#map-pos-x"),
  y: mapEditor.querySelector("#map-pos-y"),
  z: mapEditor.querySelector("#map-pos-z"),
  scale: mapEditor.querySelector("#map-scale"),
  spawnX: mapEditor.querySelector("#spawn-offset-x"),
  spawnZ: mapEditor.querySelector("#spawn-offset-z"),
};

const mapEditorValues = {
  x: mapEditor.querySelector("#map-pos-x-value"),
  y: mapEditor.querySelector("#map-pos-y-value"),
  z: mapEditor.querySelector("#map-pos-z-value"),
  scale: mapEditor.querySelector("#map-scale-value"),
  spawnX: mapEditor.querySelector("#spawn-offset-x-value"),
  spawnZ: mapEditor.querySelector("#spawn-offset-z-value"),
};
const goldValue = goldHud.querySelector(".gold-hud__value");
const timeValue = timeHud.querySelector(".time-hud__value");
const skillSlots = Object.fromEntries(
  Array.from(skillHud.querySelectorAll(".skill-slot")).map((element) => [
    element.dataset.slot,
    {
      root: element,
      icon: element.querySelector(".skill-slot__icon"),
      name: element.querySelector(".skill-slot__name"),
      cooldown: element.querySelector(".skill-slot__cooldown"),
    },
  ]),
);
const mobileUi = {
  root: mobileHud,
  joystick: mobileHud.querySelector("#mobile-joystick"),
  joystickRing: mobileHud.querySelector(".mobile-joystick__ring"),
  joystickThumb: mobileHud.querySelector(".mobile-joystick__thumb"),
  actions: Object.fromEntries(
    Array.from(mobileHud.querySelectorAll("[data-mobile-action]")).map((element) => [
      element.dataset.mobileAction,
      element,
    ]),
  ),
};

const battleStatus = { textContent: "" };

const game = {
  phase: "idle",
  winner: null,
  resultTimer: 0,
  transitionTimer: 0,
};

const skyState = {
  root: null,
  clouds: [],
  stars: null,
  sun: null,
  moon: null,
  ambientLight: null,
  sunLight: null,
};

function isMobileLayout() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900;
}

const mobileInput = {
  enabled: isMobileLayout(),
  joystickPointerId: null,
  joystickVector: new THREE.Vector2(),
  sprint: false,
  attackHeld: false,
};

let activeMapRoot = null;
let selectedPlayerPath = null;

init();

fightButton.addEventListener("click", () => {
  if (game.phase !== "idle") return;
  startBattle();
});

transformControls.addEventListener("dragging-changed", (event) => {
  controls.enabled = !event.value;
});

transformControls.addEventListener("objectChange", () => {
  syncMapConfigFromObject();
});

mapEditorInputs.x.addEventListener("input", () => {
  MAP_CONFIG.position.x = Number(mapEditorInputs.x.value);
  applyMapPlacement();
  syncMapEditorUI();
});

mapEditorInputs.y.addEventListener("input", () => {
  MAP_CONFIG.position.y = Number(mapEditorInputs.y.value);
  applyMapPlacement();
  syncMapEditorUI();
});

mapEditorInputs.z.addEventListener("input", () => {
  MAP_CONFIG.position.z = Number(mapEditorInputs.z.value);
  applyMapPlacement();
  syncMapEditorUI();
});

mapEditorInputs.scale.addEventListener("input", () => {
  MAP_CONFIG.scale = MAP_SCALE_DISPLAY_BASE + Number(mapEditorInputs.scale.value);
  applyMapPlacement();
  syncMapEditorUI();
});

mapEditorInputs.spawnX.addEventListener("input", () => {
  SPAWN_CONFIG.offset.x = Number(mapEditorInputs.spawnX.value);
  applyMapPlacement();
  syncMapEditorUI();
});

mapEditorInputs.spawnZ.addEventListener("input", () => {
  SPAWN_CONFIG.offset.z = Number(mapEditorInputs.spawnZ.value);
  applyMapPlacement();
  syncMapEditorUI();
});

window.addEventListener("resize", onResize);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    player.jumpRequested = true;
  }
  if (!event.repeat && ["KeyQ", "KeyW", "KeyE", "KeyR"].includes(event.code)) {
    castPlayerAbility(event.code.at(-1).toLowerCase());
  }
  if (event.code === "KeyT") {
    transformControls.setMode("translate");
  }
  if (event.code === "KeyR") {
    transformControls.setMode("rotate");
  }
  if (event.code === "KeyY" || event.code === "KeyS") {
    transformControls.setMode("scale");
  }
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

setupMobileControls();

async function init() {
  await setupWorld();
  syncMapEditorUI();
  tick();
  await setupCharacterSelection();
  await populateActors();
  setGamePhase("idle");
  snapCameraToPlayer();
}

async function setupWorld() {
  const hemiLight = new THREE.HemisphereLight("#fffaf1", "#6b7f99", 1.9);
  scene.add(hemiLight);
  skyState.ambientLight = hemiLight;

  const sunLight = new THREE.DirectionalLight("#fff8e1", 3.2);
  sunLight.position.set(9, 18, 6);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 50;
  sunLight.shadow.camera.left = -32;
  sunLight.shadow.camera.right = 32;
  sunLight.shadow.camera.top = 32;
  sunLight.shadow.camera.bottom = -32;
  scene.add(sunLight);
  skyState.sunLight = sunLight;

  setupSkySystem();

  if (DEBUG_VIEW) {
    addDebugHelpers();
  }

  if (!mapModelEntry) {
    return;
  }

  const [, mapUrl] = mapModelEntry;
  const gltf = await loader.loadAsync(mapUrl);
  const mapRoot = gltf.scene;
  activeMapRoot = mapRoot;

  mapRoot.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.envMapIntensity = 1.1;
      }
    }
  });

  applyMapPlacement();
  scene.add(mapRoot);
  frameMapInView(mapRoot);
}

function addDebugHelpers() {
  const axes = new THREE.AxesHelper(12);
  axes.position.set(0, 0.05, 0);
  scene.add(axes);

  const grid = new THREE.GridHelper(40, 20, "#ff6b6b", "#5da9ff");
  grid.position.y = 0.02;
  scene.add(grid);

  const originMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: "#ffe066" }),
  );
  originMarker.position.set(0, 0.5, 0);
  scene.add(originMarker);
}

function setupSkySystem() {
  const skyRoot = new THREE.Group();
  scene.add(skyRoot);
  skyState.root = skyRoot;

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: "#ffd46d", transparent: true, opacity: 1 }),
  );
  skyRoot.add(sun);
  skyState.sun = sun;

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: "#dfe8ff", transparent: true, opacity: 1 }),
  );
  skyRoot.add(moon);
  skyState.moon = moon;

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let index = 0; index < 260; index += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42 + Math.PI * 0.06;
    const radius = 260 + Math.random() * 50;
    starPositions.push(
      Math.cos(theta) * Math.sin(phi) * radius,
      Math.cos(phi) * radius,
      Math.sin(theta) * Math.sin(phi) * radius,
    );
  }
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: "#f7fbff",
      size: 2.6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  skyRoot.add(stars);
  skyState.stars = stars;

  for (let index = 0; index < 16; index += 1) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
    cloud.position.set(
      (Math.random() - 0.5) * 180,
      70 + Math.random() * 30,
      (Math.random() - 0.5) * 180,
    );
    const scale = 26 + Math.random() * 26;
    cloud.scale.set(scale * 1.6, scale, 1);
    cloud.userData = {
      baseX: cloud.position.x,
      baseY: cloud.position.y,
      baseZ: cloud.position.z,
      driftSpeed: 0.6 + Math.random() * 0.8,
      driftOffset: Math.random() * Math.PI * 2,
    };
    skyRoot.add(cloud);
    skyState.clouds.push(cloud);
  }
}

function updateSkySystem(elapsed) {
  if (!skyState.root) return;

  const cycle = (elapsed / DAY_DURATION_SECONDS) % 1;
  const gameHour = (GAME_DAY_START + cycle * 24) % 24;
  const hours = Math.floor(gameHour);
  const minutes = Math.floor((gameHour - hours) * 60);
  timeValue.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  const anchorX = player.actor?.root.position.x ?? camera.position.x;
  const anchorZ = player.actor?.root.position.z ?? camera.position.z;
  skyState.root.position.set(anchorX, 0, anchorZ);

  const orbitAngle = cycle * Math.PI * 2 - Math.PI / 2;
  const orbitRadius = 185;
  const verticalRadius = 120;
  const celestialX = Math.cos(orbitAngle) * orbitRadius;
  const celestialY = Math.sin(orbitAngle) * verticalRadius + 86;
  const celestialZ = -72;

  skyState.sun.position.set(celestialX, celestialY, celestialZ);
  skyState.moon.position.set(-celestialX, -celestialY + 172, 48);

  const daylight = THREE.MathUtils.clamp((Math.sin(orbitAngle) + 0.2) / 1.2, 0, 1);
  const night = 1 - daylight;

  scene.background.lerpColors(
    new THREE.Color("#0f1730"),
    new THREE.Color("#90b8d8"),
    daylight,
  );
  renderer.toneMappingExposure = THREE.MathUtils.lerp(0.68, 1.18, daylight);

  if (skyState.ambientLight) {
    skyState.ambientLight.intensity = THREE.MathUtils.lerp(0.45, 1.9, daylight);
    skyState.ambientLight.color.set(daylight > 0.12 ? "#fff7e8" : "#aab7ff");
    skyState.ambientLight.groundColor.set(daylight > 0.18 ? "#6b7f99" : "#1e2748");
  }

  if (skyState.sunLight) {
    skyState.sunLight.intensity = THREE.MathUtils.lerp(0.18, 3.25, daylight);
    skyState.sunLight.color.set(daylight > 0.5 ? "#fff6dd" : "#ffb985");
    skyState.sunLight.position.set(celestialX * 0.38, Math.max(8, celestialY * 0.42), 18);
  }

  skyState.sun.material.opacity = 0.45 + daylight * 0.55;
  skyState.moon.material.opacity = 0.2 + night * 0.8;
  skyState.stars.material.opacity = THREE.MathUtils.smoothstep(night, 0.22, 0.92) * 0.95;

  skyState.clouds.forEach((cloud, index) => {
    const drift = elapsed * cloud.userData.driftSpeed + cloud.userData.driftOffset;
    cloud.position.x = cloud.userData.baseX + Math.sin(drift * 0.13 + index) * 14;
    cloud.position.z = cloud.userData.baseZ + Math.cos(drift * 0.1 + index * 0.3) * 9;
    cloud.position.y = cloud.userData.baseY + Math.sin(drift * 0.19) * 2.6;
    cloud.material.opacity = THREE.MathUtils.lerp(0.22, 0.62, daylight);
    cloud.material.color.set(daylight > 0.2 ? "#ffffff" : "#c6d2ff");
  });
}

async function populateActors() {
  const entries = Object.entries(modelModules)
    .filter(([path]) => isCharacterModel(path))
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    addPlaceholderActors();
    return;
  }

  const roster = buildRoster(entries);
  player.modelName = roster.blueChampions[0]?.displayName ?? "Player";
  updateSkillHud();

  const uniquePaths = new Map(roster.all.map((entry) => [entry.path, entry]));
  const definitions = new Map();

  await Promise.all(
    Array.from(uniquePaths.values()).map(async (entry) => {
      definitions.set(
        entry.path,
        await loadModelDefinition(entry.url, {
          scaleToHeight: entry.kind === "minion" ? 2.15 : 2.6,
        }),
      );
    }),
  );

  roster.blueMinions.forEach((entry, index) => {
    const actor = instantiateActor(definitions.get(entry.path), {
      name: `Blue Minion ${index + 1}`,
      team: "blue",
      kind: "minion",
      isPlayer: false,
      sourceName: entry.displayName,
    });
    blueTeam.push(actor);
    actors.push(actor);
  });

  roster.redMinions.forEach((entry, index) => {
    const actor = instantiateActor(definitions.get(entry.path), {
      name: `Red Minion ${index + 1}`,
      team: "red",
      kind: "minion",
      isPlayer: false,
      sourceName: entry.displayName,
    });
    redTeam.push(actor);
    actors.push(actor);
  });

  roster.blueChampions.forEach((entry, index) => {
    const actor = instantiateActor(definitions.get(entry.path), {
      name: entry.displayName,
      team: "blue",
      kind: "champion",
      isPlayer: index === 0,
      sourceName: entry.displayName,
    });
    if (index === 0) {
      player.actor = actor;
    }
    blueTeam.push(actor);
    actors.push(actor);
  });

  roster.redChampions.forEach((entry) => {
    const actor = instantiateActor(definitions.get(entry.path), {
      name: entry.displayName,
      team: "red",
      kind: "champion",
      isPlayer: false,
      sourceName: entry.displayName,
    });
    redTeam.push(actor);
    actors.push(actor);
  });

  layoutExplorationCast(actors);
  resetRound();
}

async function setupCharacterSelection() {
  const championChoices = getStarterChampionChoices();
  if (championChoices.length === 0) {
    characterSelectOverlay.remove();
    return;
  }

  const cardsHost = characterSelectOverlay.querySelector(".character-select__cards");
  cardsHost.replaceChildren();

  await Promise.all(
    championChoices.map(async (entry) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "champion-card";
      card.innerHTML = `
        <div class="champion-card__frame">
          <canvas class="champion-card__canvas"></canvas>
        </div>
        <div class="champion-card__meta">
          <div class="champion-card__name">${entry.displayName}</div>
          <div class="champion-card__subtitle">3D Preview Champion</div>
        </div>
      `;
      cardsHost.append(card);

      await setupCharacterPreview(card.querySelector(".champion-card__canvas"), entry.url);

      card.addEventListener("click", async () => {
        cardsHost.querySelectorAll(".champion-card").forEach((item) => {
          item.disabled = true;
        });
        selectedPlayerPath = entry.path;
        cardsHost.querySelectorAll(".champion-card").forEach((item) => {
          item.classList.toggle("selected", item === card);
        });
        characterSelectOverlay.classList.add("launching");
        await wait(850);
        characterSelectOverlay.remove();
        disposePreviewRenderers();
      }, { once: true });
    }),
  );

  resizeCharacterPreviews();

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.body.contains(characterSelectOverlay)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(app, { childList: true });
  });
}

function getStarterChampionChoices() {
  const entries = Object.entries(modelModules)
    .filter(([path]) => isCharacterModel(path))
    .sort(([a], [b]) => a.localeCompare(b));

  const choices = STARTER_CHAMPION_TOKENS
    .map((token) => entries.find(([path]) => path.toLowerCase().includes(token)))
    .filter(Boolean)
    .map(([path, url]) => ({
      path,
      url,
      displayName: beautifyName(path),
    }));

  if (choices.length > 0) {
    return choices;
  }

  return entries
    .filter(([path]) => !path.toLowerCase().includes("minion"))
    .slice(0, 3)
    .map(([path, url]) => ({
      path,
      url,
      displayName: beautifyName(path),
    }));
}

async function setupCharacterPreview(canvasElement, modelUrl) {
  const previewRenderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    antialias: true,
    alpha: true,
  });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  previewRenderer.setSize(canvasElement.clientWidth || 320, canvasElement.clientHeight || 360, false);
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(28, 320 / 360, 0.1, 100);
  previewCamera.position.set(0, 1.65, 7.2);

  previewScene.add(new THREE.AmbientLight("#fff9eb", 2.2));
  const keyLight = new THREE.DirectionalLight("#fff0cb", 3);
  keyLight.position.set(3, 7, 5);
  previewScene.add(keyLight);

  const rimLight = new THREE.DirectionalLight("#87d3ff", 1.4);
  rimLight.position.set(-4, 4, -3);
  previewScene.add(rimLight);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.95, 0.38, 40),
    new THREE.MeshStandardMaterial({
      color: "#213b52",
      emissive: "#11314a",
      roughness: 0.35,
      metalness: 0.55,
    }),
  );
  pedestal.position.y = -0.22;
  previewScene.add(pedestal);

  const definition = await loadModelDefinition(modelUrl, { scaleToHeight: 3.2 });
  const previewRoot = clone(definition.baseScene);
  previewRoot.position.y = 0;
  previewScene.add(previewRoot);

  let previewMixer = null;
  let previewController = null;
  if (definition.animations.length > 0) {
    previewMixer = new THREE.AnimationMixer(previewRoot);
    previewController = createAnimationController(previewMixer, definition.animations);
    setActorAnimation(previewController, "idle", { force: true });
  }

  const previewState = {
    renderer: previewRenderer,
    scene: previewScene,
    camera: previewCamera,
    mixer: previewMixer,
    root: previewRoot,
    canvas: canvasElement,
  };
  previewRenderers.push(previewState);
}

function updateCharacterPreviews(delta, elapsed) {
  previewRenderers.forEach((preview) => {
    preview.mixer?.update(delta);
    preview.root.rotation.y = elapsed * 0.55;
    preview.renderer.render(preview.scene, preview.camera);
  });
}

function disposePreviewRenderers() {
  while (previewRenderers.length > 0) {
    const preview = previewRenderers.pop();
    preview.renderer.dispose();
  }
}

function resizeCharacterPreviews() {
  previewRenderers.forEach((preview) => {
    const width = preview.canvas.clientWidth || 320;
    const height = preview.canvas.clientHeight || 360;
    preview.camera.aspect = width / height;
    preview.camera.updateProjectionMatrix();
    preview.renderer.setSize(width, height, false);
  });
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildRoster(entries) {
  const findPath = (token) =>
    entries.find(([path]) => path.toLowerCase().includes(token)) ?? null;
  const orderMinion = findPath("ranged_minion_-_order") ?? findPath("order");
  const chaosMinion = findPath("ranged_minion_-_chaos") ?? findPath("chaos");
  const championEntries = entries.filter(
    ([path]) =>
      !path.toLowerCase().includes("minion") &&
      !["map", "board", "arena", "stage"].some((token) => path.toLowerCase().includes(token)),
  );

  const playerIndex = findPreferredPlayerIndex(championEntries);
  const orderedChampions = championEntries
    .map(([path, url]) => ({ path, url, displayName: beautifyName(path), kind: "champion" }))
    .map((entry, index) => ({
      ...entry,
      priority: index === playerIndex ? 0 : index + 1,
    }))
    .sort((a, b) => a.priority - b.priority);

  const blueChampions = pickRepeated(orderedChampions, 2);
  const remainingChampions = orderedChampions.filter(
    (entry) => !blueChampions.some((picked) => picked.path === entry.path),
  );
  const redChampions = pickRepeated(
    remainingChampions.length > 0 ? remainingChampions : orderedChampions,
    2,
  );

  const blueMinionEntry = orderMinion
    ? {
      path: orderMinion[0],
      url: orderMinion[1],
      displayName: beautifyName(orderMinion[0]),
      kind: "minion",
    }
    : null;
  const redMinionEntry = chaosMinion
    ? {
      path: chaosMinion[0],
      url: chaosMinion[1],
      displayName: beautifyName(chaosMinion[0]),
      kind: "minion",
    }
    : blueMinionEntry;

  return {
    blueMinions: pickRepeated([blueMinionEntry].filter(Boolean), 4),
    redMinions: pickRepeated([redMinionEntry].filter(Boolean), 4),
    blueChampions,
    redChampions,
    all: [
      ...pickRepeated([blueMinionEntry].filter(Boolean), 1),
      ...pickRepeated([redMinionEntry].filter(Boolean), 1),
      ...orderedChampions,
    ],
  };
}

function pickRepeated(source, count) {
  if (source.length === 0) return [];
  return Array.from({ length: count }, (_, index) => source[index % source.length]);
}

function addPlaceholderActors() {
  const placeholderBlueprints = [
    ...Array.from({ length: 4 }, (_, index) => ({
      name: `Blue Minion ${index + 1}`,
      team: "blue",
      kind: "minion",
      color: "#6bb9ff",
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      name: `Red Minion ${index + 1}`,
      team: "red",
      kind: "minion",
      color: "#ff8f84",
    })),
    { name: "Blue Champion A", team: "blue", kind: "champion", color: "#2e4057", isPlayer: true },
    { name: "Blue Champion B", team: "blue", kind: "champion", color: "#67a6ff" },
    { name: "Red Champion A", team: "red", kind: "champion", color: "#d96c75" },
    { name: "Red Champion B", team: "red", kind: "champion", color: "#ffb064" },
  ];

  placeholderBlueprints.forEach((blueprint) => {
    const geometry =
      blueprint.kind === "minion"
        ? new THREE.CapsuleGeometry(0.45, 1.0, 8, 16)
        : new THREE.CapsuleGeometry(0.65, 1.35, 8, 16);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: blueprint.color }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const actor = createActor({
      name: blueprint.name,
      root: mesh,
      animationController: null,
      team: blueprint.team,
      isPlayer: Boolean(blueprint.isPlayer),
      kind: blueprint.kind,
      height: blueprint.kind === "minion" ? 2 : 2.5,
      sourceName: blueprint.name,
    });

    actors.push(actor);
    if (actor.team === "blue") {
      blueTeam.push(actor);
    } else {
      redTeam.push(actor);
    }
    if (actor.isPlayer) {
      player.actor = actor;
      player.modelName = actor.name;
    }
  });

  layoutExplorationCast(actors);
  resetRound();
}

async function loadModelDefinition(url, options) {
  const gltf = await loader.loadAsync(url);
  normalizeModel(gltf.scene, options.scaleToHeight);

  return {
    baseScene: gltf.scene,
    animations: gltf.animations,
    height: options.scaleToHeight,
  };
}

function instantiateActor(definition, options) {
  const root = clone(definition.baseScene);
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.envMapIntensity = 1.1;
      }
    }
  });
  scene.add(root);

  let animationController = null;
  if (definition.animations.length > 0) {
    const mixer = new THREE.AnimationMixer(root);
    mixers.push(mixer);
    animationController = createAnimationController(mixer, definition.animations);
  }

  const actor = createActor({
    name: options.name,
    root,
    animationController,
    team: options.team,
    isPlayer: options.isPlayer,
    kind: options.kind,
    height: definition.height,
    sourceName: options.sourceName,
  });

  setActorAnimation(actor.animationController, "idle");
  return actor;
}

function createActor({
  name,
  root,
  animationController,
  team,
  isPlayer,
  kind,
  height,
  sourceName,
}) {
  const role = inferCombatRole(sourceName, kind, isPlayer);

  const actor = {
    name,
    sourceName,
    root,
    animationController,
    team,
    isPlayer,
    kind,
    height,
    maxHealth: role.maxHealth,
    health: role.maxHealth,
    attackDamage: role.attackDamage,
    attackRange: role.attackRange,
    moveSpeed: role.moveSpeed,
    attackInterval: role.attackInterval,
    attackCooldown: 0,
    skillCounter: 0,
    animationLockTimer: 0,
    lifeState: "alive",
    hoverPhase: Math.random() * Math.PI * 2,
    homeY: 0,
    spawnPosition: new THREE.Vector3(),
    spawnRotation: 0,
    target: null,
    deathTimer: 0,
    fadeTimer: 0,
    verticalVelocity: 0,
    isGrounded: true,
    respawnTimer: 0,
    shadowMesh: null,
    lastDamagedByTeam: null,
    hud: createHealthBar(name, team, kind),
  };

  root.userData.actor = actor;

  if (isPlayer) {
    actor.shadowMesh = createPlayerShadow();
    scene.add(actor.shadowMesh);
  }

  updateHealthBar(actor);
  return actor;
}

function createPlayerShadow() {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 32),
    new THREE.MeshBasicMaterial({
      color: "#000000",
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 2;
  return shadow;
}

function createHealthBar(name, team, kind) {
  const container = document.createElement("div");
  container.className = `health-bar ${team} ${kind}`;
  container.innerHTML = `
    <div class="health-name">${name}</div>
    <div class="health-track">
      <div class="health-fill"></div>
    </div>
  `;
  healthLayer.append(container);

  return {
    container,
    fill: container.querySelector(".health-fill"),
  };
}

function createAnimationController(mixer, clips) {
  const actions = new Map();

  clips.forEach((clip) => {
    actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
  });

  return {
    currentAction: null,
    idleAction:
      findActionByKeywords(actions, ["idle", "wait", "stand", "breathe"]) ??
      getFirstAction(actions),
    walkAction:
      findActionByKeywords(actions, ["walk", "move", "jog"]) ??
      findActionByKeywords(actions, ["run"]) ??
      getFirstAction(actions),
    runAction:
      findActionByKeywords(actions, ["run", "sprint", "dash"]) ??
      findActionByKeywords(actions, ["walk", "move", "jog"]) ??
      getFirstAction(actions),
    jumpAction:
      findActionByKeywords(actions, ["jump", "leap", "hop", "fall"]) ??
      getFirstAction(actions),
    attackAction:
      findActionByKeywords(actions, ["attack", "atk", "basic", "shoot", "slash", "fire"]) ??
      findActionByKeywords(actions, ["walk", "run", "move"]) ??
      getFirstAction(actions),
    skillAction:
      findActionByKeywords(actions, ["skill", "spell", "cast", "ability", "ultimate"]) ??
      findActionByKeywords(actions, ["attack", "atk", "basic", "shoot", "slash", "fire"]) ??
      getFirstAction(actions),
    hitAction:
      findActionByKeywords(actions, ["hit", "hurt", "damage", "impact", "stagger"]) ??
      null,
    deathAction:
      findActionByKeywords(actions, ["death", "die", "defeat", "fall", "dead"]) ??
      null,
    victoryAction:
      findActionByKeywords(actions, ["victory", "win", "celebrate", "dance"]) ??
      null,
  };
}

function getFirstAction(actions) {
  return actions.values().next().value ?? null;
}

function findActionByKeywords(actions, keywords) {
  for (const [name, action] of actions) {
    if (keywords.some((keyword) => name.includes(keyword))) {
      return action;
    }
  }
  return null;
}

function setActorAnimation(controller, state, options = {}) {
  if (!controller) return 0.35;

  const nextAction =
    state === "run"
      ? controller.runAction
      : state === "jump"
        ? controller.jumpAction ?? controller.runAction ?? controller.walkAction
        : state === "walk"
      ? controller.walkAction
      : state === "attack"
        ? controller.attackAction
        : state === "skill"
          ? controller.skillAction
          : state === "hit"
            ? controller.hitAction ?? controller.idleAction
            : state === "death"
              ? controller.deathAction ?? controller.idleAction
              : state === "victory"
                ? controller.victoryAction ?? controller.idleAction
                : controller.idleAction;

  if (!nextAction) return 0.35;
  if (controller.currentAction === nextAction && !options.force) {
    return nextAction.getClip()?.duration ?? 0.35;
  }

  const previousAction = controller.currentAction;
  controller.currentAction = nextAction;

  nextAction.enabled = true;
  nextAction.reset();
  nextAction.setLoop(
    options.loopOnce ? THREE.LoopOnce : THREE.LoopRepeat,
    options.loopOnce ? 1 : Infinity,
  );
  nextAction.clampWhenFinished = Boolean(options.loopOnce);
  nextAction.fadeIn(options.fade ?? 0.16);
  nextAction.play();

  if (previousAction && previousAction !== nextAction) {
    previousAction.fadeOut(options.fade ?? 0.16);
  }

  return nextAction.getClip()?.duration ?? 0.35;
}

function normalizeModel(object, targetHeight) {
  tempBox.setFromObject(object);
  tempBox.getSize(tempSize);
  tempBox.getCenter(tempCenter);

  const height = Math.max(tempSize.y, 0.001);
  const scale = targetHeight / height;

  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);

  tempBox.setFromObject(object);
  tempBox.getCenter(tempCenter);

  object.position.x -= tempCenter.x;
  object.position.z -= tempCenter.z;
  object.position.y -= tempBox.min.y;
}

function centerObjectOnGround(object) {
  tempBox.setFromObject(object);
  tempBox.getCenter(tempCenter);

  object.position.x -= tempCenter.x;
  object.position.z -= tempCenter.z;
  object.position.y -= tempBox.min.y;
}

function applyMapConfig(object) {
  object.rotation.set(
    MAP_CONFIG.rotation.x,
    MAP_CONFIG.rotation.y,
    MAP_CONFIG.rotation.z,
  );
  object.scale.set(
    MAP_CONFIG.scale,
    MAP_CONFIG.scale,
    MAP_CONFIG.scale,
  );
  object.updateMatrixWorld(true);
}

function applyMapPlacement() {
  if (!activeMapRoot) return;

  applyMapConfig(activeMapRoot);
  centerObjectOnGround(activeMapRoot);
  activeMapRoot.position.x += MAP_CONFIG.position.x;
  activeMapRoot.position.y += MAP_CONFIG.position.y;
  activeMapRoot.position.z += MAP_CONFIG.position.z;

  updateSpawnOriginFromMap();
  mapGround.y = spawnOrigin.y;
  arenaCenter.y = mapGround.y + 1.5;
  refreshActorSpawnHeights();
  if (actors.length > 0) {
    layoutExplorationCast(actors);
    resetRound();
  }
  if (transformControls.object !== activeMapRoot) {
    transformControls.attach(activeMapRoot);
  }
  transformControls.visible = false;
  syncMapEditorUI();
}

function updateSpawnOriginFromMap() {
  if (!activeMapRoot) return;

  tempBox.setFromObject(activeMapRoot);
  tempBox.getCenter(tempCenter);
  tempBox.getSize(tempSize);

  const bestPoint = estimateUrbanSpawnOrigin(
    tempCenter.x,
    tempCenter.z,
    tempBox.max.y + 2000,
    tempSize.x,
    tempSize.z,
  );

  if (bestPoint) {
    spawnOrigin.copy(bestPoint);
  } else {
    spawnOrigin.set(tempCenter.x, MAP_CONFIG.groundY, tempCenter.z);
  }

  const offsetPoint = resolveWalkableGround(
    spawnOrigin.x + SPAWN_CONFIG.offset.x,
    spawnOrigin.z + SPAWN_CONFIG.offset.z,
    spawnOrigin.y,
  );

  if (offsetPoint) {
    spawnOrigin.copy(offsetPoint);
  }
}

function estimateUrbanSpawnOrigin(centerX, centerZ, topY, sizeX, sizeZ) {
  const halfX = Math.max(8, sizeX * 0.22);
  const halfZ = Math.max(8, sizeZ * 0.22);
  const steps = 18;
  let bestPoint = null;
  let bestScore = -Infinity;

  for (let ix = 0; ix < steps; ix += 1) {
    const x = THREE.MathUtils.lerp(centerX - halfX, centerX + halfX, ix / (steps - 1));
    for (let iz = 0; iz < steps; iz += 1) {
      const z = THREE.MathUtils.lerp(centerZ - halfZ, centerZ + halfZ, iz / (steps - 1));
      tempMapOrigin.set(x, topY, z);
      raycaster.set(tempMapOrigin, downwardRay);
      const intersections = raycaster.intersectObject(activeMapRoot, true);

      for (const hit of intersections) {
        if (!hit.face) continue;

        tempSurfaceNormal.copy(hit.face.normal);
        tempSurfaceNormal.transformDirection(hit.object.matrixWorld);
        if (tempSurfaceNormal.y < 0.55) continue;

        const distanceFromCenter = Math.hypot(hit.point.x - centerX, hit.point.z - centerZ);
        const score = hit.point.y * 6 - distanceFromCenter * 0.45;
        if (score > bestScore) {
          bestScore = score;
          bestPoint = hit.point.clone();
        }
        break;
      }
    }
  }

  return bestPoint;
}

function frameMapInView(object) {
  tempBox.setFromObject(object);
  tempBox.getCenter(tempCenter);
  tempBox.getSize(tempSize);

  const dominantSize = Math.max(tempSize.x, tempSize.y, tempSize.z, 12);
  const distance = dominantSize * 0.9;

  controls.target.set(tempCenter.x, Math.max(tempCenter.y, mapGround.y + 2), tempCenter.z);
  arenaCenter.copy(controls.target);

  tempDirection.set(1, 0.9, 1).normalize().multiplyScalar(distance);
  camera.position.copy(controls.target).add(tempDirection);
  camera.near = 0.1;
  camera.far = Math.max(1000000, distance * 20);
  camera.updateProjectionMatrix();
  controls.update();
}

function syncMapConfigFromObject() {
  if (!activeMapRoot) return;

  MAP_CONFIG.position.x = activeMapRoot.position.x;
  MAP_CONFIG.position.y = activeMapRoot.position.y;
  MAP_CONFIG.position.z = activeMapRoot.position.z;
  MAP_CONFIG.rotation.x = activeMapRoot.rotation.x;
  MAP_CONFIG.rotation.y = activeMapRoot.rotation.y;
  MAP_CONFIG.rotation.z = activeMapRoot.rotation.z;
  MAP_CONFIG.scale = activeMapRoot.scale.x;
  syncMapEditorUI();
}

function syncMapEditorUI() {
  mapEditorInputs.x.value = String(Math.round(MAP_CONFIG.position.x));
  mapEditorInputs.y.value = String(Math.round(MAP_CONFIG.position.y));
  mapEditorInputs.z.value = String(Math.round(MAP_CONFIG.position.z));
  mapEditorInputs.scale.value = String(Math.round(MAP_CONFIG.scale - MAP_SCALE_DISPLAY_BASE));
  mapEditorInputs.spawnX.value = String(Math.round(SPAWN_CONFIG.offset.x));
  mapEditorInputs.spawnZ.value = String(Math.round(SPAWN_CONFIG.offset.z));

  mapEditorValues.x.textContent = `${Math.round(MAP_CONFIG.position.x)}`;
  mapEditorValues.y.textContent = `${Math.round(MAP_CONFIG.position.y)}`;
  mapEditorValues.z.textContent = `${Math.round(MAP_CONFIG.position.z)}`;
  mapEditorValues.scale.textContent = `${Math.round(MAP_CONFIG.scale - MAP_SCALE_DISPLAY_BASE)}`;
  mapEditorValues.spawnX.textContent = `${Math.round(SPAWN_CONFIG.offset.x)}`;
  mapEditorValues.spawnZ.textContent = `${Math.round(SPAWN_CONFIG.offset.z)}`;
}

function getPlayerChampionKey() {
  const name = player.actor?.sourceName?.toLowerCase() ?? player.modelName?.toLowerCase() ?? "";
  if (name.includes("jinx")) return "jinx";
  if (name.includes("blitz")) return "blitzcrank";
  if (name.includes("katarina")) return "katarina";
  return "generic";
}

function getChampionAbilityMeta() {
  const champion = getPlayerChampionKey();

  if (champion === "jinx") {
    return {
      q: { icon: "SM", name: "Switcheroo!" },
      w: { icon: "ZP", name: "Zap!" },
      e: { icon: "FC", name: "Flame Chompers" },
      r: { icon: "R!", name: "Super Mega Rocket" },
    };
  }

  if (champion === "blitzcrank") {
    return {
      q: { icon: "RG", name: "Rocket Grab" },
      w: { icon: "OD", name: "Overdrive" },
      e: { icon: "PF", name: "Power Fist" },
      r: { icon: "SF", name: "Static Field" },
    };
  }

  if (champion === "katarina") {
    return {
      q: { icon: "BB", name: "Bouncing Blade" },
      w: { icon: "PR", name: "Preparation" },
      e: { icon: "SH", name: "Shunpo" },
      r: { icon: "DL", name: "Death Lotus" },
    };
  }

  return {
    q: { icon: "Q", name: "Skill Q" },
    w: { icon: "W", name: "Skill W" },
    e: { icon: "E", name: "Skill E" },
    r: { icon: "R", name: "Ultimate" },
  };
}

function updateSkillHud() {
  const meta = getChampionAbilityMeta();

  Object.entries(skillSlots).forEach(([slot, refs]) => {
    const cooldown = player.abilityCooldowns[slot] ?? 0;
    refs.icon.textContent = meta[slot].icon;
    refs.name.textContent = meta[slot].name;
    refs.root.classList.toggle("is-cooling", cooldown > 0.05);
    refs.cooldown.textContent = cooldown > 0.05 ? `${cooldown.toFixed(1)}` : "";
  });
}

function getAbilityTarget(maxRange = Infinity) {
  const visibleMinions = actors.filter(
    (actor) => actor.kind === "minion" && actor.root.visible && actor.lifeState === "alive",
  );
  if (visibleMinions.length === 0) return null;

  const preferredTarget =
    player.combatTarget?.lifeState === "alive" && player.combatTarget.root.visible
      ? player.combatTarget
      : getNearestEnemy(player.actor, visibleMinions);

  if (!preferredTarget) return null;
  if (player.actor.root.position.distanceTo(preferredTarget.root.position) > maxRange) return null;
  return preferredTarget;
}

function setAbilityCooldown(slot, seconds) {
  player.abilityCooldowns[slot] = seconds;
}

function castPlayerAbility(slot) {
  if (!player.actor || game.phase !== "idle") return;
  if (player.abilityCooldowns[slot] > 0) return;

  const champion = getPlayerChampionKey();
  if (champion === "jinx") {
    castJinxAbility(slot);
    return;
  }
  if (champion === "blitzcrank") {
    castBlitzAbility(slot);
    return;
  }
  if (champion === "katarina") {
    castKatarinaAbility(slot);
  }
}

function castJinxAbility(slot) {
  const target = getAbilityTarget(slot === "r" ? 999 : 18);

  if (slot === "q") {
    player.jinxRocketMode = !player.jinxRocketMode;
    player.actor.attackRange = player.jinxRocketMode ? 12 : 7.6;
    player.actor.attackDamage = player.jinxRocketMode ? 20 : 16;
    createImpactEffect(player.actor.root.position, player.actor.team, 1.25, {
      color: player.jinxRocketMode ? "#ff9bd5" : "#7dd8ff",
      impactScale: 1.4,
    });
    setAbilityCooldown("q", 0.8);
    return;
  }

  if (!target) return;

  if (slot === "w") {
    setAbilityCooldown("w", 5.5);
    fireAbilityProjectile(player.actor, target, 30, {
      color: "#8ee7ff",
      emissive: "#5dd2ff",
      impactScale: 1.85,
      projectileScale: 0.34,
      speed: 4.8,
    }, "skill");
    return;
  }

  if (slot === "e") {
    setAbilityCooldown("e", 9);
    createTrapEffect(target.root.position, 0.55, 2.2, () => {
      if (target.lifeState === "alive") {
        applyDamage(target, 22, player.actor.team, true);
        target.animationLockTimer = Math.max(target.animationLockTimer, 0.75);
      }
    });
    return;
  }

  if (slot === "r") {
    setAbilityCooldown("r", 16);
    fireAbilityProjectile(player.actor, target, 60, {
      color: "#ffd46d",
      emissive: "#ff7a63",
      impactScale: 2.5,
      projectileScale: 0.52,
      speed: 3.6,
      geometry: "rocket",
    }, "skill");
  }
}

function castBlitzAbility(slot) {
  const target = getAbilityTarget(slot === "q" ? 20 : 8);

  if (slot === "q") {
    if (!target) return;
    setAbilityCooldown("q", 8);
    fireAbilityProjectile(player.actor, target, 24, {
      color: "#ffe78d",
      emissive: "#ffd14a",
      impactScale: 1.9,
      projectileScale: 0.28,
      speed: 5,
    }, "hook");
    return;
  }

  if (slot === "w") {
    setAbilityCooldown("w", 7);
    player.blitzOverdriveTimer = 3;
    createImpactEffect(player.actor.root.position, player.actor.team, 1.5, {
      color: "#ffe78d",
      impactScale: 1.6,
    });
    return;
  }

  if (slot === "e") {
    setAbilityCooldown("e", 5);
    player.blitzPowerFistReady = true;
    createImpactEffect(player.actor.root.position, player.actor.team, 1.2, {
      color: "#fff2b7",
      impactScale: 1.35,
    });
    return;
  }

  if (slot === "r") {
    setAbilityCooldown("r", 14);
    actors.forEach((actor) => {
      if (actor.kind !== "minion" || !actor.root.visible || actor.lifeState !== "alive") return;
      if (actor.root.position.distanceTo(player.actor.root.position) > 10) return;
      applyDamage(actor, 42, player.actor.team, true);
      createImpactEffect(actor.root.position, player.actor.team, 2.1, {
        color: "#ffe78d",
        impactScale: 2.2,
      });
    });
  }
}

function castKatarinaAbility(slot) {
  const target = getAbilityTarget(slot === "r" ? 8 : 14);

  if (slot === "q") {
    if (!target) return;
    setAbilityCooldown("q", 4.5);
    fireAbilityProjectile(player.actor, target, 26, {
      color: "#ff91b8",
      emissive: "#ff5a97",
      impactScale: 1.8,
      projectileScale: 0.28,
      speed: 5.4,
    }, "skill");
    return;
  }

  if (slot === "w") {
    setAbilityCooldown("w", 5.5);
    createImpactEffect(player.actor.root.position, player.actor.team, 1.6, {
      color: "#ff8ab3",
      impactScale: 1.9,
    });
    actors.forEach((actor) => {
      if (actor.kind !== "minion" || !actor.root.visible || actor.lifeState !== "alive") return;
      if (actor.root.position.distanceTo(player.actor.root.position) > 4.4) return;
      applyDamage(actor, 20, player.actor.team, true);
    });
    return;
  }

  if (slot === "e") {
    if (!target) return;
    setAbilityCooldown("e", 6);
    const blinkPoint = resolveWalkableGround(
      target.root.position.x - 0.8,
      target.root.position.z - 0.8,
      player.actor.root.position.y,
    );
    if (blinkPoint) {
      player.actor.root.position.copy(blinkPoint);
      player.actor.homeY = blinkPoint.y;
      mapGround.y = blinkPoint.y;
    }
    setActorAnimation(player.actor.animationController, "skill", { force: true });
    applyDamage(target, 28, player.actor.team, true);
    createImpactEffect(target.root.position, player.actor.team, 1.9, {
      color: "#ff78ad",
      impactScale: 2,
    });
    return;
  }

  if (slot === "r") {
    setAbilityCooldown("r", 16);
    player.katarinaUltimateTimer = 2.2;
    player.katarinaUltimateTick = 0;
    player.actor.animationLockTimer = 2.1;
    setActorAnimation(player.actor.animationController, "skill", { force: true });
  }
}

function fireAbilityProjectile(attacker, target, damage, style, projectileType) {
  const start = attacker.root.position.clone();
  start.y += attacker.height * 0.72;

  const end = target.root.position.clone();
  end.y += target.height * 0.65;

  let geometry = new THREE.OctahedronGeometry(style.projectileScale ?? 0.3, 0);
  if (style.geometry === "rocket") {
    geometry = new THREE.ConeGeometry((style.projectileScale ?? 0.42) * 0.7, 1.15, 12);
  }

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: style.color,
      emissive: style.emissive,
      emissiveIntensity: 1.9,
    }),
  );
  mesh.position.copy(start);
  mesh.rotation.z = Math.PI / 2;
  scene.add(mesh);

  setActorAnimation(attacker.animationController, "skill", { loopOnce: true, force: true });
  attacker.animationLockTimer = Math.max(attacker.animationLockTimer, 0.45);

  projectiles.push({
    attacker,
    target,
    damage,
    isSkill: true,
    team: attacker.team,
    mesh,
    start,
    end,
    progress: 0,
    speed: style.speed ?? 4,
    skillStyle: style,
    projectileType,
  });
}

function createTrapEffect(position, armDelay, life, onTrigger) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 1.05, 26),
    new THREE.MeshBasicMaterial({
      color: "#ff9fcb",
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position);
  mesh.position.y += 0.1;
  scene.add(mesh);

  playerSkillEffects.push({
    type: "trap",
    mesh,
    worldPosition: position.clone(),
    armDelay,
    life,
    elapsed: 0,
    onTrigger,
    triggered: false,
  });
}

function setupMobileControls() {
  syncMobileHudVisibility();

  mobileUi.joystick.addEventListener("pointerdown", onMobileJoystickDown);
  window.addEventListener("pointermove", onMobileJoystickMove, { passive: false });
  window.addEventListener("pointerup", onMobileJoystickUp);
  window.addEventListener("pointercancel", onMobileJoystickUp);

  mobileUi.actions.jump.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    player.jumpRequested = true;
  });

  mobileUi.actions.run.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    mobileInput.sprint = true;
    mobileUi.actions.run.classList.add("is-active");
  });

  const releaseRun = () => {
    mobileInput.sprint = false;
    mobileUi.actions.run.classList.remove("is-active");
  };
  mobileUi.actions.run.addEventListener("pointerup", releaseRun);
  mobileUi.actions.run.addEventListener("pointercancel", releaseRun);
  mobileUi.actions.run.addEventListener("pointerleave", releaseRun);

  mobileUi.actions.attack.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    mobileInput.attackHeld = true;
    mobileUi.actions.attack.classList.add("is-active");
  });
  const releaseAttack = () => {
    mobileInput.attackHeld = false;
    mobileUi.actions.attack.classList.remove("is-active");
  };
  mobileUi.actions.attack.addEventListener("pointerup", releaseAttack);
  mobileUi.actions.attack.addEventListener("pointercancel", releaseAttack);
  mobileUi.actions.attack.addEventListener("pointerleave", releaseAttack);

  Object.entries(skillSlots).forEach(([slot, refs]) => {
    refs.root.addEventListener("pointerdown", (event) => {
      if (!mobileInput.enabled) return;
      event.preventDefault();
      castPlayerAbility(slot);
    });
  });
}

function syncMobileHudVisibility() {
  mobileInput.enabled = isMobileLayout();
  mobileUi.root.classList.toggle("visible", mobileInput.enabled);
}

function onMobileJoystickDown(event) {
  if (!mobileInput.enabled) return;
  event.preventDefault();
  mobileInput.joystickPointerId = event.pointerId;
  updateMobileJoystick(event.clientX, event.clientY);
  mobileUi.joystick.classList.add("is-active");
}

function onMobileJoystickMove(event) {
  if (mobileInput.joystickPointerId !== event.pointerId) return;
  event.preventDefault();
  updateMobileJoystick(event.clientX, event.clientY);
}

function onMobileJoystickUp(event) {
  if (mobileInput.joystickPointerId !== event.pointerId) return;
  mobileInput.joystickPointerId = null;
  mobileInput.joystickVector.set(0, 0);
  mobileUi.joystickThumb.style.transform = "translate(-50%, -50%)";
  mobileUi.joystick.classList.remove("is-active");
}

function updateMobileJoystick(clientX, clientY) {
  const rect = mobileUi.joystickRing.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const deltaX = clientX - centerX;
  const deltaY = clientY - centerY;
  const radius = rect.width * 0.33;
  const distance = Math.min(Math.hypot(deltaX, deltaY), radius);
  const angle = Math.atan2(deltaY, deltaX);
  const clampedX = Math.cos(angle) * distance;
  const clampedY = Math.sin(angle) * distance;

  mobileInput.joystickVector.set(clampedX / radius, clampedY / radius);
  mobileUi.joystickThumb.style.transform =
    `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
}

function updateMobileAttackIntent() {
  if (!mobileInput.enabled || !mobileInput.attackHeld || !player.actor) return;

  const target = getAbilityTarget(16) ?? getNearestVisibleMinion();
  if (!target) return;
  player.combatTarget = target;
  player.moveTarget = null;
}

function getNearestVisibleMinion() {
  const visibleMinions = actors.filter(
    (actor) => actor.kind === "minion" && actor.root.visible && actor.lifeState === "alive",
  );
  if (visibleMinions.length === 0) return null;
  return getNearestEnemy(player.actor, visibleMinions);
}

function onPointerDown(event) {
  if (!activeMapRoot || transformControls.dragging) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  if (mobileInput.enabled && event.pointerType === "touch") {
    const clickedActor = getClickedActor();
    if (clickedActor && clickedActor !== player.actor && clickedActor.kind === "minion") {
      handleRightClickAttack(clickedActor);
    }
    return;
  }

  if (event.button === 2) {
    const clickedActor = getClickedActor();
    if (clickedActor && clickedActor !== player.actor && clickedActor.kind === "minion") {
      handleRightClickAttack(clickedActor);
    } else {
      handleRightClickMove();
    }
    return;
  }

  const intersects = raycaster.intersectObject(activeMapRoot, true);
  if (intersects.length > 0) {
    transformControls.attach(activeMapRoot);
    transformControls.visible = true;
  }
}

function getClickedActor() {
  const clickableActors = actors.filter(
    (actor) => actor.root.visible && actor.lifeState === "alive" && actor !== player.actor,
  );
  const intersections = raycaster.intersectObjects(
    clickableActors.map((actor) => actor.root),
    true,
  );
  if (intersections.length === 0) return null;

  let target = intersections[0].object;
  while (target) {
    if (target.userData?.actor) {
      return target.userData.actor;
    }
    target = target.parent;
  }
  return null;
}

function handleRightClickAttack(targetActor) {
  player.moveTarget = null;
  player.combatTarget = targetActor;
  createMoveClickEffect(targetActor.root.position.clone());
}

function handleRightClickMove() {
  if (!player.actor || game.phase !== "idle") return;

  player.combatTarget = null;
  const intersects = raycaster.intersectObject(activeMapRoot, true);
  if (intersects.length > 0) {
    const targetPoint = resolveWalkableGround(
      intersects[0].point.x,
      intersects[0].point.z,
      player.actor.root.position.y,
    );
    if (!targetPoint) return;
    player.moveTarget = targetPoint;
  } else {
    groundPlane.constant = -mapGround.y;
    if (!raycaster.ray.intersectPlane(groundPlane, tempHitPoint)) {
      return;
    }
    const targetPoint = resolveWalkableGround(
      tempHitPoint.x,
      tempHitPoint.z,
      player.actor.root.position.y,
    );
    if (!targetPoint) return;
    player.moveTarget = targetPoint;
  }

  createMoveClickEffect(player.moveTarget);
}

function setWalkSoundPlaying(playing) {
  if (!walkAudio) return;

  if (playing) {
    if (walkAudio.paused) {
      walkAudio.play().catch(() => {});
    }
    return;
  }

  if (!walkAudio.paused) {
    walkAudio.pause();
  }
}

function playOneShotSound(url, volume = 0.7) {
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(() => {});
}

function resolveWalkableGround(x, z, currentY) {
  if (!activeMapRoot) return null;

  tempMapOrigin.set(x, currentY + 8, z);
  raycaster.set(tempMapOrigin, downwardRay);
  const intersections = raycaster.intersectObject(activeMapRoot, true);

  for (const hit of intersections) {
    if (!hit.face) continue;

    tempSurfaceNormal.copy(hit.face.normal);
    tempSurfaceNormal.transformDirection(hit.object.matrixWorld);

    const heightDelta = hit.point.y - currentY;
    const canStepUp = heightDelta <= PLAYER_MAX_STEP_UP;
    const canStepDown = heightDelta >= -PLAYER_MAX_STEP_DOWN;
    const walkableSlope = tempSurfaceNormal.y >= PLAYER_MAX_WALKABLE_SLOPE;

    if (walkableSlope && canStepUp && canStepDown) {
      return hit.point.clone();
    }
  }

  return null;
}

function resolveSpawnGround(x, z) {
  if (!activeMapRoot) return null;

  tempBox.setFromObject(activeMapRoot);
  tempMapOrigin.set(x, tempBox.max.y + 2000, z);
  raycaster.set(tempMapOrigin, downwardRay);
  const intersections = raycaster.intersectObject(activeMapRoot, true);

  for (const hit of intersections) {
    if (!hit.face) continue;

    tempSurfaceNormal.copy(hit.face.normal);
    tempSurfaceNormal.transformDirection(hit.object.matrixWorld);

    if (tempSurfaceNormal.y >= 0.45) {
      return hit.point.clone();
    }
  }

  return null;
}

function snapActorToGround(actor, force = false) {
  if (!actor?.root || actor.lifeState !== "alive") return false;

  const currentGround =
    resolveSpawnGround(actor.root.position.x, actor.root.position.z) ??
    resolveWalkableGround(actor.root.position.x, actor.root.position.z, actor.root.position.y + 2);

  if (!currentGround) return false;

  actor.homeY = currentGround.y;
  actor.root.position.x = currentGround.x;
  actor.root.position.z = currentGround.z;
  actor.root.position.y = force
    ? currentGround.y
    : THREE.MathUtils.lerp(actor.root.position.y, currentGround.y, 0.28);

  return true;
}

function isWorldPointVisible(worldPoint) {
  tempProjectedPoint.copy(worldPoint).project(camera);
  return (
    tempProjectedPoint.z > -1 &&
    tempProjectedPoint.z < 1 &&
    tempProjectedPoint.x > -0.92 &&
    tempProjectedPoint.x < 0.92 &&
    tempProjectedPoint.y > -0.92 &&
    tempProjectedPoint.y < 0.92
  );
}

function findHiddenMinionRespawnPoint() {
  if (!activeMapRoot) return null;

  tempBox.setFromObject(activeMapRoot);
  tempBox.getCenter(tempCenter);
  tempBox.getSize(tempSize);

  const halfX = Math.max(18, tempSize.x * 0.2);
  const halfZ = Math.max(18, tempSize.z * 0.2);
  const topY = tempBox.max.y + 2000;
  let bestPoint = null;
  let bestScore = -Infinity;

  for (let ix = 0; ix < 16; ix += 1) {
    const x = THREE.MathUtils.lerp(tempCenter.x - halfX, tempCenter.x + halfX, ix / 15);
    for (let iz = 0; iz < 16; iz += 1) {
      const z = THREE.MathUtils.lerp(tempCenter.z - halfZ, tempCenter.z + halfZ, iz / 15);
      const groundPoint = resolveSpawnGround(x, z);
      if (!groundPoint) continue;
      if (player.actor && groundPoint.distanceTo(player.actor.root.position) < 18) continue;
      if (isWorldPointVisible(groundPoint)) continue;

      const distanceFromPlayer = player.actor
        ? Math.min(groundPoint.distanceTo(player.actor.root.position), 46)
        : 24;
      const distanceFromCenter = Math.hypot(groundPoint.x - tempCenter.x, groundPoint.z - tempCenter.z);
      const score = distanceFromPlayer * 1.25 - distanceFromCenter * 0.22 + groundPoint.y * 0.08;

      if (score > bestScore) {
        bestScore = score;
        bestPoint = groundPoint.clone();
      }
    }
  }

  return bestPoint;
}

function queueMinionRespawn(actor) {
  if (actor.kind !== "minion") return;
  if (minionRespawnQueue.some((entry) => entry.actor === actor)) return;

  actor.respawnTimer = 4.5 + Math.random() * 2.5;
  minionRespawnQueue.push(actor);
}

function respawnMinion(actor) {
  const respawnPoint = findHiddenMinionRespawnPoint();
  if (!respawnPoint) {
    actor.respawnTimer = 1.5;
    return;
  }

  actor.health = actor.maxHealth;
  actor.lifeState = "alive";
  actor.deathTimer = 0;
  actor.fadeTimer = 0;
  actor.attackCooldown = 0;
  actor.animationLockTimer = 0;
  actor.lastDamagedByTeam = null;
  actor.root.visible = true;
  actor.root.position.copy(respawnPoint);
  actor.spawnPosition.copy(respawnPoint);
  actor.homeY = respawnPoint.y;
  actor.root.rotation.y = Math.random() * Math.PI * 2;
  actor.hud.container.style.display = "block";
  updateHealthBar(actor);
  setActorAnimation(actor.animationController, "idle", { force: true });
}

function updateMinionRespawns(delta) {
  if (game.phase !== "idle") return;

  for (let index = minionRespawnQueue.length - 1; index >= 0; index -= 1) {
    const actor = minionRespawnQueue[index];
    actor.respawnTimer -= delta;
    if (actor.respawnTimer > 0) continue;

    respawnMinion(actor);
    if (actor.lifeState === "alive") {
      minionRespawnQueue.splice(index, 1);
    }
  }
}

function resolveLandingGround(x, z, currentY) {
  if (!activeMapRoot) return null;

  tempMapOrigin.set(x, currentY + 4, z);
  raycaster.set(tempMapOrigin, downwardRay);
  const intersections = raycaster.intersectObject(activeMapRoot, true);

  for (const hit of intersections) {
    if (!hit.face) continue;

    tempSurfaceNormal.copy(hit.face.normal);
    tempSurfaceNormal.transformDirection(hit.object.matrixWorld);

    if (tempSurfaceNormal.y >= 0.45) {
      return hit.point.clone();
    }
  }

  return null;
}

function refreshActorSpawnHeights() {
  actors.forEach((actor) => {
    actor.spawnPosition.y = mapGround.y;
    actor.homeY = mapGround.y;
    if (game.phase === "idle") {
      actor.root.position.y = mapGround.y;
    }
  });
}

function inferCombatRole(name, kind, isPlayer) {
  const lowerName = name.toLowerCase();

  if (kind === "minion") {
    return {
      maxHealth: 95,
      attackDamage: 10,
      attackRange: 6.6,
      moveSpeed: 4.1,
      attackInterval: 1.0,
    };
  }

  if (isPlayer || lowerName.includes("jinx")) {
    return {
      maxHealth: 145,
      attackDamage: 16,
      attackRange: 7.6,
      moveSpeed: 4.7,
      attackInterval: 0.95,
    };
  }

  if (lowerName.includes("blitz") || lowerName.includes("choncc") || lowerName.includes("large")) {
    return {
      maxHealth: 220,
      attackDamage: 22,
      attackRange: 2.4,
      moveSpeed: 3.9,
      attackInterval: 1.15,
    };
  }

  return {
    maxHealth: 165,
    attackDamage: 18,
    attackRange: 4.8,
    moveSpeed: 4.3,
    attackInterval: 1.05,
  };
}

function getSkillStyle(actor) {
  const lowerName = actor.sourceName.toLowerCase();

  if (lowerName.includes("jinx")) {
    return {
      type: "rocket",
      color: "#7dd8ff",
      emissive: "#56c7ff",
      impactScale: 2.2,
    };
  }

  if (lowerName.includes("katarina")) {
    return {
      type: "dagger-burst",
      color: "#ff8ab3",
      emissive: "#ff5f8f",
      impactScale: 2,
    };
  }

  if (lowerName.includes("blitz")) {
    return {
      type: "shockwave",
      color: "#ffe27a",
      emissive: "#ffce3a",
      impactScale: 2.1,
    };
  }

  if (lowerName.includes("choncc")) {
    return {
      type: "stomp",
      color: "#8ff5e5",
      emissive: "#5ce7d2",
      impactScale: 2.2,
    };
  }

  return {
    type: actor.kind === "champion" ? "arcane-bolt" : "basic",
    color: actor.team === "blue" ? "#76ceff" : "#ff9b90",
    emissive: actor.team === "blue" ? "#4ab8ff" : "#ff655c",
    impactScale: actor.kind === "champion" ? 1.8 : 1.3,
  };
}

function beautifyName(path) {
  return fileLabel(path)
    .replaceAll("_", " ")
    .replaceAll("  ", " ")
    .trim();
}

function findPreferredPlayerIndex(entries) {
  if (entries.length === 0) return 0;
  if (selectedPlayerPath) {
    const selectedIndex = entries.findIndex(([path]) => path === selectedPlayerPath);
    if (selectedIndex >= 0) return selectedIndex;
  }
  const preferredNames = ["jinx", "katarina", "blitz", "chibi"];
  const preferredIndex = entries.findIndex(([path]) =>
    preferredNames.some((token) => path.toLowerCase().includes(token)),
  );
  return preferredIndex >= 0 ? preferredIndex : 0;
}

function fileLabel(path) {
  return path.split("/").at(-1).replace(".glb", "");
}

function isCharacterModel(path) {
  const lowerPath = path.toLowerCase();
  return !["map", "board", "arena", "stage"].some((token) => lowerPath.includes(token));
}

function layoutExplorationCast(allActors) {
  const playerActor = allActors.find((actor) => actor.isPlayer) ?? allActors[0];
  if (!playerActor) return;

  applySpawnLayout(playerActor, explorationSlots[0], explorationSlots[0].rotation);
  playerActor.root.visible = true;
  playerActor.hud.container.style.display = "block";
  if (playerActor.spawnMarker) {
    playerActor.spawnMarker.visible = DEBUG_VIEW;
  }

  const npcActors = allActors.filter((actor) => actor !== playerActor);
  npcActors.forEach((actor, index) => {
    if (actor.kind === "minion") {
      const slot = minionExplorationSlots[index % minionExplorationSlots.length];
      applySpawnLayout(actor, slot, slot.rotation);
      actor.root.visible = true;
      actor.hud.container.style.display = "block";
      if (actor.spawnMarker) {
        actor.spawnMarker.visible = false;
      }
      return;
    }

    actor.root.visible = false;
    actor.hud.container.style.display = "none";
    if (actor.spawnMarker) {
      actor.spawnMarker.visible = false;
    }
  });
}

function layoutBlueTeam(teamActors) {
  const minions = teamActors.filter((actor) => actor.kind === "minion");
  const champions = teamActors.filter((actor) => actor.kind === "champion");

  const minionSlots = [
    { x: -1.2, z: -3.6 },
    { x: -1.2, z: -1.2 },
    { x: -1.2, z: 1.2 },
    { x: -1.2, z: 3.6 },
  ];
  const championSlots = [
    { x: -2.8, z: -1.5 },
    { x: -2.8, z: 1.5 },
  ];

  minions.forEach((actor, index) => {
    applySpawnLayout(actor, minionSlots[index % minionSlots.length], Math.PI / 2);
  });
  champions.forEach((actor, index) => {
    applySpawnLayout(actor, championSlots[index % championSlots.length], Math.PI / 2);
  });
}

function layoutRedTeam(teamActors) {
  const minions = teamActors.filter((actor) => actor.kind === "minion");
  const champions = teamActors.filter((actor) => actor.kind === "champion");

  const minionSlots = [
    { x: 1.2, z: -3.6 },
    { x: 1.2, z: -1.2 },
    { x: 1.2, z: 1.2 },
    { x: 1.2, z: 3.6 },
  ];
  const championSlots = [
    { x: 2.8, z: -1.5 },
    { x: 2.8, z: 1.5 },
  ];

  minions.forEach((actor, index) => {
    applySpawnLayout(actor, minionSlots[index % minionSlots.length], -Math.PI / 2);
  });
  champions.forEach((actor, index) => {
    applySpawnLayout(actor, championSlots[index % championSlots.length], -Math.PI / 2);
  });
}

function applySpawnLayout(actor, position, rotation) {
  const worldX = spawnOrigin.x + position.x;
  const worldZ = spawnOrigin.z + position.z;
  const groundedSpawn =
    resolveSpawnGround(worldX, worldZ) ??
    (actor.kind === "minion" ? findHiddenMinionRespawnPoint() : null);

  actor.spawnPosition.set(
    groundedSpawn?.x ?? worldX,
    groundedSpawn?.y ?? mapGround.y,
    groundedSpawn?.z ?? worldZ,
  );
  actor.spawnRotation = rotation;
  actor.homeY = actor.spawnPosition.y;

  if (DEBUG_VIEW && !actor.spawnMarker) {
    actor.spawnMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.12, 20),
      new THREE.MeshBasicMaterial({
        color: actor.team === "blue" ? "#4da3ff" : "#ff6b6b",
      }),
    );
    scene.add(actor.spawnMarker);
  }

  if (actor.spawnMarker) {
    actor.spawnMarker.position.set(
      actor.spawnPosition.x,
      actor.spawnPosition.y + 0.08,
      actor.spawnPosition.z,
    );
  }
}

function resetRound() {
  clearCombatEffects();
  minionRespawnQueue.length = 0;
  setWalkSoundPlaying(false);
  player.jumpRequested = false;
  player.combatTarget = null;
  player.abilityCooldowns = { q: 0, w: 0, e: 0, r: 0 };
  player.blitzOverdriveTimer = 0;
  player.blitzPowerFistReady = false;
  player.katarinaUltimateTimer = 0;
  player.katarinaUltimateTick = 0;
  actors.forEach((actor) => {
    actor.health = actor.maxHealth;
    actor.lifeState = "alive";
    actor.respawnTimer = 0;
    actor.target = null;
    actor.attackCooldown = 0.3 + Math.random() * 0.3;
    actor.skillCounter = 0;
    actor.animationLockTimer = 0;
    actor.deathTimer = 0;
    actor.fadeTimer = 0;
    actor.root.visible = actor.isPlayer || actor.kind === "minion";
    actor.root.position.copy(actor.spawnPosition);
    actor.root.rotation.y = actor.spawnRotation;
    actor.homeY = actor.spawnPosition.y;
    actor.verticalVelocity = 0;
    actor.isGrounded = true;
    updateHealthBar(actor);
    actor.hud.container.style.display = actor.isPlayer || actor.kind === "minion" ? "block" : "none";
    if (actor.spawnMarker) {
      actor.spawnMarker.visible = actor.isPlayer && DEBUG_VIEW;
    }
    if (actor.shadowMesh) {
      actor.shadowMesh.visible = actor.isPlayer;
    }
    setActorAnimation(actor.animationController, "idle", { force: true });
  });
  snapCameraToPlayer();
  updateGoldUI();
  updateSkillHud();
}

function clearCombatEffects() {
  while (scheduledStrikes.length > 0) scheduledStrikes.pop();

  while (projectiles.length > 0) {
    scene.remove(projectiles.pop().mesh);
  }

  while (impactEffects.length > 0) {
    scene.remove(impactEffects.pop().mesh);
  }

  while (damagePopups.length > 0) {
    damagePopups.pop().element.remove();
  }

  while (goldPopups.length > 0) {
    goldPopups.pop().element.remove();
  }

  while (moveClickEffects.length > 0) {
    const effect = moveClickEffects.pop();
    scene.remove(effect.ring);
    scene.remove(effect.pulse);
  }

  while (playerSkillEffects.length > 0) {
    const effect = playerSkillEffects.pop();
    if (effect.mesh) {
      scene.remove(effect.mesh);
    }
  }
}

function startBattle() {
  resetRound();
  setGamePhase("battle");
}

function setGamePhase(phase, winner = null) {
  game.phase = phase;
  game.winner = winner;
  if (phase !== "idle") {
    setWalkSoundPlaying(false);
  }

  if (phase === "idle") {
    battleStatus.textContent = "Exploration Mode";
    fightButton.disabled = false;
    fightButton.textContent = "FIGHT";
    resultOverlay.classList.remove("visible", "blue-win", "red-win");
    transitionOverlay.classList.remove("visible");
  }

  if (phase === "battle") {
    battleStatus.textContent = "Battle in progress";
    fightButton.disabled = true;
    fightButton.textContent = "FIGHT!";
    resultOverlay.classList.remove("visible", "blue-win", "red-win");
    transitionOverlay.classList.remove("visible");
  }

  if (phase === "victory") {
    battleStatus.textContent = `${winner === "blue" ? "Blue" : "Red"} Team wins`;
    resultOverlay.className = `result-overlay visible ${winner}-win`;
    resultOverlay.textContent = `${winner === "blue" ? "BLUE TEAM" : "RED TEAM"} VICTORY`;
    fightButton.disabled = true;
  }

  if (phase === "transition") {
    battleStatus.textContent = "Resetting round";
    transitionOverlay.classList.add("visible");
  }
}

function updatePlayerInput(delta) {
  if (!player.actor || player.actor.lifeState !== "alive" || game.phase !== "idle") return;

  player.actor.attackCooldown = Math.max(0, player.actor.attackCooldown - delta);
  player.actor.animationLockTimer = Math.max(0, player.actor.animationLockTimer - delta);
  player.abilityCooldowns.q = Math.max(0, player.abilityCooldowns.q - delta);
  player.abilityCooldowns.w = Math.max(0, player.abilityCooldowns.w - delta);
  player.abilityCooldowns.e = Math.max(0, player.abilityCooldowns.e - delta);
  player.abilityCooldowns.r = Math.max(0, player.abilityCooldowns.r - delta);
  player.blitzOverdriveTimer = Math.max(0, player.blitzOverdriveTimer - delta);
  updateSkillHud();
  updateMobileAttackIntent();

  moveDirection.set(0, 0, 0);
  let forwardInput = 0;
  let rightInput = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) forwardInput += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) forwardInput -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) rightInput -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) rightInput += 1;
  if (mobileInput.enabled) {
    forwardInput += -mobileInput.joystickVector.y;
    rightInput += mobileInput.joystickVector.x;
  }

  cameraForward.subVectors(controls.target, camera.position).setY(0);
  if (cameraForward.lengthSq() < 0.0001) {
    cameraForward.set(0, 0, -1);
  } else {
    cameraForward.normalize();
  }
  cameraRight.crossVectors(cameraForward, scene.up).normalize();

  moveDirection
    .addScaledVector(cameraForward, forwardInput)
    .addScaledVector(cameraRight, rightInput);

  const isSprinting = keys.has("ShiftLeft") || mobileInput.sprint;
  const blitzBoost = player.blitzOverdriveTimer > 0 ? 1.5 : 1;
  const moveSpeed =
    player.actor.moveSpeed * (isSprinting ? PLAYER_RUN_MULTIPLIER : 1.9) * blitzBoost;

  if (player.katarinaUltimateTimer > 0) {
    setWalkSoundPlaying(false);
    setActorAnimation(player.actor.animationController, "skill");
    return;
  }

  if (player.combatTarget?.lifeState !== "alive" || !player.combatTarget?.root.visible) {
    player.combatTarget = null;
  }

  if (
    player.combatTarget &&
    moveDirection.lengthSq() === 0 &&
    player.actor.isGrounded
  ) {
    moveDirection.subVectors(player.combatTarget.root.position, player.actor.root.position).setY(0);
    const targetDistance = moveDirection.length();
    if (targetDistance <= player.actor.attackRange) {
      player.moveTarget = null;
      player.actor.homeY = player.actor.root.position.y;
      player.actor.root.rotation.y = Math.atan2(moveDirection.x, moveDirection.z);
      setWalkSoundPlaying(false);
      if (player.actor.attackCooldown <= 0 && player.actor.animationLockTimer <= 0.12) {
        performAttack(player.actor, player.combatTarget);
      } else if (player.actor.animationLockTimer <= 0.12) {
        setActorAnimation(player.actor.animationController, "idle");
      }
      return;
    }
  }

  if (player.actor.isGrounded && player.jumpRequested) {
    player.actor.isGrounded = false;
    player.actor.verticalVelocity = PLAYER_JUMP_SPEED;
    player.moveTarget = null;
    player.jumpRequested = false;
    setWalkSoundPlaying(false);
    setActorAnimation(player.actor.animationController, "jump", { force: true });
  }

  if (moveDirection.lengthSq() > 0) {
    player.moveTarget = null;
  } else if (player.moveTarget && player.actor.isGrounded) {
    moveDirection.subVectors(player.moveTarget, player.actor.root.position).setY(0);
    if (moveDirection.lengthSq() <= 0.12) {
      player.moveTarget = null;
      mapGround.y = player.actor.root.position.y;
      player.actor.homeY = player.actor.root.position.y;
      player.jumpRequested = false;
      setActorAnimation(player.actor.animationController, "idle");
      return;
    }
  }

  if (moveDirection.lengthSq() === 0 && player.actor.isGrounded) {
    player.actor.homeY = player.actor.root.position.y;
    player.jumpRequested = false;
    setWalkSoundPlaying(false);
    setActorAnimation(player.actor.animationController, "idle");
    return;
  }

  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();
    player.actor.root.rotation.y = Math.atan2(moveDirection.x, moveDirection.z);
  }

  if (player.actor.isGrounded) {
    tempNextPosition.copy(player.actor.root.position).addScaledVector(moveDirection, moveSpeed * delta);
    const groundedPosition = resolveWalkableGround(
      tempNextPosition.x,
      tempNextPosition.z,
      player.actor.root.position.y,
    );
    if (!groundedPosition) {
      setWalkSoundPlaying(false);
      setActorAnimation(player.actor.animationController, "idle");
      return;
    }

    player.actor.root.position.copy(groundedPosition);
    mapGround.y = groundedPosition.y;
    player.actor.homeY = groundedPosition.y;
    setWalkSoundPlaying(moveDirection.lengthSq() > 0);
    setActorAnimation(player.actor.animationController, isSprinting ? "run" : "walk");
    return;
  }

  tempNextPosition.copy(player.actor.root.position).addScaledVector(moveDirection, moveSpeed * delta);
  player.actor.root.position.x = tempNextPosition.x;
  player.actor.root.position.z = tempNextPosition.z;
  player.actor.verticalVelocity -= PLAYER_GRAVITY * delta;
  player.actor.root.position.y += player.actor.verticalVelocity * delta;

  const landingPoint = resolveLandingGround(
    player.actor.root.position.x,
    player.actor.root.position.z,
    player.actor.root.position.y,
  );

  if (
    landingPoint &&
    player.actor.verticalVelocity <= 0 &&
    player.actor.root.position.y <= landingPoint.y + 0.18
  ) {
    player.actor.root.position.copy(landingPoint);
    player.actor.verticalVelocity = 0;
    player.actor.isGrounded = true;
    player.actor.homeY = landingPoint.y;
    mapGround.y = landingPoint.y;
    setActorAnimation(
      player.actor.animationController,
      moveDirection.lengthSq() > 0 ? (isSprinting ? "run" : "walk") : "idle",
      { force: true },
    );
    setWalkSoundPlaying(moveDirection.lengthSq() > 0);
    return;
  }

  setWalkSoundPlaying(false);
  setActorAnimation(player.actor.animationController, "jump");
}

function updateIdleActors(elapsedTime) {
  actors.forEach((actor) => {
    if (actor.lifeState !== "alive") return;
    if (actor.isPlayer) {
      actor.homeY = actor.root.position.y;
      return;
    }

    if (actor.kind === "minion") {
      snapActorToGround(actor);
    } else {
      actor.root.position.y = THREE.MathUtils.lerp(actor.root.position.y, actor.homeY, 0.16);
    }

    if (!actor.isPlayer && actor.animationLockTimer <= 0) {
      setActorAnimation(actor.animationController, "idle");
    }
  });
}

function updateBattle(delta) {
  const aliveBlue = blueTeam.filter((actor) => actor.lifeState === "alive");
  const aliveRed = redTeam.filter((actor) => actor.lifeState === "alive");

  if (aliveBlue.length === 0 || aliveRed.length === 0) {
    beginVictory(aliveBlue.length > 0 ? "blue" : "red");
    return;
  }

  actors.forEach((actor) => {
    if (actor.lifeState !== "alive") return;

    actor.root.position.y = THREE.MathUtils.lerp(actor.root.position.y, actor.homeY, 0.18);
    actor.attackCooldown = Math.max(0, actor.attackCooldown - delta);
    actor.animationLockTimer = Math.max(0, actor.animationLockTimer - delta);

    const enemies = actor.team === "blue" ? aliveRed : aliveBlue;
    const target = getNearestEnemy(actor, enemies);
    if (!target) return;

    actor.target = target;

    const direction = target.root.position.clone().sub(actor.root.position);
    const flatDirection = new THREE.Vector3(direction.x, 0, direction.z);
    const distance = flatDirection.length();

    if (distance > 0.001) {
      flatDirection.normalize();
      actor.root.rotation.y = Math.atan2(flatDirection.x, flatDirection.z);
    }

    if (distance > actor.attackRange) {
      const step = Math.min(distance - actor.attackRange, actor.moveSpeed * delta);
      actor.root.position.addScaledVector(flatDirection, step);
      if (actor.animationLockTimer <= 0) {
        setActorAnimation(actor.animationController, "walk");
      }
      return;
    }

    if (actor.attackCooldown > 0) {
      if (actor.animationLockTimer <= 0) {
        setActorAnimation(actor.animationController, "idle");
      }
      return;
    }

    performAttack(actor, target);
  });
}

function getNearestEnemy(actor, enemies) {
  let nearestEnemy = null;
  let nearestDistance = Infinity;

  enemies.forEach((enemy) => {
    const distance = actor.root.position.distanceTo(enemy.root.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemy = enemy;
    }
  });

  return nearestEnemy;
}

function performAttack(attacker, target) {
  attacker.attackCooldown = attacker.attackInterval;
  attacker.skillCounter += 1;

  let isSkill = attacker.skillCounter % 3 === 0;
  let damageMultiplier = 1;
  let forcedState = null;

  if (attacker.isPlayer && getPlayerChampionKey() === "jinx" && gunAudioUrl) {
    playOneShotSound(gunAudioUrl, player.jinxRocketMode ? 0.6 : 0.42);
  }

  if (attacker.isPlayer && getPlayerChampionKey() === "blitzcrank" && player.blitzPowerFistReady) {
    player.blitzPowerFistReady = false;
    isSkill = true;
    damageMultiplier = 1.7;
    forcedState = "skill";
  }

  const damage = Math.round(attacker.attackDamage * (isSkill ? 1.85 : 1));
  const state = forcedState ?? (isSkill ? "skill" : "attack");
  const duration = setActorAnimation(attacker.animationController, state, {
    loopOnce: true,
    force: true,
  });

  attacker.animationLockTimer = Math.max(0.32, duration * 0.8);

  scheduledStrikes.push({
    attacker,
    target,
    damage: Math.round(damage * damageMultiplier),
    isSkill,
    time: Math.max(0.14, duration * 0.45),
  });
}

function updateScheduledStrikes(delta) {
  for (let index = scheduledStrikes.length - 1; index >= 0; index -= 1) {
    const strike = scheduledStrikes[index];
    strike.time -= delta;

    if (strike.time > 0) continue;

    if (
      strike.attacker.lifeState === "alive" &&
      strike.target.lifeState === "alive"
    ) {
      resolveStrike(strike.attacker, strike.target, strike.damage, strike.isSkill);
    }

    scheduledStrikes.splice(index, 1);
  }
}

function resolveStrike(attacker, target, damage, isSkill) {
  if (isSkill) {
    resolveSkillStrike(attacker, target, damage);
    return;
  }

  if (attacker.attackRange <= 3) {
    createImpactEffect(target.root.position, attacker.team, isSkill ? 1.7 : 1.15);
    applyDamage(target, damage, attacker.team, isSkill);
    return;
  }

  const start = attacker.root.position.clone();
  start.y += attacker.height * 0.65;

  const end = target.root.position.clone();
  end.y += target.height * 0.6;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(isSkill ? 0.3 : 0.18, 12, 12),
    new THREE.MeshStandardMaterial({
      color: attacker.team === "blue" ? "#70c6ff" : "#ff8f84",
      emissive: attacker.team === "blue" ? "#4db8ff" : "#ff5e57",
      emissiveIntensity: isSkill ? 1.8 : 1.15,
    }),
  );
  mesh.position.copy(start);
  scene.add(mesh);

  projectiles.push({
    attacker,
    target,
    damage,
    isSkill,
    team: attacker.team,
    mesh,
    start,
    end,
    progress: 0,
    speed: isSkill ? 2.4 : 3.7,
    straight:
      attacker.isPlayer &&
      getPlayerChampionKey() === "jinx" &&
      !isSkill,
  });
}

function resolveSkillStrike(attacker, target, damage) {
  const skillStyle = getSkillStyle(attacker);

  if (skillStyle.type === "shockwave" || skillStyle.type === "stomp" || skillStyle.type === "dagger-burst") {
    createImpactEffect(target.root.position, attacker.team, skillStyle.impactScale, skillStyle);
    if (skillStyle.type === "dagger-burst") {
      createImpactEffect(
        target.root.position.clone().add(new THREE.Vector3(0.4, 0, 0.35)),
        attacker.team,
        1.2,
        skillStyle,
      );
      createImpactEffect(
        target.root.position.clone().add(new THREE.Vector3(-0.35, 0, -0.4)),
        attacker.team,
        1.1,
        skillStyle,
      );
    }
    applyDamage(target, damage, attacker.team, true);
    return;
  }

  const start = attacker.root.position.clone();
  start.y += attacker.height * 0.72;

  const end = target.root.position.clone();
  end.y += target.height * 0.65;

  const geometry =
    skillStyle.type === "rocket"
      ? new THREE.ConeGeometry(0.22, 0.9, 10)
      : new THREE.OctahedronGeometry(0.32, 0);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: skillStyle.color,
      emissive: skillStyle.emissive,
      emissiveIntensity: 1.8,
    }),
  );
  mesh.position.copy(start);
  mesh.rotation.z = Math.PI / 2;
  scene.add(mesh);

  projectiles.push({
    attacker,
    target,
    damage,
    isSkill: true,
    team: attacker.team,
    mesh,
    start,
    end,
    progress: 0,
    speed: 2.5,
    skillStyle,
  });
}

function applyDamage(target, damage, sourceTeam, isSkill) {
  if (target.lifeState !== "alive") return;

  target.lastDamagedByTeam = sourceTeam;
  target.health = Math.max(0, target.health - damage);
  updateHealthBar(target);
  createDamagePopup(target, damage, isSkill);

  if (target.health <= 0) {
    beginDeath(target);
    return;
  }

  if (target.animationLockTimer <= 0.12) {
    const hitDuration = setActorAnimation(target.animationController, "hit", {
      loopOnce: true,
      force: true,
    });
    target.animationLockTimer = Math.max(target.animationLockTimer, hitDuration * 0.45);
  }

  createImpactEffect(target.root.position, sourceTeam, isSkill ? 1.45 : 1);
}

function beginDeath(actor) {
  actor.lifeState = "dying";
  actor.attackCooldown = 999;
  actor.animationLockTimer = 999;

  if (game.phase === "idle" && actor.kind === "minion" && actor.lastDamagedByTeam === player.actor?.team) {
    player.gold += 3;
    updateGoldUI();
    createGoldPopup(actor.root.position, 3);
    if (player.combatTarget === actor) {
      player.combatTarget = null;
    }
  }

  const deathDuration = setActorAnimation(actor.animationController, "death", {
    loopOnce: true,
    force: true,
  });
  actor.deathTimer = Math.max(0.9, deathDuration);
  actor.fadeTimer = 0.55;
  actor.hud.fill.style.width = "0%";
}

function updateDeaths(delta) {
  actors.forEach((actor) => {
    if (actor.lifeState !== "dying") return;

    actor.deathTimer -= delta;
    if (actor.deathTimer > 0) return;

    actor.fadeTimer -= delta;
    actor.root.position.y -= delta * 0.5;

    if (actor.fadeTimer <= 0) {
      actor.lifeState = "dead";
      actor.root.visible = false;
      actor.hud.container.style.display = "none";
      if (game.phase === "idle" && actor.kind === "minion") {
        queueMinionRespawn(actor);
      }
    }
  });
}

function createDamagePopup(target, damage, isSkill) {
  const element = document.createElement("div");
  element.className = `damage-popup ${target.team}`;
  element.textContent = `-${damage}`;
  healthLayer.append(element);

  damagePopups.push({
    element,
    worldPosition: target.root.position.clone().add(new THREE.Vector3(0, target.height + 0.8, 0)),
    life: 0.8,
    totalLife: 0.8,
    drift: isSkill ? 1.45 : 1,
  });
}

function createGoldPopup(position, amount) {
  const element = document.createElement("div");
  element.className = "gold-popup";
  element.textContent = `+${amount} Gold`;
  healthLayer.append(element);

  goldPopups.push({
    element,
    worldPosition: position.clone().add(new THREE.Vector3(0, 2.2, 0)),
    life: 1.1,
    totalLife: 1.1,
  });
}

function createImpactEffect(position, team, scale, style = null) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.35 * scale, 0.68 * scale, 24),
    new THREE.MeshBasicMaterial({
      color: style?.color ?? (team === "blue" ? "#8ce0ff" : "#ffb0a8"),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position);
  mesh.position.y += 0.16;
  scene.add(mesh);

  impactEffects.push({
    mesh,
    age: 0,
    life: 0.35,
    style,
  });
}

function createMoveClickEffect(position) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.86, 36),
    new THREE.MeshBasicMaterial({
      color: "#9fe8ff",
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position);
  ring.position.y += 0.08;
  scene.add(ring);

  const pulse = new THREE.Mesh(
    new THREE.CircleGeometry(0.26, 28),
    new THREE.MeshBasicMaterial({
      color: "#d8f8ff",
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.copy(position);
  pulse.position.y += 0.06;
  scene.add(pulse);

  moveClickEffects.push({
    ring,
    pulse,
    age: 0,
    life: 0.9,
    basePosition: position.clone(),
  });
}

function updateProjectiles(delta) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];

    if (projectile.target.lifeState !== "alive") {
      scene.remove(projectile.mesh);
      projectiles.splice(index, 1);
      continue;
    }

    projectile.end.copy(projectile.target.root.position);
    projectile.end.y += projectile.target.height * 0.6;
    projectile.progress += delta * projectile.speed;

    if (projectile.progress >= 1) {
      if (projectile.projectileType === "hook" && projectile.target.lifeState === "alive") {
        const pullPoint = resolveWalkableGround(
          player.actor.root.position.x + Math.sin(player.actor.root.rotation.y) * 2.1,
          player.actor.root.position.z + Math.cos(player.actor.root.rotation.y) * 2.1,
          projectile.target.root.position.y,
        );
        if (pullPoint) {
          projectile.target.root.position.copy(pullPoint);
          projectile.target.homeY = pullPoint.y;
        }
      }
      if (projectile.isSkill && projectile.skillStyle) {
        createImpactEffect(
          projectile.target.root.position,
          projectile.team,
          projectile.skillStyle.impactScale,
          projectile.skillStyle,
        );
      }
      applyDamage(
        projectile.target,
        projectile.damage,
        projectile.team,
        projectile.isSkill,
      );
      scene.remove(projectile.mesh);
      projectiles.splice(index, 1);
      continue;
    }

    projectile.mesh.position.lerpVectors(
      projectile.start,
      projectile.end,
      projectile.progress,
    );
    if (!projectile.straight) {
      projectile.mesh.position.y += Math.sin(projectile.progress * Math.PI) * 1.15;
      projectile.mesh.rotation.y += delta * 8;
    } else {
      tempDirection.subVectors(projectile.end, projectile.start).normalize();
      if (tempDirection.lengthSq() > 0.0001) {
        projectile.mesh.lookAt(projectile.mesh.position.clone().add(tempDirection));
      }
    }
    if (projectile.projectileType === "hook") {
      projectile.mesh.rotation.x += delta * 8;
    }
  }
}

function updateImpactEffects(delta) {
  for (let index = impactEffects.length - 1; index >= 0; index -= 1) {
    const effect = impactEffects[index];
    effect.age += delta;
    const progress = effect.age / effect.life;

    if (progress >= 1) {
      scene.remove(effect.mesh);
      impactEffects.splice(index, 1);
      continue;
    }

    effect.mesh.scale.setScalar(1 + progress * (effect.style?.impactScale ? 0.85 : 1.25));
    effect.mesh.material.opacity = 0.9 * (1 - progress);
  }
}

function updateMoveClickEffects(delta) {
  for (let index = moveClickEffects.length - 1; index >= 0; index -= 1) {
    const effect = moveClickEffects[index];
    effect.age += delta;
    const progress = effect.age / effect.life;

    if (progress >= 1) {
      scene.remove(effect.ring);
      scene.remove(effect.pulse);
      moveClickEffects.splice(index, 1);
      continue;
    }

    effect.ring.position.copy(effect.basePosition);
    effect.ring.position.y = effect.basePosition.y + 0.08 + Math.sin(progress * Math.PI) * 0.08;
    effect.ring.scale.setScalar(1 + progress * 1.6);
    effect.ring.material.opacity = 0.95 * (1 - progress);
    effect.ring.rotation.z += delta * 2.8;

    effect.pulse.position.copy(effect.basePosition);
    effect.pulse.position.y = effect.basePosition.y + 0.06;
    effect.pulse.scale.setScalar(1 + progress * 2.3);
    effect.pulse.material.opacity = 0.5 * (1 - progress);
  }
}

function updateDamagePopups(delta) {
  for (let index = damagePopups.length - 1; index >= 0; index -= 1) {
    const popup = damagePopups[index];
    popup.life -= delta;
    popup.worldPosition.y += delta * popup.drift;

    if (popup.life <= 0) {
      popup.element.remove();
      damagePopups.splice(index, 1);
      continue;
    }

    positionFloatingElement(
      popup.element,
      popup.worldPosition,
      1 - popup.life / popup.totalLife,
    );
    popup.element.style.opacity = String(popup.life / popup.totalLife);
  }
}

function updateGoldPopups(delta) {
  for (let index = goldPopups.length - 1; index >= 0; index -= 1) {
    const popup = goldPopups[index];
    popup.life -= delta;
    popup.worldPosition.y += delta * 0.9;

    if (popup.life <= 0) {
      popup.element.remove();
      goldPopups.splice(index, 1);
      continue;
    }

    positionFloatingElement(
      popup.element,
      popup.worldPosition,
      1 - popup.life / popup.totalLife,
    );
    popup.element.style.opacity = String(popup.life / popup.totalLife);
  }
}

function updatePlayerSkillEffects(delta) {
  if (player.katarinaUltimateTimer > 0 && player.actor?.lifeState === "alive") {
    player.katarinaUltimateTimer -= delta;
    player.katarinaUltimateTick -= delta;

    createImpactEffect(player.actor.root.position, player.actor.team, 1.4, {
      color: "#ff78ad",
      impactScale: 1.5,
    });

    if (player.katarinaUltimateTick <= 0) {
      player.katarinaUltimateTick = 0.24;
      actors.forEach((actor) => {
        if (actor.kind !== "minion" || !actor.root.visible || actor.lifeState !== "alive") return;
        if (actor.root.position.distanceTo(player.actor.root.position) > 5.2) return;
        applyDamage(actor, 12, player.actor.team, true);
      });
    }

    if (player.katarinaUltimateTimer <= 0) {
      player.katarinaUltimateTimer = 0;
      setActorAnimation(player.actor.animationController, "idle", { force: true });
    }
  }

  for (let index = playerSkillEffects.length - 1; index >= 0; index -= 1) {
    const effect = playerSkillEffects[index];
    effect.elapsed += delta;

    if (effect.type === "trap") {
      effect.mesh.rotation.z += delta * 1.8;
      const progress = effect.elapsed / effect.life;
      effect.mesh.scale.setScalar(effect.elapsed < effect.armDelay ? 0.8 : 1 + Math.sin(effect.elapsed * 7) * 0.06);
      effect.mesh.material.opacity = effect.elapsed < effect.armDelay ? 0.45 : 0.9 * (1 - progress * 0.5);

      if (!effect.triggered && effect.elapsed >= effect.armDelay) {
        effect.triggered = true;
        effect.onTrigger();
      }

      if (effect.elapsed >= effect.life) {
        scene.remove(effect.mesh);
        playerSkillEffects.splice(index, 1);
      }
    }
  }
}

function beginVictory(winner) {
  if (game.phase !== "battle") return;

  setGamePhase("victory", winner);
  game.resultTimer = 2.6;

  actors.forEach((actor) => {
    if (actor.lifeState !== "alive") return;
    if (actor.team === winner) {
      createImpactEffect(actor.root.position, winner, 1.9);
      setActorAnimation(actor.animationController, "victory", {
        loopOnce: false,
        force: true,
      });
    } else {
      setActorAnimation(actor.animationController, "idle", { force: true });
    }
  });
}

function updateRoundFlow(delta) {
  if (game.phase === "victory") {
    game.resultTimer -= delta;
    if (game.resultTimer <= 0) {
      setGamePhase("transition", game.winner);
      game.transitionTimer = 1.5;
    }
  }

  if (game.phase === "transition") {
    game.transitionTimer -= delta;
    if (game.transitionTimer <= 0) {
      resetRound();
      setGamePhase("idle");
    }
  }
}

function updateHealthBar(actor) {
  const ratio = actor.health / actor.maxHealth;
  actor.hud.fill.style.width = `${Math.max(ratio, 0) * 100}%`;
  actor.hud.container.style.display = actor.lifeState === "dead" ? "none" : "block";
}

function updateGoldUI() {
  goldValue.textContent = `${player.gold}`;
  goldHud.classList.remove("pulse");
  void goldHud.offsetWidth;
  goldHud.classList.add("pulse");
}

function updateHealthBars() {
  actors.forEach((actor) => {
    if (actor.lifeState === "dead" || !actor.root.visible) return;

    tempWorldPosition.copy(actor.root.position);
    tempWorldPosition.y += actor.height + 1.05;
    positionFloatingElement(actor.hud.container, tempWorldPosition, 0);
  });
}

function positionFloatingElement(element, worldPosition, extraLift) {
  const projected = worldPosition.clone();
  projected.y += extraLift * 0.8;
  projected.project(camera);

  const visible = projected.z > -1 && projected.z < 1;
  if (!visible) {
    element.style.display = "none";
    return;
  }

  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

  element.style.display = "block";
  element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
}

function updateCamera(delta) {
  if (!player.actor) {
    cameraTarget.lerp(arenaCenter, 1 - Math.exp(-delta * 3));
    controls.target.lerp(cameraTarget, 1 - Math.exp(-delta * 4));
    controls.update();
    return;
  }

  const zoomBlend = getFirstPersonBlend();
  playerAnchor.copy(player.actor.root.position);
  playerAnchor.y += THREE.MathUtils.lerp(
    player.actor.height * 0.58,
    player.actor.height * 0.9,
    zoomBlend,
  );
  desiredCameraTarget.copy(playerAnchor);
  cameraDelta.subVectors(desiredCameraTarget, controls.target);

  controls.target.addScaledVector(cameraDelta, 1 - Math.exp(-delta * CAMERA_CONFIG.followLerp));
  camera.position.addScaledVector(cameraDelta, 1 - Math.exp(-delta * CAMERA_CONFIG.followLerp));
  controls.update();
}

function snapCameraToPlayer() {
  if (!player.actor) return;

  playerAnchor.copy(player.actor.root.position);
  playerAnchor.y += player.actor.height * 0.58;
  controls.target.copy(playerAnchor);
  camera.position.copy(playerAnchor).add(new THREE.Vector3(0, 4.7, CAMERA_CONFIG.defaultDistance));
  controls.update();
}

function getFirstPersonBlend() {
  const distance = controls.getDistance();
  return THREE.MathUtils.clamp(
    1 - (distance - CAMERA_CONFIG.minDistance) / 2.25,
    0,
    1,
  );
}

function updatePlayerShadow() {
  if (!player.actor?.shadowMesh) return;

  const shadow = player.actor.shadowMesh;
  shadow.visible = player.actor.root.visible;
  if (!shadow.visible) return;

  shadow.position.set(
    player.actor.root.position.x,
    player.actor.homeY + 0.04,
    player.actor.root.position.z,
  );

  const airHeight = Math.max(0, player.actor.root.position.y - player.actor.homeY);
  const scale = THREE.MathUtils.clamp(1 - airHeight * 0.06, 0.45, 1);
  shadow.scale.setScalar(scale);
  shadow.material.opacity = THREE.MathUtils.clamp(0.2 - airHeight * 0.018, 0.06, 0.2);
}

function tick() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  mixers.forEach((mixer) => mixer.update(delta));
  updateCharacterPreviews(delta, elapsed);
  updateSkySystem(elapsed);

  updatePlayerInput(delta);

  if (game.phase === "battle") {
    updateBattle(delta);
  } else {
    updateIdleActors(elapsed);
  }

  updateScheduledStrikes(delta);
  updateProjectiles(delta);
  updateDeaths(delta);
  updateImpactEffects(delta);
  updateMoveClickEffects(delta);
  updateDamagePopups(delta);
  updateGoldPopups(delta);
  updatePlayerSkillEffects(delta);
  updateMinionRespawns(delta);
  updateRoundFlow(delta);
  updateCamera(delta);
  updatePlayerShadow();
  renderer.render(scene, camera);
  updateHealthBars();

  window.requestAnimationFrame(tick);
}

function onResize() {
  syncMobileHudVisibility();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeCharacterPreviews();
  controls.update();
}
