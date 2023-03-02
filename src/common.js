import * as THREE from "three";
import {chooseComposition, choosePalette, layerOptions, options} from "./config";
import * as FXRand from "fxhash_lib/random";
import {generateColor, generateHSLPalette, hsl2Color} from "fxhash_lib/color";
import * as core from "../../fxhash_lib/core";

let palette, hslPalette, colors, comp, layers, strokesPerLayer, debug, labels, features, vars;

const initVars = () => {
    const numLayers = FXRand.int(options.minLayers, options.maxLayers);
    palette = choosePalette();
    hslPalette = generateHSLPalette(palette, ['Complementary', 'Black&White'] ? 2 : numLayers + 1);
    colors = hslPalette.map(hsl2Color);
    comp = chooseComposition();
    layers = [];
    strokesPerLayer = FXRand.int(options.minStrokes, options.maxStrokes);
    debug = new THREE.Group();
    debug.visible = options.showDebug;
    labels = new THREE.Group();
    vars = {numChanges: 0, snapOverlay: null};

    // Feature generation
    features = {
        composition: comp,
        palette: palette,
        layers: numLayers,
        color1: colors[0].getHexString(),
        color2: colors[1].getHexString(),
        colorW: FXRand.exp(0.1, 2.0),
    }
    window.$fxhashFeatures = features;
    console.log(features);
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

function initLayerOptions(i) {
    //const blendModePass = FXRand.choice([0, 1, 2]);
    const blendModePass = FXRand.choice([0, 1]);
    const blendModeView = FXRand.choice([2, 5]);
    const zoom = FXRand.exp(0.1, 10.0);
    const opts = {
        visible: !layers[i] || !layers[i].mesh || layers[i].mesh.visible,
        blendModePass,
        blendModeView,
        zoom,
    };
    Object.assign(opts, fluidOptions(opts, i));
    return opts;
}

function changeLayerOptions(layer, doInit = false) {
    const i = layers.indexOf(layer);
    if (doInit) {
        Object.assign(layerOptions[i], initLayerOptions(i));
    }
    else {
        Object.assign(layerOptions[i], fluidOptions(layerOptions[i], i));
    }
    setFluidLayerOptions(i)
}

function fluidOptions(layerOpts, i) {
    let opts;
    //do {
    opts = {
        dt: FXRand.num(options.minDt, options.maxDt),
        K: FXRand.num(0.2, 0.7),
        nu: FXRand.num(0.4, 0.6),
        kappa: FXRand.num(0.1, 1.0),
    };
    //} while (!validateOptions(Object.assign({}, options, opts), i));
    return opts;
}

const updateLayer = (i) => {
    if (options.onChange) {
        layers[i].mesh.visible = layerOptions[i].visible;
        setFluidLayerOptions(i);
        if (options.onChange === 'reset') {
            resetLayers();
            core.uFrame.value = 0;
        }
    }
}

function setFluidLayerOptions(i) {
    const options = layerOptions[i];
    const layer = layers[i];

    layer.setOptions(options);

    layer.material.blending = options.blendModeView;
    layer.material.transparent = options.transparent;
    layer.material.opacity = options.opacity;

    layer.fluidPass.material.blending = options.blendModePass;
    layer.fluidPass.material.transparent = options.transparent;
    layer.fluidPass.material.uniforms.uZoom.value = options.zoom;
    layer.fluidPass.material.uniforms.uNoiseZoom = {value: FXRand.num(100, 2000)};
    layer.fluidPass.material.uniforms.uNoiseOffset = {value: new THREE.Vector2(FXRand.num(0, 1000), FXRand.num(0, 1000))};
    layer.fluidPass.material.uniforms.uNoiseSpeed = {value: new THREE.Vector2(0.001, 0)};
    layer.fluidPass.material.defines.MAX_ITERATIONS = options.maxIterations + '.0';
}

const resetLayers = () => {
    for (let i = 0; i < layers.length; i++) {
        layers[i].reset();
    }
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
        changeLayerOptions(layer);
    });
    core.callbacks.length = 0;
    if (options.maxChanges > 0) {
        scheduleChange();
    }
}

function restart() {
    core.togglePaused();
    initOptions();
    layers.map(fullResetLayer);
    core.uFrame.value = 0;
    if (options.snapOverlay) {
        vars.snapOverlay.material.blending = options.snapBlending;
        vars.snapOverlay.clear();
    }
    vars.numChanges = 0;
    scheduleChange();
}

function fullResetLayer(layer) {
    changeLayerOptions(layer, true);
    layer.reset();
    changeLayerSpeed(layer);
    changeLayerColor(layer);
}

function changeLayerSpeed(layer) {
    for (let j=0; j<layer.options.numStrokes; j++) {
        const speed = FXRand.num(options.minSpeed, options.maxSpeed) * options.speedMult;
        layer.fluidPass.uniforms.uSpeed.value[j] = speed;
    }
}

function changeLayerColor(layer) {
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

export {
    initVars, initOptions, initLayerOptions,
    changeLayerOptions, fluidOptions, updateLayer, setFluidLayerOptions, setLayerColor,
    resetLayers, fullResetLayer,
    scheduleChange, changeCB,
    palette, hslPalette, colors, comp, layers, strokesPerLayer, debug, labels, features, vars,
};