import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import * as effects from "fxhash_lib/effects";
import * as css2D from "fxhash_lib/css2D";
import {generateColor} from "fxhash_lib/color";
import {devMode, settings, options, layerOptions, lightOptions, effectOptions} from "./config"
import {createGUI, createLayerGUI} from "./gui";
import {renderer, scene, cam} from "fxhash_lib/core";
import {initVars, palette, hslPalette, colors, comp, layers, strokesPerLayer, debug, labels, features, vars} from "./vars";
import {FullScreenLayer} from "fxhash_lib/postprocessing/FullScreenLayer";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass";
import * as mats from "fxhash_lib/materials";
import {MaterialFBO} from "fxhash_lib/postprocessing/MaterialFBO";
import {FluidPass} from "fxhash_lib/postprocessing/FluidPass";
import {FluidLayer} from "fxhash_lib/postprocessing/FluidLayer";
import blackFluidViewFrag from "fxhash_lib/shaders/fluid/blackFluidView.frag";
import colorFluidViewFrag from "fxhash_lib/shaders/fluid/colorFluidView.frag";

let materialFBO;

setup();

function setup() {
  if (devMode) {
    dev.initGui(settings.name);
    createGUI(dev.gui);
  }

  initOptions();
  initVars();

  const initSettings = Object.assign({}, settings, {
    alpha: true,
  });
  core.init(initSettings);
  //lights.init(lightOptions);
  css2D.init();

  if (devMode) {
    dev.initHelpers();
    //dev.initLighting(lightOptions);
    dev.createEffectsGui(effectOptions);
    dev.hideGuiSaveRow();
  }

  cam.position.z = 1024;
  core.lookAt(new THREE.Vector3(0, 0, 0));

  createScene();

  effects.init(Object.assign({
    colorifyColor: new THREE.Color(0xFFD700),
  }, effectOptions));
  core.animate();

  addEventListeners();

  fxpreview();
}

function initOptions() {
  if (!options.hasOwnProperty('speedMult')) {
    options.speedMult = FXRand.num(0.1, 10);
  }
  if (!options.hasOwnProperty('snapBlending')) {
    //options.snapBlending = FXRand.choice([3, 5]);
    options.snapBlending = THREE.SubtractiveBlending;
    // options.snapBlending = THREE.CustomBlending;
  }
  if (!options.hasOwnProperty('maxChanges')) {
    options.maxChanges = FXRand.int(5, 9);
  }
}

function createScene() {
  switch (comp) {
    case 'box':
      scene.background = colors[0];
      createBoxComp();
      break;
    case 'random':
    case 'center':
    case 'mouse':
    default:
      createDefaultComp();
      if (!options.snapOverlay && palette !== 'Black&White') {
        scene.background = colors[0];
      }
      createSnapOverlay();
      scheduleChange();
      break;
  }
  scene.add(debug);
}

function createSnapOverlay() {
  vars.snapOverlay = new FullScreenLayer({
    type: THREE.HalfFloatType,
    blending: options.snapBlending,
    generateMipmaps: false,
    transparent: true,
  });
  vars.snapOverlay.composer.addPass(new RenderPass(scene, cam));
  vars.snapOverlay.mesh.visible = options.snapOverlay;
  scene.add(vars.snapOverlay.mesh);
}

function createDefaultComp() {
  for (let i=0; i<features.layers; i++) {
    addLayer(strokesPerLayer);
  }
}

