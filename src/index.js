import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import {getFullscreenTriangle} from "fxhash_lib/geometries";
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import { downloadPNG } from "fxhash_lib/export";
import {FluidController} from "./FluidController";

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
  dotScale: 0,
  rgbShift: 0,
};

let screenTriangle, screen;

const {cam, scene, renderer} = core.init(options);

if (devMode) {
  core.initControls(cam);
  dev.initGui();
  dev.initEffects(effects);
  dev.hideGuiSaveRow();
}

//core.lookAt(new THREE.Vector3(0, 0, 0));

// Feature generation
let features = {
  Palette: FXRand.choice(['Black&White', 'Mono', 'Analogous', 'Complementary']),
}

window.$fxhashFeatures = features;

const renderFrame = (event) => {
  core.update();
  dev.update();
  FluidController.update();
  //core.render();
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

screenTriangle = getFullscreenTriangle();
screen = new THREE.Mesh(screenTriangle);
screen.frustumCulled = false;
core.scene.add(screen);

FluidController.init(core.renderer, core.scene, core.cam, screen, options);
FluidController.resize(core.width, core.height, 1);
FluidController.animateIn();

core.useEffects(effects);
core.animate();

addEventListeners();

fxpreview();