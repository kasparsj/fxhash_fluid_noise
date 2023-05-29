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

  window.addEventListener('fluid.createLayer', onCreateLayer);
  window.addEventListener('fluid.initLayerOptions', onInitLayerOptions);
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

  fluid.createLayers();
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

  fluid.createLayer();

  const mat = mats.fluidViewUV({
    blending: fluid.layerOptions[0].blendModeView,
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(500, 500, 500), mat);
  scene.add(box);
  const edges = core.createEdges(box);
  scene.add(edges);

  materialFBO = new MaterialFBO({
    type: THREE.HalfFloatType,
  }, box.material);

  const fluidPass = new FluidPass(mats.fluidPass({
    blending: fluid.layerOptions[0].blendModePass,
    transparent: true,
  }), fluid.layerOptions[0]);

  materialFBO.composer.addPass(fluidPass);
}

function onCreateLayer(event) {
  const {layer, i} = event.detail;
  if (comp !== 'box') {
    scene.add(layer.mesh);
  }
  if (devMode) {
    fluid.createLayerGUI(dev.gui, i);
  }
}

function onInitLayerOptions(event) {
  const {i, layerOpts} = event.detail;

  layerOpts.opacity = 0.96;
  layerOpts.colorW = features.colorW;  //features.colorW / 5.0;
  if (options.background) {
    // todo: 1 and 5 are almost completely similar (maybe choose one)
    const lastLayerBlendmodes = i === 0 ? [0, 1, 2, 3] : [0, 1, 2, 3, 5];
    layerOpts.blendModeView = FXRand.choice((i+1) === features.layers ? lastLayerBlendmodes : [0, 1, 2, 3, 5]);
  }
  else {
    layerOpts.blendModeView = FXRand.choice(i > 0 ? [2, 3, 5] : [2, 5]);
  }

  const comps = core.getIncludedComps();
  const layerComp = i > 0 ? FXRand.choice(comps.length > 1 ? utils.removeFromArray(comps, comp) : comps) : comp;
  for (let j=0; j<layerOpts.passes.length; j++) {
    layerOpts.passes[j].diss = 0.0005;
    layerOpts.passes[j].noiseZoom = FXRand.num(400, 1700);
    layerOpts.passes[j].noiseMin = options.noiseMin;
    layerOpts.passes[j].noiseMax = options.noiseMax;
    switch (layerComp) {
      case 'sea':
        layerOpts.passes[j].fluidZoom = FXRand.exp(0.9, 1.4);
        break;
      case 'stone':
        // todo: maybe too fluid?
        layerOpts.passes[j].fluidZoom = -FXRand.num(0.3, 0.6);
        layerOpts.passes[j].K = layerOpts.passes[j].K * 1.5;
        // todo: only if inv?
        // layerOpts.passes[j].noiseMin = i === 0 ? 0.5 : 0;
        break;
      case 'cells':
        layerOpts.passes[j].fluidZoom = -FXRand.num(0.3, 0.6) * 10.0;
        layerOpts.passes[j].K = layerOpts.passes[j].K * 2.0;
        break;
      case 'sand':
        layerOpts.passes[j].fluidZoom = -FXRand.exp(0.1, 0.3);
        layerOpts.passes[j].fluidZoom2 = FXRand.exp(0.1, 0.3);
        break;
      case 'glitch':
        layerOpts.passes[j].blendModePass = 1;
        layerOpts.passes[j].fluidZoom = FXRand.exp(1.5, 5.0);
        break;
    }
  }
}

function onApplyPassOptions(event) {
  const {i, j, layer, passOpts} = event.detail;
  layer.composer.passes[j].material.uniforms.uNoiseZoom = {value: passOpts.noiseZoom};
  layer.composer.passes[j].material.uniforms.uNoiseOffset = {value: new THREE.Vector2(FXRand.num(0, 1000), FXRand.num(0, 1000))};
  layer.composer.passes[j].material.uniforms.uNoiseMove = {value: new THREE.Vector2(0.0001, 0)};
  layer.composer.passes[j].material.uniforms.uNoiseMin = {value: passOpts.noiseMin};
  layer.composer.passes[j].material.uniforms.uNoiseMax = {value: passOpts.noiseMax};
  switch (comp) {
    case 'pnoise':
      layer.composer.passes[j].material.uniforms.uNoiseSpeed = {value: 10.0};
      layer.composer.passes[j].material.fragmentShader = pnoiseFluidPassFrag;
      break;
    default:
      layer.composer.passes[j].material.fragmentShader = snoiseFluidPassFrag;
      layer.composer.passes[j].material.uniforms.uNoiseSpeed = {value: 0.0001};
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
    fluid.updateLayers();
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
  window.addEventListener("resize", fluid.onResize);
  if (devMode) {
    window.addEventListener("dblclick", onDblClick);
  }
}