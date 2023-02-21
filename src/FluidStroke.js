import {Vector2} from "three";

export class FluidStroke
{
    constructor(x, y, speed) {
        this.isMove = false;
        this.isDown = false;

        this.delta = new Vector2();
        this.start = new Vector2();
        this.target = new Vector2();
        this.pos = new Vector2();
        this.last = new Vector2();

        this.start.set(x, y);
        this.target.copy(this.start);
        this.pos.copy(this.target);
        this.last.copy(this.pos);
        this.speed = speed || 0.07;
    }

    update() {
        this.pos.lerp(this.target, this.speed);
    }

    mirrorX() {
        this.start.set(1.0 - this.start.x, this.start.y);
        this.target.set(1.0 - this.target.x, this.target.y);
        this.pos.set(1.0 - this.pos.x, this.pos.y);
        this.last.set(1.0 - this.last.x, this.last.y);
        return this;
    }

    mirrorY() {
        this.start.set(this.start.x, 1.0 - this.start.y);
        this.target.set(this.target.x, 1.0 - this.target.y);
        this.pos.set(this.pos.x, 1.0 - this.pos.y);
        this.last.set(this.last.x, 1.0 - this.last.y);
        return this;
    }

    mirror() {
        this.start.set(1.0 - this.start.x, 1.0 - this.start.y);
        this.target.set(1.0 - this.target.x, 1.0 - this.target.y);
        this.pos.set(1.0 - this.pos.x, 1.0 - this.pos.y);
        this.last.set(1.0 - this.last.x, 1.0 - this.last.y);
        return this;
    }

    reset() {
        this.pos.copy(this.start);
        this.last.copy(this.pos);
    }

    clone() {
        const stroke = new this.constructor(this.start.x, this.start.y, this.speed);
        stroke.target.set(this.target.x, this.target.y);
        stroke.pos.set(this.pos.x, this.pos.y);
        stroke.last.set(this.last.x, this.last.y);
        stroke.isMove = this.isMove;
        stroke.isDown = this.isDown;
        return stroke;
    }

}