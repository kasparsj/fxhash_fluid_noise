import * as THREE from 'three';
import * as FXRand from 'fxhash_lib/random.js'
import * as core from "fxhash_lib/core";
import * as dev from "fxhash_lib/dev";
import * as effects from "fxhash_lib/effects";
import * as css2D from "fxhash_lib/css2D";
import {generateColor} from "fxhash_lib/color";
import {FluidLayer, FluidStroke} from "fxhash_lib/fluid";
import {devMode, settings, options, layerOptions, lightOptions, effectOptions} from "./config"
import {createGUI, createLayerGUI} from "./gui";
import {renderer, scene, cam} from "fxhash_lib/core";
import {initVars, palette, hslPalette, colors, comp, transparent, layers, strokesPerLayer, labels, features, vars} from "./vars";
import {FullScreenLayer} from "fxhash_lib/postprocessing/FullScreenLayer";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass";
import * as mats from "fxhash_lib/materials";
import {MaterialFBO} from "fxhash_lib/postprocessing/MaterialFBO";
import {FluidPass} from "../../fxhash_lib/postprocessing/FluidPass";

let hist, materialFBO;

setup();

function setup() {
  if (devMode) {
    dev.initGui(settings.name);
    createGUI(dev.gui);
  }

  initVars();

  const initSettings = Object.assign({}, settings, {
    alpha: transparent,
  });
  core.init(initSettings);
  //core.initLights(lightOptions);
  css2D.init();

  if (devMode) {
    dev.initHelpers();
    //dev.initLighting(lightOptions);
    dev.createEffectsGui(effectOptions);
    dev.hideGuiSaveRow();
  }

  createScene();

  effects.init(effectOptions);
  core.animate();

  addEventListeners();

  fxpreview();
}

function createScene() {
  if (comp !== 'cells') {
    scene.background = colors[0];
  }
  if (comp !== 'box') {
    for (let i=0; i<features.layers; i++) {
      addLayer(strokesPerLayer);
    }
  }
  switch (comp) {
    case 'cells':
      hist = new FullScreenLayer({
        type: THREE.HalfFloatType,
        blending: THREE.CustomBlending,
        transparent: true,
      });
      hist.composer.addPass(new RenderPass(scene, cam));
      scene.add(hist.mesh);
      requestCell();
      break;
    case 'box':
      core.initControls(cam);
      cam.position.x = 1024;
      cam.position.y = 512;
      cam.position.z = 1024;
      core.lookAt(new THREE.Vector3(0, 0, 0));

      layerOptions.push(generateOptions(0));

      const mat = mats.fluidViewUV({
        blending: layerOptions[0].blendModeView,
      });

      const box = new THREE.Mesh(new THREE.BoxGeometry(500, 500, 500), mat);
      //const box = core.createFSMesh(mat);
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
        bgColor: colors[0],
      }, Object.assign({
        maxIterations: options.maxIterations,
      }, layerOptions[0])));

      for (let i=0; i<strokesPerLayer; i++) {
        fluidPass.uniforms.uPos.value[i].set(FXRand.num(), FXRand.num());
        fluidPass.uniforms.uLast.value[i].copy(fluidPass.uniforms.uPos.value[i]);
        fluidPass.uniforms.uTarget.value[i].set(FXRand.num(), FXRand.num());
        fluidPass.uniforms.uSpeed.value[i] = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
        fluidPass.isDown[i] = FXRand.bool();
      }

      materialFBO.composer.addPass(fluidPass);

      break;
  }
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
  layers[i] = new FluidLayer(renderer, scene, cam, Object.assign({}, layerOptions[i], {
    numStrokes,
    maxIterations: options.maxIterations,
    bgColor: colors[0],
    transparent: transparent,
  }));
  setLayerColor(layers[i], colors[1]);
  scene.add(layers[i].mesh);
  return layers[i];
}

