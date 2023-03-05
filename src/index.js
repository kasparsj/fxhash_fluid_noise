import * as THREE from 'three';
import * as core from "fxhash_lib/core";
import {cam, renderer, scene, settings, options, compositions, palettes, features} from "fxhash_lib/core";
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
import {pnoiseFluidPassFrag, snoiseFluidPassFrag} from "fxhash_lib/shaders/fluid/pass";
import {initShared, comp} from "./shared";

let materialFBO;

setup();

function setup() {
  if (devMode) {
    dev.initGui(settings.name);
    //dev.initSettings(settings);
    fluid.createGUI(dev.gui);
    dev.createCheckBoxGui(compositions, 'Compositions');
    dev.createCheckBoxGui(palettes, 'Palettes');
  }

  initShared();
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
  window.addEventListener('fluid.applyLayerOptions', onApplyLayerOptions)

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
  // if (!options.snapOverlay && palette !== 'Black&White') {
  //   scene.background = fluid.colors[0];
  // }
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
  const {options} = event.detail;
  options.noiseZoom = FXRand.num(400, 2000);
  options.colorW = features.colorW;  //features.colorW / 5.0;
}

function onApplyLayerOptions(event) {
  const {layer, options} = event.detail;
  layer.fluidPass.material.fragmentShader = comp === 'pnoise' ? pnoiseFluidPassFrag : snoiseFluidPassFrag;
  layer.fluidPass.material.uniforms.uNoiseZoom = {value: options.noiseZoom};
  layer.fluidPass.material.uniforms.uNoiseOffset = {value: new THREE.Vector2(FXRand.num(0, 1000), FXRand.num(0, 1000))};
  layer.fluidPass.material.uniforms.uNoiseMove = {value: new THREE.Vector2(0.0001, 0)};
  if (comp === 'pnoise') {
    layer.fluidPass.material.uniforms.uNoiseSpeed = {value: 10.0};
  }
  else {
    layer.fluidPass.material.uniforms.uNoiseSpeed = {value: 0.0005};
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