import {Vector2} from "three";

export class FluidPointer
{
    constructor(x, y) {
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

        // this.tracker = this.trackers.add(new Tracker());
        // this.tracker.css({ left: Math.round(this.pos.x), top: Math.round(this.pos.y) });
        // this.tracker.setData(Data.getUser(id));
    }

    reset() {
        this.pos.copy(this.start);
        this.last.copy(this.pos);
    }

}