function createBoxComp() {
  core.initControls(cam);

  layerOptions.push(generateOptions(0));

  const mat = mats.fluidViewUV({
    blending: layerOptions[0].blendModeView,
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(500, 500, 500), mat);
  scene.add(box);
  const edges = core.createEdges(box);
  scene.add(edges);

  materialFBO = new MaterialFBO({
    type: THREE.HalfFloatType,
  }, box.material);

  const fluidPass = new FluidPass(mats.fluidPass({
    blending: layerOptions[0].blendModePass,
    transparent: true,
  }), Object.assign({
    numStrokes: strokesPerLayer,
  }, Object.assign({
    maxIterations: options.maxIterations,
  }, layerOptions[0])));

  for (let i=0; i<strokesPerLayer; i++) {
    const stroke = createStroke(0, i);
    fluidPass.initStroke(i, stroke);
  }

  materialFBO.composer.addPass(fluidPass);
}

function addLayer(numStrokes) {
  const i = layers.length;
  layerOptions.push(generateOptions(i));
  if (devMode) {
    createLayerGUI(dev.gui, i);
  }
  const layer = createLayer(numStrokes);
  createStrokes(layer, i);
}

function createLayer(numStrokes) {
  const i = layers.length;
  const zoom = FXRand.exp(0.1, 10.0);
  //const filter = zoom > 1 ? FXRand.choice([THREE.NearestFilter, THREE.LinearFilter]) : THREE.LinearFilter;
  const filter = THREE.LinearFilter;
  layers[i] = new FluidLayer(renderer, scene, cam, Object.assign({}, layerOptions[i], {
    numStrokes,
    zoom: zoom,
    // zoom: 10,
    maxIterations: options.maxIterations,
    transparent: comp !== 'box',
    opacity: options.opacity,
    generateMipmaps: false,
    type: THREE.HalfFloatType,
    minFilter: filter,
    magFilter: filter,
    fragmentShader: colorFluidViewFrag,
  }));
  if (palette === 'Black&White') {
    layers[i].material.fragmentShader = blackFluidViewFrag;
    layers[i].material.needsUpdate = true;
  }
  setLayerColor(layers[i]);
  scene.add(layers[i].mesh);
  return layers[i];
}

function createStrokes(layer, i) {
  const numStrokes = layer.options.numStrokes;
  for (let j=0; j<numStrokes; j++) {
    const stroke = createStroke(i, j);
    if (stroke.isMouse) {
      layer.initMouseStroke(j, stroke);
    }
    else {
      layer.fluidPass.initStroke(j, stroke);
    }
  }
}

function createStroke(i, j) {
  let stroke;
  if (i === 0 || options.strokesRel === 'random') {
    // first layer all strokes are random
    const speed = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
    const pos = new THREE.Vector2(FXRand.num(), FXRand.num());
    const target = new THREE.Vector2(FXRand.num(), FXRand.num());
    switch (comp) {
      case 'random':
        stroke = {
          speed,
          isDown: FXRand.bool(),
          pos,
          target
        };
        break;
      case 'center':
        stroke = {
          isDown: true,
        };
        break;
      default:
      case 'mouse':
        stroke = {
          isMouse: true,
        }
        break;
    }
  }
  else {
    let sr = options.strokesRel;
    if (sr === 'mirrorRand') {
      sr = FXRand.choice(['mirror', 'mirrorX', 'mirrorY']);
    }
    switch (sr) {
      case 'same':
        stroke = layers[0].fluidPass.getStroke(j);
        break;
      case 'mirror':
      case 'mirrorX':
      case 'mirrorY':
      default:
        stroke = FluidPass[sr || 'mirror'](layers[0].fluidPass.getStroke(j));
        break;
    }
  }
  if (stroke.pos) {
    debug.add(core.createCross(core.toScreen(stroke.pos)));
  }
  return stroke;
}

function resetLayer(layer) {
  layer.reset();
  for (let j=0; j<layer.options.numStrokes; j++) {
    const speed = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
    layer.fluidPass.uniforms.uSpeed.value[j] = speed;
  }
  const i = layers.indexOf(layer);
  colors[i] = generateColor(palette, hslPalette[0]);
  setLayerColor(layer);
}

function setLayerColor(layer) {
  const i = layers.indexOf(layer);
  const color = i < colors.length ? colors[i] : colors[1];
  layer.color = new THREE.Vector4(color.r, color.g, color.b, features.colorW);
  // layer.color = new THREE.Vector4(10, 10, 10, 0.1);
  // layer.color = FXRand.choice([new THREE.Vector4(10, 10, 10, 0.1), new THREE.Vector4(0, 0, 10, 0.1)]);
}

function regenerateLayerOptions(layer, blendModes = false) {
  const i = layers.indexOf(layer);
  if (blendModes) {
    Object.assign(layerOptions[i], generateOptions(i));
  }
  else {
    Object.assign(layerOptions[i], generateFluidOptions(layerOptions[i], i));
  }
  layer.setOptions(layerOptions[i]);
}

function generateOptions(i) {
  const blendModePass = FXRand.choice([0, 1, 2]);
  const blendModeView = FXRand.choice([2, 5]);
  const opts = {
    visible: !layers[i] || !layers[i].mesh || layers[i].mesh.visible,
    blendModePass,
    blendModeView,
  };
  Object.assign(opts, generateFluidOptions(opts, i));
  return opts;
}

function generateFluidOptions(options, i) {
  let opts;
  do {
    opts = {
      dt: FXRand.num(0.1, 1.0),
      K: FXRand.num(0.2, 0.7),
      nu: FXRand.num(0.4, 0.6),
      kappa: FXRand.num(0.1, 1.0),
    };
  } while (!validateOptions(Object.assign({}, options, opts), i));
  return opts;
}

function validateOptions(options, i) {
  const blendModeString = options.blendModePass+'-'+options.blendModeView;
  if ((options.dt + options.kappa/1.5) < Math.min(1.0, 0.5 * Math.max(features.colorW, 1.0))) {
    return false;
  }
  if (['2-2', '2-5'].indexOf(blendModeString) > -1 && (options.dt < 0.9 || options.kappa < 0.8)) {
    return false;
  }
  if (palette === 'Analogous') {
    if (['1-5'].indexOf(blendModeString) > -1 && (options.dt + options.kappa) < 1.0) {
      return false;
    }
  }
  return true;
}

const takeSnapshot = () => {
  if (options.snapOverlay) {
    vars.snapOverlay.render();
    vars.snapOverlay.composer.swapBuffers();
  }
}

function scheduleChange() {
  if (vars.numChanges < options.maxChanges) {
    core.schedule(changeCB, 7000);
  }
  else {
    core.schedule(() => {
      core.togglePaused();
      setTimeout(restart, 10000);
    }, 7000);
  }
}

function changeCB() {
  vars.numChanges++;
  console.log(vars.numChanges);
  takeSnapshot();
  layers.map((layer) => {
    regenerateLayerOptions(layer);
  });
  core.callbacks.length = 0;
  scheduleChange();
}

function restart() {
  core.togglePaused();
  initOptions();
  layers.map((layer) => {
    regenerateLayerOptions(layer, true),
    resetLayer(layer);
  });
  core.uFrame.value = 0;
  if (options.snapOverlay) {
    vars.snapOverlay.material.blending = options.snapBlending;
    vars.snapOverlay.clear();
  }
  vars.numChanges = 0;
  scheduleChange();
}

function draw(event) {
  core.update();
  dev.update();
  if (comp === 'box') {
    materialFBO.render();
  }
  else {
    for (let i=0; i<layers.length; i++) {
      if (layers[i].mesh.visible) {
        layers[i].update();
      }
    }
  }
  core.render();
}

function onClick(event) {
  switch (options.behaviour) {
    case 'addnew':
      addLayer(strokesPerLayer);
      break;
    case 'reset':
      layers.map((layer) => {
        regenerateLayerOptions(layer, true);
        resetLayer(layer);
      });
      core.uFrame.value = 0;
      break
    case 'regenerate':
      changeCB();
      break;
  }
}

function onKeyDown(event) {
  if (devMode) {
    dev.keyDown(event, settings, lightOptions, effectOptions);
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