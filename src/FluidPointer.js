import {Vector2} from "three";

export class FluidPointer
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

    reset() {
        this.pos.copy(this.start);
        this.last.copy(this.pos);
    }

}