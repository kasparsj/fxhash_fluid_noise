import {
    HalfFloatType,
    Vector2, Vector3, Vector4,
    WebGLRenderTarget
} from 'three';
import * as materials from "fxhash_lib/materials";

export class FluidController {
    static init(screen, options) {
        this.screen = screen;
        this.options = options;

        this.pointer = {};
        this.width = 1;
        this.height = 1;

        this.fluid = {
            dt: 0.2, //0.15,
            K: 0.5, //0.2,
            nu: 0.4, //0.5,
            kappa: 0.6, //0.1
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

        // Fluid materials
        this.passMaterial = materials.fluidPass(this.options);
        this.viewMaterial = materials.fluidView(this.options);
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
        // Data.Socket.on('motion', this.onMotion);
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
        if (!this.animatedIn) {
            return;
        }

        if (!document.getElementsByClassName('modal').length) {
            e.preventDefault();
        }
        this.pointer.main.isDown = true;

        this.onTouchMove(e);
    };

    static onTouchMove = e => {
        if (!this.animatedIn) {
            return;
        }

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

        this.send(event);
    };

    static onTouchEnd = e => {
        if (!this.animatedIn) {
            return;
        }

        this.pointer.main.isDown = false;

        this.onTouchMove(e);
    };

    static onMotion = e => {
        if (!this.pointer[e.id]) {
            if (Object.keys(this.pointer).length >= this.options.numPointers) {
                return;
            }

            this.pointer[e.id] = {};
            this.pointer[e.id].isDown = false;
            this.pointer[e.id].pos = new Vector2();
            this.pointer[e.id].last = new Vector2();
            this.pointer[e.id].delta = new Vector2();
            this.pointer[e.id].target = new Vector2();
            this.pointer[e.id].target.set(e.x * this.width, e.y * this.height);
            this.pointer[e.id].pos.copy(this.pointer[e.id].target);
            this.pointer[e.id].last.copy(this.pointer[e.id].pos);
            // this.pointer[e.id].tracker = this.trackers.add(new Tracker());
            // this.pointer[e.id].tracker.css({ left: Math.round(this.pointer[e.id].pos.x), top: Math.round(this.pointer[e.id].pos.y) });
            // this.pointer[e.id].tracker.setData(Data.getUser(e.id));
        }

        this.pointer[e.id].isDown = e.isDown;
        this.pointer[e.id].target.set(e.x * this.width, e.y * this.height);
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

    static update = (renderer, scene, camera) => {
        if (!this.animatedIn) {
            return;
        }

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
        this.screen.material = this.passMaterial;
        renderer.setRenderTarget(this.renderTargetB);
        renderer.render(scene, camera);

        this.viewMaterial.uniforms.tMap.value = this.renderTargetB.texture;
        this.viewMaterial.uniforms.uColor.value.copy(this.color);
        this.screen.material = this.viewMaterial;
        renderer.setRenderTarget(null);

        // Swap render targets
        const renderTarget = this.renderTargetA;
        this.renderTargetA = this.renderTargetB;
        this.renderTargetB = renderTarget;
    };

    static send = e => {
        // Data.Socket.send('motion', {
        //     isDown: this.pointer.main.isDown,
        //     x: e.x / this.width,
        //     y: e.y / this.height
        // });
    };

    static animateIn = () => {
        this.animatedIn = true;
    };
}
