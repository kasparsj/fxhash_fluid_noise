import {compositions, layerOptions, options, palettes} from "./config";
import * as dev from "fxhash_lib/dev";
import {layers, debug, vars, changeLayerOptions, updateLayer} from "./common";

export const createGUI = (gui) => {
    gui.remember(options);
    const onChange = () => {
        debug.visible = options.showDebug;
        if (options.hasOwnProperty('snapOverlay')) {
            vars.snapOverlay.mesh.visible = options.snapOverlay;
        }
        if (options.hasOwnProperty('snapBlending')) {
            vars.snapOverlay.mesh.material.blending = options.snapBlending;
        }
        if (options.hasOwnProperty('snapOpacity')) {
            vars.snapOverlay.mesh.material.opacity = options.snapOpacity;
        }
    }

    const folder = gui.addFolder('Options');
    folder.add(options, 'minLayers', 1, 10, 1);
    folder.add(options, 'maxLayers', 1, 10, 1);
    if (options.hasOwnProperty('opacity')) {
        folder.add(options, 'opacity', 0, 1, 0.01);
    }
    folder.add(options, 'minStrokes', 1, 22, 1);
    folder.add(options, 'maxStrokes', 1, 22, 1);
    folder.add(options, 'strokesRel', ['same', 'mirror', 'mirrorX', 'mirrorY', 'mirrorRand', 'random']);
    folder.add(options, 'minSpeed', 0.001, 0.01, 0.001).listen();
    folder.add(options, 'maxSpeed', 0.01, 0.1, 0.001).listen();
    folder.add(options, 'minDt', 0.01, 0.4, 0.01);
    folder.add(options, 'maxDt', 0.01, 0.4, 0.01);
    if (options.hasOwnProperty('speedMult')) {
        folder.add(options, 'speedMult', 0.1, 10, 0.1).listen();
    }
    if (options.hasOwnProperty('maxIterations')) {
        folder.add(options, 'maxIterations', 1, 20, 1);
    }
    if (options.hasOwnProperty('onClick')) {
        folder.add(options, 'onClick', ['', 'change', 'reset', 'addnew']);
    }
    if (options.hasOwnProperty('onChange')) {
        folder.add(options, 'onChange', ['', 'update', 'reset']);
    }
    if (options.hasOwnProperty('maxChanges')) {
        folder.add(options, 'maxChanges', 0, 20, 1);
    }
    if (options.hasOwnProperty('snapBlending')) {
        folder.add(options, 'snapBlending', 1, 5, 1).onChange(onChange);
    }
    if (options.hasOwnProperty('snapOpacity')) {
        folder.add(options, 'snapOpacity', 0, 1.0, 0.01).onChange(onChange);
    }
    if (options.hasOwnProperty('snapOverlay')) {
        folder.add(options, 'snapOverlay').onChange(onChange);
    }
    if (options.hasOwnProperty('showDebug')) {
        folder.add(options, 'showDebug').onChange(onChange);
    }

    dev.createCheckBoxGui(compositions, 'Compositions');
    dev.createCheckBoxGui(palettes, 'Palettes');
}

export const createLayerGUI = (gui, i) => {
    const onChange = () => {
        updateLayer(i);
    }
    const folder = gui.addFolder('Layer '+i);
    const methods = {
        randomize: function() {
            changeLayerOptions(layers[i], true);
        }
    };
    folder.add(layerOptions[i], 'visible', 0, 5, 1).listen().onChange(onChange);
    folder.add(layerOptions[i], 'blendModePass', 0, 5, 1).listen().onChange(onChange);
    folder.add(layerOptions[i], 'blendModeView', 0, 5, 1).listen().onChange(onChange);
    folder.add(layerOptions[i], 'zoom', 0.1, 20, 0.1).listen().onChange(onChange);
    folder.add(layerOptions[i], 'dt', options.minDt, options.maxDt, 0.01).listen().onChange(onChange);
    folder.add(layerOptions[i], 'K', 0, 1, 0.01).listen().onChange(onChange);
    folder.add(layerOptions[i], 'nu', 0, 1, 0.01).listen().onChange(onChange);
    folder.add(layerOptions[i], 'kappa', 0, 1, 0.01).listen().onChange(onChange);
    folder.add(methods, 'randomize');
}