// Based on https://multiuser-fluid.glitch.me/ by pschroen

import {
    HalfFloatType,
    Vector2, Vector4,
    WebGLRenderTarget
} from 'three';
import * as mats from "fxhash_lib/materials";
import {FluidPointer} from "./FluidPointer";

export class FluidController {
    static init(options) {
        this.pointers = {};
        this.width = 1;
        this.height = 1;

        this.setOptions(options);

        //this.color = new Vector4(0, 23, 21);
        //this.color = new Vector4(1, 0, 100, 10.0); // blue-orange
        this.color = new Vector4(100, 100, 100, 100.0); // white
        //this.color = new Vector4(0.7590774552860455, 0.6490608849544626, 0.6129674876890556);

        this.initRenderer();
    }

    static setOptions(options) {
        this.options = options;

        this.fluid = {
            dt: options.dt || 0.15,
            K: options.K || 0.2,
            nu: options.nu || 0.5,
            kappa: options.kappa || 0.1,
        }
    }

    static initRenderer() {
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

    static initUniforms() {
        for (let i = 0; i < this.options.numPointers; i++) {
            this.passMaterial.uniforms.uMouse.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uLast.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uVelocity.value[i] = new Vector2();
            this.passMaterial.uniforms.uStrength.value[i] = new Vector2();
        }
        this.viewMaterial.uniforms.uColor.value = new Vector4();
    }

    static initMousePointer() {
        if (this.pointers.main) {
            return;
        }

        this.pointers.main = new FluidPointer(this.width / 2, this.height / 2);

        const onTouchStart = ev => {
            ev.preventDefault();
            this.pointers.main.isDown = true;
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

            this.pointers.main.isMove = true;
            this.pointers.main.pos.copy(event);
        };

        const onTouchEnd = ev => {
            this.pointers.main.isDown = false;
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

    static addPointer = (id, x, y) => {
        if (Object.keys(this.pointers).length >= this.options.numPointers) {
            return;
        }

        this.pointers[id] = new FluidPointer(x * this.width, y * this.height);
        return this.pointers[id];
    }

    static setPointer = (id, x, y, isDown) => {
        if (!this.pointers[id]) {
            if (!this.addPointer(id, x, y)) {
                return;
            }
        }

        this.pointers[id].isDown = isDown;
        this.pointers[id].target.set(x * this.width, y * this.height);
        return this.pointers[id];
    };

    /**
     * Public methods
     */

    static resize = (width, height, dpr) => {
        this.width = width;
        this.height = height;

        this.renderTargetA.setSize(width * dpr, height * dpr);
        this.renderTargetB.setSize(width * dpr, height * dpr);

        if (this.pointers.main) {
            this.pointers.main.pos.set(this.width / 2, this.height / 2);
            this.pointers.main.last.copy(this.pointers.main.pos);
        }
    };

    static update = (mesh, renderer, scene, camera) => {
        Object.keys(this.pointers).forEach((id, i) => {
            if (id !== 'main') {
                this.pointers[id].pos.lerp(this.pointers[id].target, this.options.speed || 0.07);
                //this.pointers[id].tracker.css({ left: Math.round(this.pointers[id].pos.x), top: Math.round(this.pointers[id].pos.y) });

                // if (!this.pointers[id].tracker.animatedIn) {
                //     this.pointers[id].tracker.animateIn();
                // }
            }

            this.pointers[id].delta.subVectors(this.pointers[id].pos, this.pointers[id].last);
            this.pointers[id].last.copy(this.pointers[id].pos);

            const distance = Math.min(10, this.pointers[id].delta.length()) / 10;

            this.passMaterial.uniforms.uLast.value[i].copy(this.passMaterial.uniforms.uMouse.value[i]);
            this.passMaterial.uniforms.uMouse.value[i].set(this.pointers[id].pos.x / this.width, (this.height - this.pointers[id].pos.y) / this.height);
            this.passMaterial.uniforms.uVelocity.value[i].copy(this.pointers[id].delta);
            this.passMaterial.uniforms.uStrength.value[i].set((id === 'main' && !this.pointers[id].isMove) || this.pointers[id].isDown ? 50 : 50 * distance, 50 * distance);

            //AudioController.update(id, this.pointers[id].pos.x, this.pointers[id].pos.y);
        });

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
