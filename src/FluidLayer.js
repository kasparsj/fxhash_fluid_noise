// Based on https://multiuser-fluid.glitch.me/ by pschroen

import {
    HalfFloatType,
    Vector2, Vector4,
} from 'three';
import * as mats from "fxhash_lib/materials";
import {FluidStroke} from "./FluidStroke";
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {RenderPingPong} from "../../fxhash_lib/RenderPingPong";

export class FluidLayer {
    constructor(options) {
        this.strokes = [];
        this.mouseStroke = null;
        this.width = 1;
        this.height = 1;
        this.mesh = null;
        this.options = {};
        this.setOptions(options);

        //this.color = new Vector4(0, 23, 21);
        //this.color = new Vector4(1, 0, 100, 10.0); // blue-orange
        this.color = new Vector4(100, 100, 100, 100.0); // white
        //this.color = new Vector4(0.7590774552860455, 0.6490608849544626, 0.6129674876890556);

        this.initRenderer();
    }

    setOptions(options) {
        Object.assign(this.options, options);
        this.fluid = {
            dt: options.dt || 0.15,
            K: options.K || 0.2,
            nu: options.nu || 0.5,
            kappa: options.kappa || 0.1,
        };
    }

    static createMesh() {
        const mesh = (new FullScreenQuad()._mesh);
        mesh.frustumCulled = false;
        return mesh;
    }

    initMesh() {
        this.mesh = FluidLayer.createMesh();
        return this.mesh;
    }

    initRenderer() {
        this.renderPingPong = new RenderPingPong(this.width, this.height, {
            type: HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false,
            generateMipmaps: false,
        });

        this.passMaterial = mats.fluidPass({
            blending: this.options.blendModePass,
            transparent: this.options.transparent,
        }, this.options);
        this.viewMaterial = mats.fluidView({
            blending: this.options.blendModeView,
            transparent: this.options.transparent,
        }, this.options);

        this.initUniforms();
    }

    initUniforms() {
        for (let i = 0; i < this.options.numStrokes; i++) {
            this.passMaterial.uniforms.uMouse.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uLast.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uVelocity.value[i] = new Vector2();
            this.passMaterial.uniforms.uStrength.value[i] = new Vector2();
        }
        this.viewMaterial.uniforms.uColor.value = new Vector4();
    }

    initMouseStroke() {
        if (this.mouseStroke) {
            return;
        }

        this.mouseStroke = new FluidStroke(0.5, 0.5);

        const onTouchStart = ev => {
            ev.preventDefault();
            this.mouseStroke.isDown = true;
            onTouchMove(ev);
        };

        const onTouchMove = ev => {
            const event = {};

            if (ev.changedTouches && ev.changedTouches.length) {
                event.x = ev.changedTouches[0].pageX;
                event.y = ev.changedTouches[0].pageY;
            } else {
                event.x = ev.clientX;
                event.y = ev.clientY;
            }

            this.mouseStroke.isMove = true;
            this.mouseStroke.pos.set(event.x / this.width, event.y / this.height);
        };

        const onTouchEnd = ev => {
            this.mouseStroke.isDown = false;
            onTouchMove(ev);
        };

        window.addEventListener('touchstart', onTouchStart);
        window.addEventListener('mousedown', onTouchStart);
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('mousemove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd);
        window.addEventListener('mouseup', onTouchEnd);
    }

    addStroke = (stroke) => {
        if (this.strokes.length >= this.options.numStrokes) {
            return false;
        }
        const i = this.strokes.length;
        this.strokes.push(stroke);
        this.passMaterial.uniforms.uMouse.value[i].set(stroke.pos.x, stroke.pos.y);
        this.passMaterial.uniforms.uLast.value[i].set(stroke.pos.x, stroke.pos.y);
        return true;
    }

    resize = (width, height, dpr) => {
        this.width = width;
        this.height = height;

        this.renderPingPong.setSize(width * dpr, height * dpr);

        if (this.mouseStroke) {
            this.mouseStroke.pos.set(0.5, 0.5);
            this.mouseStroke.last.copy(this.mouseStroke.pos);
        }
    };

    update = (renderer, scene, camera, mesh) => {
        for (let i=0; i<this.strokes.length; i++) {
            this.updateStroke(i);
        }
        // todo: mousePointer not working!

        this.passMaterial.uniforms.tMap.value = this.renderPingPong.texture;
        this.passMaterial.uniforms.dt.value = this.fluid.dt;
        this.passMaterial.uniforms.K.value = this.fluid.K;
        this.passMaterial.uniforms.nu.value = this.fluid.nu;
        this.passMaterial.uniforms.kappa.value = this.fluid.kappa;

        mesh = mesh || this.mesh;
        mesh.material = this.passMaterial;
        this.renderPingPong.render(renderer, scene, camera);
        this.renderPingPong.swap();

        this.viewMaterial.uniforms.tMap.value = this.renderPingPong.texture;
        this.viewMaterial.uniforms.uColor.value.copy(this.color);
        mesh.material = this.viewMaterial;
    };

    updateStroke = (i) => {
        const stroke = this.strokes[i];
        stroke.update();
        stroke.delta.subVectors(stroke.pos, stroke.last);
        this.strokes[i].last.copy(stroke.pos);

        const deltaPx = stroke.delta.clone().multiply(new Vector2(this.width, this.height));
        const distaPx = Math.min(10, deltaPx.length()) / 10;

        this.passMaterial.uniforms.uLast.value[i].copy(this.passMaterial.uniforms.uMouse.value[i]);
        this.passMaterial.uniforms.uMouse.value[i].set(stroke.pos.x, 1.0 - stroke.pos.y);
        this.passMaterial.uniforms.uVelocity.value[i].copy(deltaPx);
        this.passMaterial.uniforms.uStrength.value[i].set(stroke.isDown ? 50 : 50 * distaPx, 50 * distaPx);
    }
}
