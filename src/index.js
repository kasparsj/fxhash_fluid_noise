import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import {FluidLayer} from "./FluidLayer";
import {generateHSLPalette, hsl2Color, generateColor} from "../../fxhash_lib/color";
import {FluidStroke} from "./FluidStroke";

const name = 'fluid';
const devMode = true;

const settings = {
  name,
};

const options = {
  minLayers: 2,
  maxLayers: 3,
  minStrokes: 1,
  maxStrokes: 2, // iOS limit
  minSpeed: 0.001,
  maxSpeed: 0.01,
  speedMult: 1,
  strokesRel: 'mirrorRand',
  onClick: 'resetLayers',
  onReset: '',
};

const palettes = {
  'Black&White': true,
  'Mono': true,
  'Analogous': true,
  'Complementary': true,
};

const layerOptions = [];

const lightOptions = {
  ambLight: true,
  ambColor: 0x404040,
  ambIntensity: 0.1,
  camLight: true,
  camLightColor: 0xFFFFFF,
  camLightIntensity: 0.5,
  sunLight: true,
  sunLightColor: 0xFFFFFF,
  sunLightIntensity: 0.7,
  sunElevation: 45,
  sunAzimuth: 90,
  hemiLight: true,
  hemiSkyColor: 0x3284ff,
  hemiGroundColor: 0xffffff,
  hemiIntensity: 0.6,
};

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
  folder.add(options, 'minLayers', 1, 5, 1);
  folder.add(options, 'maxLayers', 1, 5, 1);
  folder.add(options, 'minStrokes', 1, 22, 1);
  folder.add(options, 'maxStrokes', 1, 22, 1);
  folder.add(options, 'strokesRel', ['same', 'mirror', 'mirrorX', 'mirrorY', 'mirrorRand', 'random']);
  folder.add(options, 'minSpeed', 0.001, 0.01, 0.001).listen();
  folder.add(options, 'maxSpeed', 0.01, 0.1, 0.001).listen();

  createColorGui(gui);
}

const createColorGui = (gui) => {
  gui.remember(palettes);

  const folder = gui.addFolder('Colors');
  for (let p in palettes) {
    folder.add(palettes, p);
  }
}

const createLayerGui = (gui, i) => {
  const folder = gui.addFolder('Layer '+i);
  const updateLayer = () => {
    layers[i].setOptions(layerOptions[i]);
    layers[i].initRenderer();
  }
  folder.add(layerOptions[i], 'blendModePass', 0, 5, 1).listen().onChange(updateLayer);
  folder.add(layerOptions[i], 'blendModeView', 2, 5, 1).listen().onChange(updateLayer);
  folder.add(layerOptions[i], 'dt', 0, 1, 0.01).listen().onChange(updateLayer);
  folder.add(layerOptions[i], 'K', 0, 1, 0.01).listen().onChange(updateLayer);
  folder.add(layerOptions[i], 'nu', 0, 1, 0.01).listen().onChange(updateLayer);
  folder.add(layerOptions[i], 'kappa', 0, 1, 0.01).listen().onChange(updateLayer);
}

if (devMode) {
  dev.initGui(name);
  createGUI(dev.gui);
}

const {cam, scene, renderer} = core.init(settings);
//const {camLight, sunLight, ambLight} = core.initLights(lightOptions);
const labelRenderer = core.initCSS2DRenderer();
let includedPalettes = Object.keys(palettes).filter((palette) => {
  return palettes[palette] === true;
});
const layers = [];
const strokesPerLayer = FXRand.int(options.minStrokes, options.maxStrokes);
const labels = new THREE.Group();

if (devMode) {
  //core.initControls(cam);
  dev.initHelpers();
  //dev.initLighting(lightOptions);
  dev.initEffects(effects);
  dev.hideGuiSaveRow();
}

cam.position.x = 1024;
cam.position.y = 512;
cam.position.z = 1024;
core.lookAt(new THREE.Vector3(0, 0, 0));

