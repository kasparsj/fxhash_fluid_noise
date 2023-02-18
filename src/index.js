import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import {getFullscreenTriangle} from "fxhash_lib/geometries";
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import { downloadPNG } from "fxhash_lib/export";
import {FluidController} from "./FluidController";
import {generateHSLPalette, hsl2Color, generateColor} from "../../fxhash_lib/color";

const devMode = true;
const options = {
  numPointers: 22, // iOS limit
};

const effects = {
  enabled: true,
  hBlur: 1 / window.innerWidth / 2,
  vBlur: 1 / window.innerHeight / 2,
  noiseIntensity: 0.35,
  scanlinesIntensity: 0.25,
  scanlinesCount: 0,
  grayscale: true,
  //dotScale: 0,
  rgbShift: 0,
};

let screenTriangle, screen, gui;

const {cam, scene, renderer} = core.init(options);

const createGUI = (gui) => {
  gui.remember(options);

  const folder = gui.addFolder('Options');
  folder.add(options, 'numPointers', 1, 22);
}

if (devMode) {
  //core.initControls(cam);
  gui = dev.initGui();
  createGUI(gui);
  dev.initEffects(effects);
  dev.hideGuiSaveRow();
}

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

console.log(features);

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
  const k = event.which;
  // console.log(k);
  if (event.shiftKey) {
    switch (k) {
      default:
        dev.shiftKeyCommand(event, options);
        break;
    }
  }
  else if (event.ctrlKey || event.metaKey) {
    switch (k) {
      case 83: // s
        event.preventDefault();
        downloadPNG("snapshot" + (new Date().getTime()));
        break;
      default:
        dev.metaKeyCommand(event, options);
        break;
    }
  }
  else {
    switch (k) {
      case 32: // space
        core.togglePaused();
        break;
    }
    if (devMode) {
      switch (k) {
        case 82: // r
          renderFrame();
          break;
        default:
          dev.keyCommand(k, options)
          break;
      }
    }
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
  window.addEventListener('click', onClick)
  if (devMode) {
    window.addEventListener("dblclick", onDblClick);
  }
}

const onClick = (event) => {
  const color = generateColor(options.palette, hslPalette[0]);
  FluidController.color = new THREE.Vector4(color.r*256, color.g*256, color.b*256, options.colorW);
  for (let i=0; i<options.numPointers-1; i++) {
    FluidController.setPointer('test' + i, FXRand.num(), FXRand.num(), FXRand.bool());
    FluidController.setPointer('test' + i, FXRand.num(), FXRand.num(), FXRand.bool());
  }
}

scene.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0, 0)})));

screenTriangle = getFullscreenTriangle();
screen = new THREE.Mesh(screenTriangle);
screen.frustumCulled = false;
scene.add(screen);

FluidController.init(options);
FluidController.resize(core.width, core.height, 1);
onClick();

core.useEffects(effects);
core.animate();

addEventListeners();

fxpreview();