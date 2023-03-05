import {chooseComposition, options} from "fxhash_lib/core";
import * as FXRand from "fxhash_lib/random";
import {features} from "fxhash_lib/fluid";

let comp;

function initShared() {
    comp = chooseComposition();
    features.composition = comp;
}

export {comp, initShared};