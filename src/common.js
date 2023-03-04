import * as THREE from "three";
import {chooseComposition, choosePalette, layerOptions, options} from "./config";
import * as FXRand from "fxhash_lib/random";
import {generateColor, generateHSLPalette, generateRandomPalette, hex2Color, hsl2Color} from "fxhash_lib/color";
import * as core from "fxhash_lib/core";
import * as mats from "fxhash_lib/materials";
import * as utils from "fxhash_lib/utils";
import pnoiseFluidPassFrag from "fxhash_lib/shaders/fluid/pnoiseFluidPass.frag";
import snoiseFluidPassFrag from "fxhash_lib/shaders/fluid/snoiseFluidPass.frag";
import * as fluidView from "fxhash_lib/shaders/fluid/view";

let palette, hslPalette, colors, comp, layers, strokesPerLayer, debug, labels, features, vars;

const viewFragmentShaders = utils.removeFromArray(Object.keys(fluidView), ['FluidViewFrag', 'FluidViewUVFrag']);

function initCommon() {
    initOptions();
    initVars();
}

function initVars() {
    const numLayers = FXRand.int(options.minLayers, options.maxLayers);
    palette = choosePalette();
    colors = generateColors(palette, ['Complementary', 'Black&White'] ? 2 : numLayers + 1);
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

function generateColors(palette, numColors) {
    switch (palette) {
        case 'randomColor':
            const luminosity = FXRand.bool() ? 'dark' : 'bright';
            const hue = luminosity === 'dark' ? FXRand.choice(['red', 'orange']) : FXRand.choice(['monochrome', 'blue']);
            return generateRandomPalette({
                count: numColors,
                luminosity: luminosity,
                hue: hue,
            }).map(hex2Color);
        case 'Analogous':
        default:
            hslPalette = generateHSLPalette(palette, numColors);
            return hslPalette.map(hsl2Color);
    }
}

function initLayerOptions(i, initShaders = false) {
    const blendModePass = FXRand.choice([0, 1]);
    const blendModeView = FXRand.choice([2, 5]);
    const fluidZoom = FXRand.exp(0.1, 10.0);
    const noiseZoom = FXRand.num(400, 2000);
    const color = (i < colors.length ? colors[i] : colors[1]).getHex();
    const saturation = FXRand.num(0.5, 1.0); //features.colorW / 5.0;
    const opts = {
        visible: !layers[i] || !layers[i].mesh || layers[i].mesh.visible,
        blendModePass,
        blendModeView,
        fluidZoom,
        noiseZoom,
        color,
        saturation,
    };
    Object.assign(opts, fluidOptions(opts, i));
    if (initShaders) {
        let passShader;
        if (comp === 'pnoise' || comp === 'snoise') {
            passShader = mats.fluidPass({
                fragmentShader: comp === 'pnoise' ? pnoiseFluidPassFrag : snoiseFluidPassFrag,
            })
        }
        let viewShader;
        const fragmentShaderChoices = palette === 'randomColor'
            ? viewFragmentShaders
            : ['multFluidViewFrag', 'RGBFluidViewFrag', 'blueRGBFluidViewFrag'];
        if (i > 0) {
            const prevLayerOptions = layerOptions[i-1];
            viewShader = FXRand.choice(utils.removeFromArray(fragmentShaderChoices, prevLayerOptions.viewShader));
        }
        else {
            viewShader = FXRand.choice(fragmentShaderChoices);
        }
        Object.assign(opts, {
            passShader: passShader,
            viewShader: viewShader,
        });
    }
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
        kappa: FXRand.num(0.1, 0.75),
    };
    //} while (!validateOptions(Object.assign({}, options, opts), i));
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

const updateLayer = (i) => {
    if (options.onChange) {
        layers[i].mesh.visible = layerOptions[i].visible;
        setFluidLayerOptions(i);
        setLayerColor(layers[i]);
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
    layer.material.fragmentShader = fluidView[options.viewShader];
    layer.material.uniforms.uInk.value = options.saturation;

    layer.fluidPass.material.blending = options.blendModePass;
    layer.fluidPass.material.transparent = options.transparent;
    layer.fluidPass.material.uniforms.uZoom.value = options.fluidZoom;
    layer.fluidPass.material.uniforms.uNoiseZoom = {value: options.noiseZoom};
    layer.fluidPass.material.uniforms.uNoiseOffset = {value: new THREE.Vector2(FXRand.num(0, 1000), FXRand.num(0, 1000))};
    layer.fluidPass.material.uniforms.uNoiseSpeed = {value: new THREE.Vector2(0.00001, 0)};
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
    const color = new THREE.Color(layerOptions[i].color);
    layer.color = new THREE.Vector4(color.r, color.g, color.b, features.colorW);
    // layer.color = new THREE.Vector4(10, 10, 10, 0.1);
    // layer.color = FXRand.choice([new THREE.Vector4(10, 10, 10, 0.1), new THREE.Vector4(0, 0, 10, 0.1)]);
}

export {
    initCommon, initLayerOptions,
    changeLayerOptions, fluidOptions, updateLayer, setFluidLayerOptions, setLayerColor,
    resetLayers, fullResetLayer,
    scheduleChange, changeCB,
    palette, colors, comp, layers, strokesPerLayer, debug, labels, features, vars, viewFragmentShaders,
};