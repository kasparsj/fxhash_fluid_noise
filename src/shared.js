import {chooseComposition} from "fxhash_lib/core";
import {features} from "fxhash_lib/core";

let comp;

function initShared() {
    comp = chooseComposition();
    features.composition = comp;
}

export {comp, initShared};