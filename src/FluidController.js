// Based on https://multiuser-fluid.glitch.me/ by pschroen

import {
    HalfFloatType,
    Vector2, Vector4,
    WebGLRenderTarget
} from 'three';
import * as mats from "fxhash_lib/materials";
import {FluidPointer} from "./FluidPointer";

export class FluidController {
    constructor(options) {
        this.pointers = [];
        this.mousePointer = null;
        this.width = 1;
        this.height = 1;
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

    initRenderer() {
        // Render targets
        this.renderTargetA = new WebGLRenderTarget(this.width, this.height, {
            type: HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        });
        this.renderTargetA.texture.generateMipmaps = false;
        this.renderTargetB = this.renderTargetA.clone();

        this.passMaterial = mats.fluidPass({
            blending: this.options.blendModePass,
        }, this.options);
        this.viewMaterial = mats.fluidView({
            blending: this.options.blendModeView,
        }, this.options);

        this.initUniforms();
    }

    initUniforms() {
        for (let i = 0; i < this.options.numPointers; i++) {
            this.passMaterial.uniforms.uMouse.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uLast.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uVelocity.value[i] = new Vector2();
            this.passMaterial.uniforms.uStrength.value[i] = new Vector2();
        }
        this.viewMaterial.uniforms.uColor.value = new Vector4();
    }

    initMousePointer() {
        if (this.mousePointer) {
            return;
        }

        this.mousePointer = new FluidPointer(this.width / 2, this.height / 2);

        const onTouchStart = ev => {
            ev.preventDefault();
            this.mousePointer.isDown = true;
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

            this.mousePointer.isMove = true;
            this.mousePointer.pos.copy(event);
        };

        const onTouchEnd = ev => {
            this.mousePointer.isDown = false;
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

    addPointer = (x, y, speed) => {
        if (this.pointers.length >= this.options.numPointers) {
            return;
        }

        const pointer = new FluidPointer(x * this.width, y * this.height, speed);
        this.pointers.push(pointer);
        return pointer;
    }

    setPointer = (idx, x, y, speed, isDown) => {
        if (!this.pointers[idx]) {
            return;
        }

        this.pointers[idx].speed = speed;
        this.pointers[idx].target.set(x * this.width, y * this.height);
        this.pointers[idx].isDown = isDown;
        return this.pointers[idx];
    };

    /**
     * Public methods
     */

    resize = (width, height, dpr) => {
        this.width = width;
        this.height = height;

        this.renderTargetA.setSize(width * dpr, height * dpr);
        this.renderTargetB.setSize(width * dpr, height * dpr);

        if (this.mousePointer) {
            this.mousePointer.pos.set(this.width / 2, this.height / 2);
            this.mousePointer.last.copy(this.mousePointer.pos);
        }
    };

    update = (mesh, renderer, scene, camera) => {
        for (let i=0; i<this.pointers.length; i++) {
            const pointer = this.pointers[i];
            pointer.update();
            pointer.delta.subVectors(pointer.pos, pointer.last);
            this.pointers[i].last.copy(pointer.pos);

            const distance = Math.min(10, pointer.delta.length()) / 10;

            this.passMaterial.uniforms.uLast.value[i].copy(this.passMaterial.uniforms.uMouse.value[i]);
            this.passMaterial.uniforms.uMouse.value[i].set(pointer.pos.x / this.width, (this.height - pointer.pos.y) / this.height);
            this.passMaterial.uniforms.uVelocity.value[i].copy(pointer.delta);
            this.passMaterial.uniforms.uStrength.value[i].set(pointer.isDown ? 50 : 50 * distance, 50 * distance);
        }

        this.passMaterial.uniforms.tMap.value = this.renderTargetA.texture;
        this.passMaterial.uniforms.dt.value = this.fluid.dt;
        this.passMaterial.uniforms.K.value = this.fluid.K;
        this.passMaterial.uniforms.nu.value = this.fluid.nu;
        this.passMaterial.uniforms.kappa.value = this.fluid.kappa;
        mesh.material = this.passMaterial;
        renderer.setRenderTarget(this.renderTargetB);
        renderer.render(scene, camera);

        this.viewMaterial.uniforms.tMap.value = this.renderTargetB.texture;
        this.viewMaterial.uniforms.uColor.value.copy(this.color);
        mesh.material = this.viewMaterial;
        renderer.setRenderTarget(null);

        // Swap render targets
        const renderTarget = this.renderTargetA;
        this.renderTargetA = this.renderTargetB;
        this.renderTargetB = renderTarget;
    };
}
