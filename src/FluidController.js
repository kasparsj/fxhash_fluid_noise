import {
    HalfFloatType,
    Vector2, Vector4,
    WebGLRenderTarget
} from 'three';
import * as mats from "fxhash_lib/materials";

export class FluidController {
    static init(options) {
        this.options = options;

        this.pointer = {};
        this.width = 1;
        this.height = 1;

        this.fluid = {
            dt: options.dt, //0.15,
            K: options.K, //0.2,
            nu: options.nu, //0.5,
            kappa: options.kappa, //0.1
        }
        //this.color = new Vector4(0, 23, 21);
        //this.color = new Vector4(1, 0, 100, 10.0); // blue-orange
        this.color = new Vector4(100, 100, 100, 100.0); // white
        //this.color = new Vector4(0.7590774552860455, 0.6490608849544626, 0.6129674876890556);

        this.initRenderer();
        this.initPointers();
        this.addListeners();
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
    }

    static initPointers() {
        for (let i = 0; i < this.options.numPointers; i++) {
            this.passMaterial.uniforms.uMouse.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uLast.value[i] = new Vector2(0.5, 0.5);
            this.passMaterial.uniforms.uVelocity.value[i] = new Vector2();
            this.passMaterial.uniforms.uStrength.value[i] = new Vector2();
        }
        this.viewMaterial.uniforms.uColor.value = new Vector4();

        this.pointer.main = {};
        this.pointer.main.isMove = false;
        this.pointer.main.isDown = false;
        this.pointer.main.pos = new Vector2();
        this.pointer.main.last = new Vector2();
        this.pointer.main.delta = new Vector2();
        this.pointer.main.pos.set(this.width / 2, this.height / 2);
        this.pointer.main.last.copy(this.pointer.main.pos);
    }

    static addListeners() {
        //Stage.events.on(Events.UPDATE, this.onUsers);
        window.addEventListener('touchstart', this.onTouchStart);
        window.addEventListener('mousedown', this.onTouchStart);
        window.addEventListener('touchmove', this.onTouchMove);
        window.addEventListener('mousemove', this.onTouchMove);
        window.addEventListener('touchend', this.onTouchEnd);
        window.addEventListener('touchcancel', this.onTouchEnd);
        window.addEventListener('mouseup', this.onTouchEnd);
    }

    /**
     * Event handlers
     */

    static onUsers = e => {
        const ids = e.map(user => user.id);

        Object.keys(this.pointer).forEach((id, i) => {
            if (id === 'main') {
                return;
            }

            // const tracker = this.pointer[id].tracker;
            //
            // if (ids.includes(id)) {
            //     tracker.setData(Data.getUser(id));
            // } else {
            //     tracker.animateOut(() => {
            //         tracker.destroy();
            //     });
            //
            //     delete this.pointer[id];
            //
            //     this.passMaterial.uniforms.uMouse.value[i] = new Vector2(0.5, 0.5);
            //     this.passMaterial.uniforms.uLast.value[i] = new Vector2(0.5, 0.5);
            //     this.passMaterial.uniforms.uVelocity.value[i] = new Vector2();
            //     this.passMaterial.uniforms.uStrength.value[i] = new Vector2();
            //
            //     //AudioController.remove(id);
            // }
        });
    };

    static onTouchStart = e => {
        e.preventDefault();
        this.pointer.main.isDown = true;

        this.onTouchMove(e);
    };

    static onTouchMove = e => {
        const event = {};

        if (e.changedTouches && e.changedTouches.length) {
            event.x = e.changedTouches[0].pageX;
            event.y = e.changedTouches[0].pageY;
        } else {
            event.x = e.clientX;
            event.y = e.clientY;
        }

        this.pointer.main.isMove = true;
        this.pointer.main.pos.copy(event);
    };

    static onTouchEnd = e => {
        this.pointer.main.isDown = false;

        this.onTouchMove(e);
    };

    static addPointer = (id, x, y) => {
        if (Object.keys(this.pointer).length >= this.options.numPointers) {
            return;
        }

        this.pointer[id] = {};
        this.pointer[id].isDown = false;
        this.pointer[id].pos = new Vector2();
        this.pointer[id].last = new Vector2();
        this.pointer[id].delta = new Vector2();
        this.pointer[id].target = new Vector2();
        this.pointer[id].target.set(x * this.width, y * this.height);
        this.pointer[id].pos.copy(this.pointer[id].target);
        this.pointer[id].last.copy(this.pointer[id].pos);
        // this.pointer[id].tracker = this.trackers.add(new Tracker());
        // this.pointer[id].tracker.css({ left: Math.round(this.pointer[id].pos.x), top: Math.round(this.pointer[id].pos.y) });
        // this.pointer[id].tracker.setData(Data.getUser(id));
    }

    static setPointer = (id, x, y, isDown) => {
        if (!this.pointer[id]) {
            this.addPointer(id, x, y);
        }

        this.pointer[id].isDown = isDown;
        this.pointer[id].target.set(x * this.width, y * this.height);
    };

    /**
     * Public methods
     */

    static resize = (width, height, dpr) => {
        this.width = width;
        this.height = height;

        this.renderTargetA.setSize(width * dpr, height * dpr);
        this.renderTargetB.setSize(width * dpr, height * dpr);

        this.pointer.main.pos.set(this.width / 2, this.height / 2);
        this.pointer.main.last.copy(this.pointer.main.pos);
    };

    static update = (mesh, renderer, scene, camera) => {
        Object.keys(this.pointer).forEach((id, i) => {
            if (id !== 'main') {
                this.pointer[id].pos.lerp(this.pointer[id].target, 0.07);
                //this.pointer[id].tracker.css({ left: Math.round(this.pointer[id].pos.x), top: Math.round(this.pointer[id].pos.y) });

                // if (!this.pointer[id].tracker.animatedIn) {
                //     this.pointer[id].tracker.animateIn();
                // }
            }

            this.pointer[id].delta.subVectors(this.pointer[id].pos, this.pointer[id].last);
            this.pointer[id].last.copy(this.pointer[id].pos);

            const distance = Math.min(10, this.pointer[id].delta.length()) / 10;

            this.passMaterial.uniforms.uLast.value[i].copy(this.passMaterial.uniforms.uMouse.value[i]);
            this.passMaterial.uniforms.uMouse.value[i].set(this.pointer[id].pos.x / this.width, (this.height - this.pointer[id].pos.y) / this.height);
            this.passMaterial.uniforms.uVelocity.value[i].copy(this.pointer[id].delta);
            this.passMaterial.uniforms.uStrength.value[i].set((id === 'main' && !this.pointer[id].isMove) || this.pointer[id].isDown ? 50 : 50 * distance, 50 * distance);

            //AudioController.update(id, this.pointer[id].pos.x, this.pointer[id].pos.y);
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