// Feature generation
let features = {
  palette: FXRand.choice(includedPalettes),
  layers: FXRand.int(options.minLayers, options.maxLayers),
  colorW: FXRand.exp(0.1, 8),
}
Object.assign(features, layerOptions[0]);

window.$fxhashFeatures = features;

const hslPalette = generateHSLPalette(features.palette);
const colors = hslPalette.map(hsl2Color);
scene.background = colors[0];

const validateOptions = (options, i) => {
  const invalidBlends = ['4-4'];
  const blendModeString = options.blendModePass+'-'+options.blendModeView;
  if (invalidBlends.indexOf(blendModeString) > -1) {
    return false;
  }
  if (i > 0 && [2, 4].indexOf(options.blendModeView) > -1 && options.blendModeView === layerOptions[i-1].blendModeView) {
    return false;
  }
  if (features.palette === 'Black&White') {
    const invalidBWBlends = ['1-2'];
    if (invalidBWBlends.indexOf(blendModeString) > -1) {
      return false;
    }
    if (hslPalette[0][2] < 0.5) {
      if (blendModeString === '0-4' && options.dt < 0.5) {
        return false;
      }
      if (['0-3', '2-5'].indexOf(blendModeString) > -1 && options.dt < 0.75) {
        return false;
      }
      if (['2-3', '3-2', '3-3', '4-3'].indexOf(blendModeString) > -1) {
        return false;
      }
    }
    else {
      if (blendModeString === '0-2') {
        return false;
      }
      if (['0-3', '2-5'].indexOf(blendModeString) > -1 && options.dt < 0.45) {
        return false;
      }
      if (blendModeString === '2-3' && options.dt < 0.8) {
        return false;
      }
    }
    if (blendModeString === '0-5' && options.dt < 0.25) {
      return false;
    }
    if (['1-3', '1-4'].indexOf(blendModeString) > -1 && options.dt < 0.3) {
      return false;
    }
    if (blendModeString === '2-4' && options.dt < 0.7) {
      return false;
    }
    if (['4-2', '4-5'].indexOf(blendModeString) > -1 && options.dt < 0.5) {
      return false;
    }
  }
  else if (features.palette === 'Mono') {
    if (i > 0 && ['2-3', '2-5'].indexOf(blendModeString) > -1) {
      return false;
    }
    if (blendModeString === '3-2' && options.dt < 0.7) {
      return false;
    }
  }
  else if (features.palette === 'Analogous') {
    if (['2-5'].indexOf(blendModeString) > -1) {
      return false;
    }
    if (i > 0 && ['1-4', '2-2', '3-2'].indexOf(blendModeString) > -1) {
      return false;
    }
    if (['0-3', '0-5', '1-5'].indexOf(blendModeString) > -1 && options.dt < 0.5) {
      return false;
    }
    if (['1-2', '1-3', '1-4'].indexOf(blendModeString) > -1 && options.dt < 0.3) {
      return false;
    }
    if (['2-3', '3-2', '4-2', '4-3'].indexOf(blendModeString) > -1 && options.dt < 0.6) {
      return false;
    }
    if (['2-4'].indexOf(blendModeString) > -1 && options.dt < 0.75) {
      return false;
    }
    if (blendModeString === '4-5' && options.dt < 0.5) {
      return false;
    }
  }
  if (blendModeString === '0-4' && options.dt < 0.3) {
    return false;
  }
  if (blendModeString === '1-5' && options.dt < 0.3) {
    return false;
  }
  if (blendModeString === '2-2' && options.dt < 0.8) {
    return false;
  }
  if (blendModeString === '2-4' && options.dt < 0.5) {
    return false;
  }
  if (blendModeString === '3-2' && options.dt < 0.4) {
    return false;
  }
  if (blendModeString === '3-3' && options.dt < 0.45) {
    return false;
  }
  return true;
}