function createStrokes(layer, i) {
  const numStrokes = layer.options.numStrokes;
  for (let j=0; j<numStrokes; j++) {
    let stroke;
    if (i === 0 || options.strokesRel === 'random') {
      // first layer all strokes are random
      const speed = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
      stroke = new FluidStroke(FXRand.num(), FXRand.num());
      stroke.speed = speed;
      stroke.isDown = FXRand.bool();
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

function resetLayer(layer) {
  layer.clear();
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
  const invalidBlends = ['4-4'];
  const blendModeString = options.blendModePass+'-'+options.blendModeView;
  if (invalidBlends.indexOf(blendModeString) > -1) {
    return false;
  }
  // if (i > 0 && [2, 4].indexOf(options.blendModeView) > -1 && options.blendModeView === layerOptions[i-1].blendModeView) {
  //   return false;
  // }
  // if (palette === 'Black&White') {
  //   const invalidBWBlends = ['1-2'];
  //   if (invalidBWBlends.indexOf(blendModeString) > -1) {
  //     return false;
  //   }
  //   if (hslPalette[0][2] < 0.5) {
  //     if (blendModeString === '0-4' && options.dt < 0.5) {
  //       return false;
  //     }
  //     if (['0-3', '2-5'].indexOf(blendModeString) > -1 && options.dt < 0.75) {
  //       return false;
  //     }
  //     if (['2-3', '3-2', '3-3', '4-3'].indexOf(blendModeString) > -1) {
  //       return false;
  //     }
  //   }
  //   else {
  //     if (blendModeString === '0-2') {
  //       return false;
  //     }
  //     if (['0-3', '2-5'].indexOf(blendModeString) > -1 && options.dt < 0.45) {
  //       return false;
  //     }
  //     if (blendModeString === '2-3' && options.dt < 0.8) {
  //       return false;
  //     }
  //   }
  //   if (blendModeString === '0-5' && options.dt < 0.25) {
  //     return false;
  //   }
  //   if (['1-3', '1-4'].indexOf(blendModeString) > -1 && options.dt < 0.3) {
  //     return false;
  //   }
  //   if (blendModeString === '2-4' && options.dt < 0.7) {
  //     return false;
  //   }
  //   if (['4-2', '4-5'].indexOf(blendModeString) > -1 && options.dt < 0.5) {
  //     return false;
  //   }
  // }
  // else if (palette === 'Mono') {
  //   if (i > 0 && ['2-3', '2-5'].indexOf(blendModeString) > -1) {
  //     return false;
  //   }
  //   if (blendModeString === '3-2' && options.dt < 0.7) {
  //     return false;
  //   }
  // }
  // else if (palette === 'Analogous') {
  //   if (['2-5'].indexOf(blendModeString) > -1) {
  //     return false;
  //   }
  //   if (i > 0 && ['1-4', '2-2', '3-2'].indexOf(blendModeString) > -1) {
  //     return false;
  //   }
  //   if (['0-3', '0-5', '1-5'].indexOf(blendModeString) > -1 && options.dt < 0.5) {
  //     return false;
  //   }
  //   if (['1-2', '1-3', '1-4'].indexOf(blendModeString) > -1 && options.dt < 0.3) {
  //     return false;
  //   }
  //   if (['2-3', '3-2', '4-2', '4-3'].indexOf(blendModeString) > -1 && options.dt < 0.6) {
  //     return false;
  //   }
  //   if (['2-4'].indexOf(blendModeString) > -1 && options.dt < 0.75) {
  //     return false;
  //   }
  //   if (blendModeString === '4-5' && options.dt < 0.5) {
  //     return false;
  //   }
  // }
  // if (blendModeString === '0-4' && options.dt < 0.3) {
  //   return false;
  // }
  // if (blendModeString === '1-5' && options.dt < 0.3) {
  //   return false;
  // }
  // if (blendModeString === '2-2' && options.dt < 0.8) {
  //   return false;
  // }
  // if (blendModeString === '2-4' && options.dt < 0.5) {
  //   return false;
  // }
  // if (blendModeString === '3-2' && options.dt < 0.4) {
  //   return false;
  // }
  // if (blendModeString === '3-3' && options.dt < 0.45) {
  //   return false;
  // }
  return true;
}

const createCell = () => {
  vars.numCells++;
  hist.render();
  hist.composer.swapBuffers();
  layers.map((layer) => {
    regenerateLayer(layer);
  });
}

function requestCell() {
  if (vars.timeoutID > 0) {
    clearTimeout(vars.timeoutID);
    createCell();
  }
  if (vars.numCells < options.maxCells) {
    vars.timeoutID = setTimeout(requestCell, FXRand.int(500, 7000));
  }
  else {
    // todo: add diagonal animation effect
  }
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
        //layer.composer.swapBuffers();
        regenerateLayer(layer);
      });
      break;
    case 'cells':
      requestCell();
      break
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