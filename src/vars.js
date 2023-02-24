import * as THREE from "three";
import {chooseComposition, choosePalette, options} from "./config";
import * as FXRand from "fxhash_lib/random";
import {generateHSLPalette, hsl2Color} from "fxhash_lib/color";

let palette, hslPalette, colors, comp, layers, strokesPerLayer, debug, labels, features, vars;

const initVars = () => {
    palette = choosePalette();
    hslPalette = generateHSLPalette(palette);
    colors = hslPalette.map(hsl2Color);
    comp = chooseComposition();
    layers = [];
    strokesPerLayer = FXRand.int(options.minStrokes, options.maxStrokes);
    debug = new THREE.Group();
    debug.visible = options.showDebug;
    labels = new THREE.Group();
    vars = {numSnapshots: 0, snapOverlay: null};

    // Feature generation
    features = {
        palette: palette,
        layers: FXRand.int(options.minLayers, options.maxLayers),
        color1: colors[0].getHexString(),
        color2: colors[1].getHexString(),
        colorW: FXRand.exp(0.1, 2.0),
    }
    window.$fxhashFeatures = features;
    console.log(features);
}

export {initVars, palette, hslPalette, colors, comp, layers, strokesPerLayer, debug, labels, features, vars};