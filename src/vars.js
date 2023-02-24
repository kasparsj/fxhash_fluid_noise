import * as THREE from "three";
import {chooseComposition, choosePalette, options} from "./config";
import * as FXRand from "fxhash_lib/random";
import {generateHSLPalette, hsl2Color} from "../../fxhash_lib/color";

let palette, hslPalette, colors, comp, transparent, layers, strokesPerLayer, debug, labels, features, vars;

const initVars = () => {
    palette = choosePalette();
    hslPalette = generateHSLPalette(palette);
    colors = hslPalette.map(hsl2Color);
    comp = chooseComposition();
    transparent = comp === 'cells';
    layers = [];
    strokesPerLayer = FXRand.int(options.minStrokes, options.maxStrokes);
    debug = new THREE.Group();
    debug.visible = options.showDebug;
    labels = new THREE.Group();
    vars = {timeoutID: -1, numCells: 0};

    // Feature generation
    features = {
        palette: palette,
        layers: FXRand.int(options.minLayers, options.maxLayers),
        colorW: FXRand.exp(0.1, 2.0),
    }
    window.$fxhashFeatures = features;
    console.log(features);
}

export {initVars, palette, hslPalette, colors, comp, transparent, layers, strokesPerLayer, debug, labels, features, vars};