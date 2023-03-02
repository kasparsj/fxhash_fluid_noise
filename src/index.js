import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import * as effects from "fxhash_lib/effects";
import * as css2D from "fxhash_lib/css2D";
import {devMode, settings, options, layerOptions, lightOptions, effectOptions} from "./config"
import {createGUI, createLayerGUI} from "./gui";
import {renderer, scene, cam} from "fxhash_lib/core";
import {
  initVars, initOptions, initLayerOptions, setFluidLayerOptions, setLayerColor,
  changeCB, fullResetLayer, scheduleChange,
  palette, colors, comp, layers, strokesPerLayer, debug, features, vars,
} from "./common";
import {FullScreenLayer} from "fxhash_lib/postprocessing/FullScreenLayer";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass";
import * as mats from "fxhash_lib/materials";
import {MaterialFBO} from "fxhash_lib/postprocessing/MaterialFBO";
import {FluidPass} from "fxhash_lib/postprocessing/FluidPass";
import {FluidLayer} from "fxhash_lib/postprocessing/FluidLayer";
import blackFluidViewFrag from "fxhash_lib/shaders/fluid/blackFluidView.frag";
import colorFluidViewFrag from "fxhash_lib/shaders/fluid/colorFluidView.frag";
import pnoiseFluidPassFrag from "fxhash_lib/shaders/fluid/pnoiseFluidPass.frag";
import snoiseFluidPassFrag from "fxhash_lib/shaders/fluid/snoiseFluidPass.frag";

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
      if (options.maxChanges > 0) {
        scheduleChange();
      }
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

  layerOptions.push(initLayerOptions(0));

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
  layerOptions.push(initLayerOptions(i));
  if (devMode) {
    createLayerGUI(dev.gui, i);
  }
  const layer = createLayer(numStrokes);
  createStrokes(layer, i);
}

function createLayer(numStrokes) {
  const i = layers.length;
  //const filter = layerOptions[i].zoom > 1 ? FXRand.choice([THREE.NearestFilter, THREE.LinearFilter]) : THREE.LinearFilter;
  const filter = THREE.LinearFilter;
  let passShader;
  if (comp === 'pnoise' || comp === 'snoise') {
    passShader = mats.fluidPass({
      fragmentShader: comp === 'pnoise' ? pnoiseFluidPassFrag : snoiseFluidPassFrag,
    })
  }
  layers[i] = new FluidLayer(renderer, scene, cam, Object.assign({}, layerOptions[i], {
    numStrokes,
    generateMipmaps: false,
    type: THREE.HalfFloatType,
    minFilter: filter,
    magFilter: filter,
    passShader: passShader,
    viewShader: mats.fluidView({
      fragmentShader: palette === 'Black&White' ? blackFluidViewFrag : colorFluidViewFrag,
    }),
  }));
  setFluidLayerOptions(i);
  setLayerColor(layers[i]);
  scene.add(layers[i].mesh);
  return layers[i];
}

function createStrokes(layer, i) {
  const numStrokes = layer.options.numStrokes;
  for (let j=0; j<numStrokes; j++) {
    const stroke = createStroke(i, j);
    if (stroke.isMouse) {
      layer.initMouseStroke(j, renderer.domElement);
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
  switch (options.onClick) {
    case 'addnew':
      addLayer(strokesPerLayer);
      break;
    case 'reset':
      layers.map(fullResetLayer);
      core.uFrame.value = 0;
      break
    case 'change':
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