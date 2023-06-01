import * as THREE from 'three';
import * as core from "fxhash_lib/core";
import {cam, renderer, scene, settings, options, compositions, palettes, features, comp} from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import * as effects from "fxhash_lib/effects";
//import * as lights from "fxhash_lib/lights";
import * as css2D from "fxhash_lib/css2D";
import {devMode, effectOptions, lightOptions} from "./config"
import * as fluid from "fxhash_lib/fluid";
import * as mats from "fxhash_lib/materials";
import * as layers from "fxhash_lib/layers";
import {MaterialFBO} from "fxhash_lib/postprocessing/MaterialFBO";
import {FluidPass} from "fxhash_lib/postprocessing/FluidPass";
import * as FXRand from "fxhash_lib/random";
import * as utils from "fxhash_lib/utils";
import * as livecoding from "fxhash_lib/livecoding";
import {pnoiseFluidPassFrag, snoiseFluidPassFrag} from "fxhash_lib/shaders/fluid/pass";

let materialFBO;

setup();

function setup() {
  if (devMode) {
    initDevMode();
  }

  core.initSketch();
  fluid.init();

  const initSettings = Object.assign({}, settings, {
    alpha: true,
  });
  core.init(initSettings);
  // lights.init(lightOptions);
  css2D.init();

  if (devMode) {
    dev.initHelpers();
    //dev.initLighting(lightOptions);
    dev.createEffectsGui(effectOptions);
    dev.hideGuiSaveRow();
  }

  cam.position.z = 1024;
  core.lookAt(new THREE.Vector3(0, 0, 0));

  window.addEventListener('layers.create', onCreateLayer);
  window.addEventListener('fluid.initOptions', onInitFluidOptions);
  window.addEventListener('fluid.create', onCreateFluid);
  window.addEventListener('fluid.applyPassOptions', onApplyPassOptions)

  createScene();

  effects.init(Object.assign({
    colorifyColor: new THREE.Color(0xFFD700),
  }, effectOptions));
  core.animate();

  addEventListeners();

  fxpreview();

  //livecoding.init();
}

function initDevMode() {
  dev.initGui(settings.name);
  //dev.initSettings(settings);
  fluid.createGUI(dev.gui);
  dev.createCheckBoxGui(compositions, 'Compositions');
  dev.createCheckBoxGui(palettes, 'Palettes');
}

function createScene() {
  switch (comp) {
    case 'box':
      createBoxComp();
      break;
    default:
      createDefaultComp();
      break;
  }
}

function createDefaultComp() {
  // const mat = new THREE.MeshLambertMaterial({color: fluid.colors[0], blending: THREE.CustomBlending});
  // // const mat = new THREE.MeshBasicMaterial({color: fluid.colors[0], blending: THREE.CustomBlending});
  // const box = new THREE.Mesh(new THREE.BoxGeometry(500, 500, 500), mat);
  // box.rotation.set(90, 0, 180);
  // scene.add(box);

  if (options.usePipeline) {
    fluid.createPipeline();
  }
  else {
    fluid.createLayers();
  }
  if (options.background) {
    scene.background = fluid.colors[0];
  }
  fluid.createSnapOverlay();
  if (options.maxChanges > 0) {
    fluid.scheduleChange();
  }
}

