import * as THREE from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import * as FXRand from 'fxhash_lib/random.js'
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import {FluidController} from "./FluidController";
import {generateHSLPalette, hsl2Color, generateColor} from "../../fxhash_lib/color";

const name = 'fluid';
const devMode = true;

const settings = {
  name,
};

const options = {
  numPointers: 22, // iOS limit
  blendModePass: 0,
  blendModeView: 2,
  dt: 0.15,
  K: 0.2,
  nu: 0.5,
  kappa: 0.1,
  speed: 0.01,
};

const lightOptions = {};

const effects = {
  enabled: true,
  hBlur: 1 / window.innerWidth / 2,
  vBlur: 1 / window.innerHeight / 2,
  noiseIntensity: 0.35,
  scanlinesIntensity: 0.25,
  scanlinesCount: 0,
  grayscale: true,
  dotScreen: false,
  dotScale: 0,
  rgbShift: 0,
};

const createGUI = (gui) => {
  gui.remember(options);

  const folder = gui.addFolder('Options');
  folder.add(options, 'numPointers', 1, 22);
  folder.add(options, 'blendModePass', 0, 5, 1).listen();
  folder.add(options, 'blendModeView', 2, 5, 1).listen();
  folder.add(options, 'dt', 0, 1, 0.01).listen();
  folder.add(options, 'K', 0, 1, 0.01).listen();
  folder.add(options, 'nu', 0, 1, 0.01).listen();
  folder.add(options, 'kappa', 0, 1, 0.01).listen();
  folder.add(options, 'speed', 0, 0.1, 0.001);
}

if (devMode) {
  dev.initGui(name);
  createGUI(dev.gui);
}

let screen;
const {cam, scene, renderer} = core.init(settings);

if (devMode) {
  //core.initControls(cam);
  dev.initEffects(effects);
  dev.hideGuiSaveRow();
}

cam.position.x = 1024;
cam.position.y = 512;
cam.position.z = 1024;
core.lookAt(new THREE.Vector3(0, 0, 0));

// Feature generation
let features = {
  palette: FXRand.choice(['Black&White', 'Mono', 'Analogous', 'Complementary']),
  blendModePass: FXRand.int(0, 5),
  blendModeView: FXRand.int(2, 5),
  colorW: FXRand.exp(0.1, 8),
  dt: FXRand.num(0.1, 0.3),
  K: FXRand.num(0.2, 0.7),
  nu: FXRand.num(0.4, 0.6),
  kappa: FXRand.num(0.1, 0.9),
}

window.$fxhashFeatures = features;
Object.assign(options, features);

const hslPalette = generateHSLPalette(features.palette);
const colors = hslPalette.map(hsl2Color);
scene.background = colors[0];

const renderFrame = (event) => {
  core.update();
  dev.update();
  FluidController.update(screen, renderer, scene, cam);
  core.render();
}

const onKeyDown = (event) => {
  if (devMode) {
    dev.keyDown(event, settings, lightOptions, effects);
  }
}

const onResize = (event) => {
  core.resize(window.innerWidth, window.innerHeight);
  FluidController.resize(window.innerWidth, window.innerHeight, 1);
}

const onDblClick = (event) => {
  if (devMode && !dev.isGui(event.target)) {
    document.location.reload();
  }
}

const addEventListeners = () => {
  document.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("resize", onResize);
  window.addEventListener('renderFrame', renderFrame);
  renderer.domElement.addEventListener('click', onClick);
  if (devMode) {
    window.addEventListener("dblclick", onDblClick);
  }
}

const createScreen = (remove = true) => {
  if (remove && screen) {
    scene.remove(screen);
  }
  screen = (new FullScreenQuad()._mesh);
  screen.frustumCulled = false;
  scene.add(screen);
}

FluidController.init(options);
FluidController.resize(core.width, core.height, 1);
for (let i=0; i<options.numPointers-1; i++) {
  FluidController.setPointer('test' + i, FXRand.num(), FXRand.num(), FXRand.bool());
  FluidController.setPointer('test' + i, FXRand.num(), FXRand.num(), FXRand.bool());
}
createScreen();

const onClick = (event) => {
  FluidController.initRenderer();
  FluidController.setOptions(options);
  for (let i=0; i<options.numPointers-1; i++) {
    FluidController.pointers['test' + i].reset();
  }
  //const color = generateColor(options.palette, hslPalette[0]);
  const color = colors[1];
  FluidController.color = new THREE.Vector4(color.r*256, color.g*256, color.b*256, options.colorW);
}

scene.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0, 0)})));

onClick();

core.useEffects(effects);
core.animate();

addEventListeners();

fxpreview();