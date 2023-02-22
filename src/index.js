import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import * as mats from "fxhash_lib/materials";
import {FluidLayer} from "./FluidLayer";
import {generateColor} from "../../fxhash_lib/color";
import {FluidStroke} from "./FluidStroke";
import {devMode, settings, options, layerOptions, lightOptions, effects, chooseComposition, choosePalette} from "./config"
import {createGUI, createLayerGUI} from "./gui";
import {renderer, scene, cam} from "fxhash_lib/core";
import {initVars, palette, hslPalette, colors, comp, layers, strokesPerLayer, histPingPong, histMesh, labels, features} from "./vars";

const sketch = {};
setup();

function setup() {
  if (devMode) {
    dev.initGui(settings.name);
    createGUI(dev.gui);
  }

  initVars();

  core.init(Object.assign({}, settings, {
    alpha: comp === 'cells',
  }));
  //const {camLight, sunLight, ambLight} = core.initLights(lightOptions);
  core.initCSS2DRenderer();

  if (devMode) {
    //core.initControls(cam);
    dev.initHelpers();
    //dev.initLighting(lightOptions);
    dev.initEffects(effects);
    dev.hideGuiSaveRow();
  }

  // cam.position.x = 1024;
  // cam.position.y = 512;
  // cam.position.z = 1024;
  // core.lookAt(new THREE.Vector3(0, 0, 0));

  if (comp !== 'cells') {
    scene.background = colors[0];
  }

  //scene.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0, 0)})));

  for (let i=0; i<features.layers; i++) {
    addLayer(strokesPerLayer);
  }
  switch (comp) {
    case 'cells':
      createCell();
      break;
  }

  core.useEffects(effects);
  core.animate();

  addEventListeners();

  fxpreview();
}

function addLayer(numStrokes) {
  const i = layers.length;
  layerOptions.push(generateOptions(i));
  if (devMode) {
    createLayerGUI(dev.gui, layers, i);
  }
  const layer = createLayer(numStrokes);
  createStrokes(layer, i);
}

function createLayer(numStrokes) {
  const i = layers.length;
  layers[i] = new FluidLayer(Object.assign({}, layerOptions[i], {
    numStrokes,
    maxIterations: options.maxIterations,
    bgColor: colors[0],
    transparent: comp === 'cells',
  }));
  setLayerColor(layers[i], colors[1]);
  layers[i].resize(core.width, core.height, 1);
  const mesh = layers[i].initMesh();
  scene.add(mesh);
  return layers[i];
}

function createStrokes(layer, i) {
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

function renderToHist() {
  histPingPong.render(renderer, scene, cam);
  histPingPong.swap();

  if (histMesh) {
    histMesh.material.uniforms.tMap.value = histPingPong.texture;
    histMesh.material.needsUpdate = true;
  }
  else {
    histMesh.material = mats.fullScreenMap({
      blending: THREE.CustomBlending,
      transparent: true,
    }, {
      map: histPingPong.texture,
    });
    scene.add(histMesh);
  }
}

function resetLayer(layer) {
  layer.initRenderer();
  regenerateLayer(layer);
  for (let j=0; j<layer.strokes.length; j++) {
    const speed = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
    layer.strokes[j].speed = speed;
    layer.strokes[j].reset();
  }
  const color = generateColor(palette, hslPalette[0]);
  setLayerColor(layer, color);
}

function setLayerColor(layer, color) {
  layer.color = new THREE.Vector4(color.r*256, color.g*256, color.b*256, features.colorW);
}

function regenerateLayer(layer) {
  const i = layers.indexOf(layer);
  Object.assign(layerOptions[i], generateOptions(i));
  layer.setOptions(layerOptions[i]);
}

function generateOptions(i) {
  const minDt = [0.25, 0.25, 0.4, 0.1, 0.3, 0.1];
  let opts;
  do {
    const blendModePass = FXRand.int(0, i > 0 ? 4 : 5);
    const blendModeView = comp === 'cells' ? 2 : FXRand.int(2, blendModePass === 3 ? 3 : 5);
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

function validateOptions(options, i) {
  return true;
  const invalidBlends = ['4-4'];
  const blendModeString = options.blendModePass+'-'+options.blendModeView;
  if (invalidBlends.indexOf(blendModeString) > -1) {
    return false;
  }
  if (i > 0 && [2, 4].indexOf(options.blendModeView) > -1 && options.blendModeView === layerOptions[i-1].blendModeView) {
    return false;
  }
  if (palette === 'Black&White') {
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
  else if (palette === 'Mono') {
    if (i > 0 && ['2-3', '2-5'].indexOf(blendModeString) > -1) {
      return false;
    }
    if (blendModeString === '3-2' && options.dt < 0.7) {
      return false;
    }
  }
  else if (palette === 'Analogous') {
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

let numCells = 0;
const doCreateCell = () => {
  numCells++;
  renderToHist();
  layers.map((layer) => {
    regenerateLayer(layer);
  });
}

let timeoutID = -1;
function createCell() {
  if (timeoutID > 0) {
    clearTimeout(timeoutID);
    doCreateCell();
  }
  if (numCells < options.maxCells) {
    timeoutID = setTimeout(createCell, FXRand.int(500, 7000));
  }
  else {
    // todo: add diagonal animation effect
  }
}

function draw(event) {
  core.update();
  dev.update();
  for (let i=0; i<layers.length; i++) {
    if (layers[i].mesh.visible) {
      layers[i].update(renderer, scene, cam);
    }
  }
  core.render();
}

function onClick(event) {
  switch (comp) {
    case 'addnew':
      addLayer(strokesPerLayer);
      break;
    case 'reset':
      layers.map((layer) => {
        resetLayer(layer);
      });
      break
    case 'regenerate':
      layers.map((layer) => {
        layer.renderPingPong.swap();
        regenerateLayer(layer);
      });
      break;
    case 'cells':
    default:
      createCell();
      break
  }
}

function onKeyDown(event) {
  if (devMode) {
    dev.keyDown(event, settings, lightOptions, effects);
  }
}

function onResize(event) {
  core.resize(window.innerWidth, window.innerHeight);
  for (let i=0; i<layers.length; i++) {
    layers[i].resize(window.innerWidth, window.innerHeight, 1);
  }
}

function onDblClick(event) {
  if (devMode && !dev.isGui(event.target)) {
    document.location.reload();
  }
}

function addEventListeners() {
  window.addEventListener('renderFrame', draw);
  renderer.domElement.addEventListener('click', onClick);
  document.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("resize", onResize);
  if (devMode) {
    window.addEventListener("dblclick", onDblClick);
  }
}