function createBoxComp() {
  scene.background = fluid.colors[0];
  core.initControls(cam);

  // todo: fix!
  //fluid.createLayer();

  const mat = mats.fluidViewUV({
    blending: fluid.fluids[0].blendModeView,
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(500, 500, 500), mat);
  scene.add(box);
  const edges = core.createEdges(box);
  scene.add(edges);

  materialFBO = new MaterialFBO({
    type: THREE.HalfFloatType,
  }, box.material);

  const fluidPass = new FluidPass(mats.fluidPass({
    blending: fluid.fluids[0].blendModePass,
    transparent: true,
  }), fluid.fluids[0]);

  materialFBO.composer.addPass(fluidPass);
}

function onCreateLayer(event) {
  const {layer} = event.detail;
  if (comp !== 'box') {
    scene.add(layer.mesh);
  }
}

function onCreateFluid(event) {
  const {i} = event.detail;
  if (devMode) {
    fluid.createFluidGUI(dev.gui, i);
  }
}

function onInitFluidOptions(event) {
  const {opts, i} = event.detail;

  //viewOpts.opacity = i > 0 ? 0.96 : 1.0;
  opts.opacity = 1.0;
  opts.colorW = features.colorW;  //features.colorW / 5.0;
  if (options.background) {
    // todo: 1 and 5 are almost completely similar (maybe choose one)
    const lastLayerBlendmodes = i === 0 ? [0, 1, 2] : [0, 1, 2, 5];
    opts.blendModeView = FXRand.choice((i+1) === features.layers ? lastLayerBlendmodes : [0, 1, 2, 3, 5]);
  }
  else {
    opts.blendModeView = FXRand.choice([1, 2, 5]);
  }

  const comps = core.getIncludedComps();
  const layerComp = i > 0 ? FXRand.choice(comps.length > 1 ? utils.removeFromArray(comps, comp) : comps) : comp;
  for (let j=0; j<opts.passOptions.length; j++) {
    opts.passOptions[j].diss = 0.0005;
    opts.passOptions[j].noiseZoom = FXRand.num(400, 1700);
    opts.passOptions[j].noiseMin = options.noiseMin;
    opts.passOptions[j].noiseMax = options.noiseMax;
    switch (layerComp) {
      case 'sea':
        opts.passOptions[j].fluidZoom = FXRand.exp(0.9, 1.4);
        break;
      case 'stone':
        // todo: maybe too fluid?
        opts.passOptions[j].fluidZoom = -FXRand.num(0.3, 0.6);
        opts.passOptions[j].K = opts.passOptions[j].K * 1.5;
        // todo: only if inv?
        // opts.passOptions[j].noiseMin = i === 0 ? 0.5 : 0;
        break;
      case 'cells':
        opts.passOptions[j].fluidZoom = -FXRand.num(0.3, 0.6) * 10.0;
        opts.passOptions[j].K = opts.passOptions[j].K * 2.0;
        break;
      case 'sand':
        opts.passOptions[j].fluidZoom = -FXRand.exp(0.1, 0.3);
        opts.passOptions[j].fluidZoom2 = FXRand.exp(0.1, 0.3);
        break;
      case 'glitch':
        opts.passOptions[j].blendModePass = 1;
        opts.passOptions[j].fluidZoom = FXRand.exp(1.5, 5.0);
        break;
    }
  }
}

function onApplyPassOptions(event) {
  const {pass, passOpts} = event.detail;
  pass.material.uniforms.uNoiseZoom = {value: passOpts.noiseZoom};
  pass.material.uniforms.uNoiseOffset = {value: new THREE.Vector2(FXRand.num(0, 1000), FXRand.num(0, 1000))};
  pass.material.uniforms.uNoiseMove = {value: new THREE.Vector2(0.0001, 0)};
  pass.material.uniforms.uNoiseMin = {value: passOpts.noiseMin};
  pass.material.uniforms.uNoiseMax = {value: passOpts.noiseMax};
  // switch (FXRand.choice(['snoise', 'pnoise'])) {
  switch (comp) {
    case 'pnoise':
      pass.material.uniforms.uNoiseSpeed = {value: 10.0};
      pass.material.fragmentShader = pnoiseFluidPassFrag;
      break;
    default:
      pass.material.fragmentShader = snoiseFluidPassFrag;
      pass.material.uniforms.uNoiseSpeed = {value: 0.0001};
      break;
  }
}

function draw(event) {
  core.update();
  dev.update();
  if (comp === 'box') {
    materialFBO.render();
  }
  else {
    layers.renderAt(24, event);
  }
  core.render();
}

function onKeyDown(event) {
  if (devMode) {
    dev.keyDown(event, settings, lightOptions, effectOptions);
  }
}

function onDblClick(event) {
  if (devMode && !dev.isGui(event.target)) {
    document.location.reload();
  }
}

function addEventListeners() {
  window.addEventListener('core.render', draw);
  renderer.domElement.addEventListener('click', fluid.onClick);
  document.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("resize", layers.onResize);
  if (devMode) {
    window.addEventListener("dblclick", onDblClick);
  }
}