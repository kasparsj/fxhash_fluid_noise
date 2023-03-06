import {settings, options, compositions, palettes} from "fxhash_lib/core";

const name = 'fluid_noise';

export const devMode = true;

Object.assign(settings, {
    name,
    cam: 'orthographic',
});

Object.assign(options, {
    minLayers: 2,
    maxLayers: 2,
    minDt: 0.15,
    maxDt: 0.25,
    onClick: 'change',
    onChange: 'update',
    snapOverlay: false,
    snapBlending: 3,
    snapOpacity: 3,
    maxChanges: 0,
    noiseMin: 0.2,
    noiseMax: 1.0,
    fluidDiv: 1.0,
    background: true,
});

Object.assign(compositions, {
    sea: true,
    sand: true,
    stone: true,
    cells: true,
    glitch: false,
    pnoise: false,
    box: false,
});

Object.assign(palettes, {
    'Black&White': false,
    'Mono': false,
    'Analogous': false,
    'Complementary': false,
    'randomColor': true,
});

export const lightOptions = {
    ambLight: true,
    ambColor: 0x404040,
    ambIntensity: 0.1,
    camLight: true,
    camLightColor: 0xFFFFFF,
    camLightIntensity: 0.5,
    sunLight: true,
    sunLightColor: 0xFFFFFF,
    sunLightIntensity: 0.7,
    sunElevation: 45,
    sunAzimuth: 90,
    hemiLight: true,
    hemiSkyColor: 0x3284ff,
    hemiGroundColor: 0xffffff,
    hemiIntensity: 0.6,
};

export const effectOptions = {
    enabled: false,
    gammaCorrection: false,
    bloom: 0,
    //hBlur: 1 / window.innerWidth / 2,
    //vBlur: 1 / window.innerHeight / 2,
    film: false,
    noiseType: 'glsl-film-grain',
    noiseIntensity: 0.35,
    scanlinesIntensity: 0.25,
    scanlinesCount: 0,
    grayscale: true,
    dotScreen: false,
    dotScale: 0,
    //rgbShift: 0,
    sepia: 0,
    fxaa: false,
    //bleach: 0,
    //colorify: false,
    //pixelate: false,
};
