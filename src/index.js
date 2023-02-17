import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import {getFullscreenTriangle} from "fxhash_lib/geometries";
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import { downloadPNG } from "fxhash_lib/export";
import {FluidController} from "./FluidController";
import {generateColors} from "../../fxhash_lib/color";

const devMode = true;
const options = {
  numPointers: 22, // iOS limit
  blendModePass: FXRand.int(0, 5),
  blendModeView: FXRand.int(2, 5),
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
  folder.add(options, 'blendModePass', 0, 5);
  folder.add(options, 'blendModeView', 2, 5);
}

if (devMode) {
  core.initControls(cam);
  gui = dev.initGui();
  createGUI(gui);
  dev.initEffects(effects);
  dev.hideGuiSaveRow();
}

//core.lookAt(new THREE.Vector3(0, 0, 0));

// Feature generation
let features = {
  Palette: FXRand.choice(['Black&White', 'Mono', 'Analogous', 'Complementary']),
  BlendModePass: options.blendModePass,
  BlendModeView: options.blendModeView,
  ColorW: FXRand.int(1, 100),
}

window.$fxhashFeatures = features;

let colors = generateColors(features.Palette);
scene.background = colors[0];

const renderFrame = (event) => {
  core.update();
  dev.update();
  FluidController.update(renderer, scene, cam);
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
  if (!dev.isGui(event.target)) {
    document.location.reload();
  }
}

const addEventListeners = () => {
  document.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("resize", onResize);
  window.addEventListener('renderFrame', renderFrame);
  if (devMode) {
    window.addEventListener("dblclick", onDblClick);
  }
}

scene.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0, 0)})));

screenTriangle = getFullscreenTriangle();
screen = new THREE.Mesh(screenTriangle);
screen.frustumCulled = false;
scene.add(screen);

FluidController.init(screen, options);
FluidController.color = new THREE.Vector4(colors[1].r*256, colors[1].g*256, colors[1].b*256, features.ColorW);
FluidController.resize(core.width, core.height, 1);
FluidController.animateIn();

core.useEffects(effects);
core.animate();

addEventListeners();

fxpreview();