const generateOptions = (i) => {
  const minDt = [0.25, 0.25, 0.4, 0.1, 0.3, 0.1];
  let opts;
  do {
    const blendModePass = FXRand.int(0, i > 0 ? 4 : 5);
    const blendModeView = FXRand.int(2, blendModePass === 3 ? 3 : 5);
    opts = {
      blendModePass,
      blendModeView,
      dt: FXRand.num(minDt[blendModePass], 1.0),
      K: FXRand.num(0.2, 0.7),
      nu: FXRand.num(0.4, 0.6),
      kappa: FXRand.num(0.1, 0.9),
    };
  } while (!validateOptions(opts, i));
  return opts;
}

const renderFrame = (event) => {
  core.update();
  dev.update();
  for (let i=0; i<layers.length; i++) {
    layers[i].update(renderer, scene, cam);
  }
  core.render();
}

const onKeyDown = (event) => {
  if (devMode) {
    dev.keyDown(event, settings, lightOptions, effects);
  }
}

const onResize = (event) => {
  core.resize(window.innerWidth, window.innerHeight);
  for (let i=0; i<layers.length; i++) {
    layers[i].resize(window.innerWidth, window.innerHeight, 1);
  }
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

const createLayer = (numStrokes) => {
  const i = layers.length;
  layers[i] = new FluidLayer(Object.assign({}, layerOptions[i], {
    numStrokes,
  }));
  layers[i].resize(core.width, core.height, 1);
  scene.add(layers[i].createMesh());
  return layers[i];
}

const createStrokes = (layer, i) => {
  const numStrokes = layer.options.numStrokes;
  for (let j=0; j<numStrokes; j++) {
    let stroke;
    if (i === 0 || options.strokesRel === 'random') {
      // first layer all strokes are random
      const speed = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
      const isDown = FXRand.bool();
      stroke = new FluidStroke(FXRand.num(), FXRand.num());
      stroke.speed = speed;
      stroke.isDown = isDown;
      stroke.target.set(FXRand.num(), FXRand.num());
    }
    else {
      let sr = options.strokesRel;
      if (sr === 'mirrorRand') {
        sr = FXRand.choice(['mirror', 'mirrorX', 'mirrorY']);
      }
      switch (sr) {
        case 'same':
          stroke = layers[0].strokes[j].clone();
          break;
        case 'mirror':
        case 'mirrorX':
        case 'mirrorY':
        default:
          stroke = layers[0].strokes[j].clone()[sr || 'mirror']();
          break;
      }
    }
    layer.addStroke(stroke);
  }
}

const resetLayer = (layer) => {
  // layer.initRenderer();
  layer.swapRenderTargets();
  for (let j=0; j<layer.strokes.length; j++) {
    if (options.strokesRel === 'random' && options.onReset === 'randomSpeed') {
      const speed = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
      layer.strokes[j].speed = speed;
    }
    layer.strokes[j].reset();
  }
  // const color = generateColor(options.palette, hslPalette[0]);
  const color = colors[1];
  layer.color = new THREE.Vector4(color.r*256, color.g*256, color.b*256, features.colorW);
}

const resetLayers = (regenerate = false) => {
  for (let i=0; i<layers.length; i++) {
    if (regenerate) {
      Object.assign(layerOptions[i], generateOptions(i));
      layers[i].setOptions(layerOptions[i]);
    }
    resetLayer(layers[i]);
  }
}

const addLayer = (numStrokes) => {
  const i = layers.length;
  layerOptions.push(generateOptions(i));
  if (devMode) {
    createLayerGui(dev.gui, i);
  }
  const layer = createLayer(numStrokes);
  createStrokes(layer, i);
}

const onClick = (event) => {
  switch (options.onClick) {
    case 'addLayer':
      addLayer(strokesPerLayer);
      break;
    case 'resetLayers':
    default:
      resetLayers(event);
      break
  }
}

//scene.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0, 0)})));

for (let i=0; i<features.layers; i++) {
  addLayer(strokesPerLayer);
}

core.useEffects(effects);
core.animate();

addEventListeners();

fxpreview();