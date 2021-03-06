import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { isBody, Orbit, System } from "../models/SolarSystem";

interface SystemObject {
    name: string;
    radius: number;
    orbit: Orbit;
    frame: THREE.Object3D;
    body: THREE.Object3D;
    label: HTMLCanvasElement | null;
    parent?: SystemObject;
    system: System;
}

export interface Props {
    system: System;
    deltaT: number;
}

export const SystemMap = (props: Props) => {
    const wrapper = useRef<HTMLDivElement>(null);
    const webGL = useRef<HTMLCanvasElement>(null);
    const overlay = useRef<HTMLCanvasElement>(null);

    const [runner] = useState(() => new SystemMapRunner(props));
    runner.updateProps(props);

    useEffect(() => {
        runner.mount(
            requireRef(wrapper, "wrapper"),
            requireRef(webGL, "gl canvas"),
            requireRef(overlay, "overlay canvas"),
        );

        return () => runner.unmount();
    }, [runner]);

    return (
        <div ref={wrapper} style={{ width: "100%", height: "100%" }}>
            <canvas ref={webGL} />
            <canvas ref={overlay} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        </div>
    );
};

const requireRef = <T extends unknown>(ref: React.RefObject<T>, name?: string) => {
    const { current } = ref;
    if (!current) {
        throw new Error(`Expected RefObject ${name} not found`);
    }
    return current;
};

class SystemMapRunner {
    private props: Props;

    constructor(props: Props) {
        this.props = props;
    }

    public updateProps(props: Props) {
        this.props = props;
    }

    private wrapper?: HTMLElement;
    private webGL?: HTMLCanvasElement;
    private overlay?: HTMLCanvasElement;

    public mount(wrapper: HTMLElement, webGL: HTMLCanvasElement, overlay: HTMLCanvasElement) {
        this.wrapper = wrapper;
        this.webGL = webGL;
        this.overlay = overlay;

        this.webGL.addEventListener("contextmenu", this.onContextMenu, false);
        this.webGL.addEventListener("mousedown", this.onMouseDown, false);
        this.webGL.addEventListener("wheel", this.onMouseWheel, false);

        window.addEventListener("keydown", this.onKeyDown, false);

        this.init();
        this.drawLoop();
    }

    private rafHandle: number = 0;

    private drawLoop = () => {
        this.rafHandle = requestAnimationFrame(this.drawLoop);
        this.draw();
    }

    public unmount() {
        cancelAnimationFrame(this.rafHandle);

        window.removeEventListener("keydown", this.onKeyDown, false);

        document.removeEventListener("mousemove", this.onMouseMove, false);
        document.removeEventListener("mouseup", this.onMouseUp, false);

        if (this.webGL) {
            this.webGL.removeEventListener("contextmenu", this.onContextMenu, false);
            this.webGL.removeEventListener("mousedown", this.onMouseDown, false);
            this.webGL.removeEventListener("wheel", this.onMouseWheel, false);
        }
    }

    private onContextMenu = (event: Event) => {
        event.preventDefault();
    }

    private downPos = new THREE.Vector2();
    private panStart = new THREE.Vector2();
    private downTime: number = 0;

    private onMouseDown = (event: MouseEvent) => {
        if (event.button !== THREE.MOUSE.LEFT) {
            return;
        }
        event.preventDefault();

        this.downPos.set(event.clientX, event.clientY);
        this.panStart.copy(this.downPos);
        this.downTime = performance.now();

        document.addEventListener("mousemove", this.onMouseMove, false);
        document.addEventListener("mouseup", this.onMouseUp, false);
    }

    private onMouseMove = (event: MouseEvent) => {
        event.preventDefault();

        const { panStart, focus } = this;
        const { clientX, clientY } = event;

        const dx = (clientX - panStart.x);
        const dy = (clientY - panStart.y);
        if (dx === 0 && dy === 0) {
            return;
        }

        const scale = this.getViewScale();
        focus.set(focus.x - scale * dx, focus.y + scale * dy);
        this.focusObject = null;
        this.isCameraDirty = true;
        console.log('cleared focus', dx, dy);

        panStart.set(clientX, clientY);
    }

    private onMouseUp = (event: MouseEvent) => {
        document.removeEventListener("mousemove", this.onMouseMove, false);
        document.removeEventListener("mouseup", this.onMouseUp, false);

        const elapsed = performance.now() - this.downTime;
        const dx = (event.clientX - this.downPos.x);
        const dy = (event.clientY - this.downPos.y);
        const dist2 = dx * dx + dy * dy;
        console.log('elapsed/dist2', elapsed, dist2);

        if (elapsed < 100 || dist2 < 100) {
            // pick
            const { camera, root } = this;
            if (!camera || !root) {
                return;
            }

            // Screen space -> world space 
            const scale = this.getViewScale();
            const x = scale * event.clientX + camera.left - root.position.x;
            const y = scale * (this.webGL!.clientHeight - event.clientY) + camera.bottom - root.position.y;
            console.log('pick', x, y, camera.zoom, scale);

            // Find nearest body
            var nearest: SystemObject | null = null;
            var distance2 = x * x + y * y; // distance to central body
            for (const obj of this.objects) {
                const pos = this.getObjectPos(obj);
                const dx = pos.x - x;
                const dy = pos.y - y;
                const dist2 = dx * dx + dy * dy;
                if (dist2 < distance2) {
                    nearest = obj;
                    distance2 = dist2;
                }
                //console.log(dist2);
            }
            const pxDist2 = distance2 / scale / scale;
            console.log('nearest', Math.sqrt(distance2), Math.sqrt(pxDist2));

            // Must be within 50px of target
            if (pxDist2 > 2500) {
                console.log('too far');
                return;
            }

            if (nearest) {
                console.log('setting focus: ', nearest.name);
                this.focusObject = nearest;
            } else {
                console.log('clearing focus');
                this.focusObject = null;
                this.focus.set(0, 0);
            }
            this.isCameraDirty = true;
        }
    }

    private onMouseWheel = (event: MouseWheelEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const { deltaY } = event;
        if (deltaY < 0) {
            // zoom in
            this.viewSize /= 1.1;
            this.isCameraDirty = true;
        } else if (deltaY > 0) {
            // zoom out
            this.viewSize *= 1.1;
            this.isCameraDirty = true;
        }
    }

    private onKeyDown = (event: KeyboardEvent) => {
        switch (event.keyCode) {
            case 37: // left arrow
            case 38: // up arrow
            case 39: // right arrow
            case 40: // down arrow
        }
    }

    private getViewScale = () => {
        const { camera } = this;
        if (!camera) {
            return 1;
        }
        return (camera.top - camera.bottom) / this.webGL!.clientHeight;
    }

    private objects: SystemObject[] = [];

    private renderer?: THREE.WebGLRenderer;
    private scene?: THREE.Scene;
    private camera?: THREE.OrthographicCamera;
    private root?: THREE.Object3D;

    private focus = new THREE.Vector2(0, 0);
    private focusObject: SystemObject | null = null;
    private viewSize = 1.6;
    private isCameraDirty = true;

    private orbitMaterial = new THREE.LineBasicMaterial({ color: 0x04000 });
    private bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    private bodyGeometry = new THREE.CircleGeometry(1, 100);

    private init = () => {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.webGL,
            antialias: true,
            //clearColor: 0x000040,
            //logarithmicDepthBuffer: true,
        });
        //this.renderer.setClearColor(0x000040, 1);

        this.scene = new THREE.Scene();

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
        this.camera.position.set(0, 0, 5);

        // TODO: Use ResizeSensor instead
        window.addEventListener('resize', () => {
            this.isCameraDirty = true;
        }, false);

        // const sun = new THREE.Mesh(bodyGeometry, new THREE.MeshBasicMaterial({ color: 0xffff80 }));
        // sun.scale.x = 5;
        // sun.scale.y = 5;
        // this.scene.add(sun);

        this.root = new THREE.Object3D();
        this.initSystem(this.props.system, this.root);

        this.scene.add(this.root);
        this.root = this.scene;
    }

    private initSystem = (system: System, frame: THREE.Object3D, parent?: SystemObject) => {
        const obj = {
            name: system.name,
            radius: system.radius,
            orbit: system.orbit,
            frame,
            body: this.createBody(system),
            label: this.createLabel(system.name),
            parent,
            system,
        };
        frame.add(obj.body);
        this.objects.push(obj);

        const sats = system.satellites;
        if (sats) {
            for (var sat of sats) {
                this.initOrbit(sat, frame, obj);
            }
        }
    }

    private createBody = (system: System): THREE.Object3D => {
        if (isBody(system)) {
            // TODO: Different based on type
            return new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
        } else {
            return new THREE.Object3D();
        }
    }

    private createLabel = (text: string): HTMLCanvasElement | null => {
        if (text.endsWith(" Barycenter")) {
            return null;
        }

        const label = document.createElement("canvas");
        label.width = 100;
        label.height = 30;
        const ctx = label.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.font = "16px sans-serif";
            ctx.fillText(text, 50, 23);
        }
        return label;
    }

    private initOrbit = (system: System, frame: THREE.Object3D, parent: SystemObject) => {
        const obt = system.orbit;
        //obt.e *= 4;
        // Orbit
        var a = obt.a;
        var b = a * Math.sqrt(1 - 1 * obt.e * obt.e);
        var c = Math.sqrt(a * a - b * b);
        //console.log('obt', a, b, c);

        const ellipse = new THREE.EllipseCurve(c, 0, a, b, 1 * Math.PI, 3 * Math.PI, false, 0);
        const points = ellipse.getPoints(3600);

        const ellipseGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(ellipseGeometry, this.orbitMaterial);
        line.rotation.z = obt.pomega + Math.PI;
        frame.add(line);

        const newFrame = new THREE.Object3D();
        frame.add(newFrame);

        this.initSystem(system, newFrame, parent);
    }

    private t = 0;

    private draw = () => {
        // Update orbital positions
        this.updateOrbits();

        // Adjust camera
        const { renderer, focusObject } = this;
        if (this.isCameraDirty || focusObject) {
            const { camera, focus, root } = this;
            if (!camera || !root) {
                return;
            }
            const { offsetWidth, offsetHeight } = this.wrapper!;
            const scale = this.viewSize / Math.min(offsetWidth, offsetHeight);

            if (focusObject) {
                const pos = this.getObjectPos(focusObject);
                focus.set(pos.x, pos.y);
            }

            // camera.left = -offsetWidth*scale + focus.x;
            // camera.right = offsetWidth*scale + focus.x;
            // camera.top = offsetHeight*scale + focus.y;
            // camera.bottom = -offsetHeight*scale + focus.y;

            camera.left = -offsetWidth * scale;
            camera.right = offsetWidth * scale;
            camera.top = offsetHeight * scale;
            camera.bottom = -offsetHeight * scale;

            const pos = root.position;
            pos.x = -focus.x;
            pos.y = -focus.y;

            camera!.updateProjectionMatrix();
            renderer!.setSize(offsetWidth, offsetHeight);
            this.isCameraDirty = false;
        }

        if (!this.overlay) {
            return;
        }

        // Draw overlay
        const ctx = this.overlay!.getContext("2d");
        if (!ctx) { return; }

        const { offsetWidth, offsetHeight } = this.overlay;
        //console.log('w x h', offsetWidth, offsetHeight);
        this.overlay.width = offsetWidth;
        this.overlay.height = offsetHeight;

        const worldToScreen = Math.min(offsetWidth, offsetHeight) / (2 * this.viewSize);

        const focusX = this.focus.x;
        const focusY = this.focus.y;
        const offX = offsetWidth / 2 - 50;
        const offY = offsetHeight / 2;
        for (const obj of this.objects) {
            if (!obj.label) {
                continue;
            }

            const pos = this.getObjectPos(obj);
            const x = (pos.x - focusX) * worldToScreen + offX;
            const y = -(pos.y - focusY) * worldToScreen + offY;

            // Check if the label would be too close to the parent
            // TODO: This should really check for all nearby bodies (by mass?) but this is OK for now
            let parent = obj.parent;
            if (parent && !parent.label && parent.system.satellites) {
                if (obj.system === parent.system.satellites[0]) {
                    parent = parent.parent;
                }
            }

            if (parent) {
                const pPos = this.getObjectPos(parent);
                const pX = (pPos.x - focusX) * worldToScreen + offX;
                const pY = -(pPos.y - focusY) * worldToScreen + offY;
                const d2 = (pX - x) * (pX - x) + (pY - y) * (pY - y);
                if (d2 < 400) {
                    continue;
                }
            }
            ctx.drawImage(obj.label, x, y);
        }

        // Draw
        renderer!.render(this.scene!, this.camera!);
    }

    private updateOrbits = () => {
        //const minScale = this.viewSize / 1.6;

        this.t += this.props.deltaT;
        for (const obj of this.objects) {
            const obt = obj.orbit;
            const M = -(obt.M0 + this.t * obt.n);

            var E = M;
            for (var i = 0; i < 10; ++i) {
                E = M + obt.e * Math.sin(E);
            }

            const th = obt.pomega + 2 * Math.atan2(Math.sqrt(1 - obt.e) * Math.cos(E / 2), Math.sqrt(1 + obt.e) * Math.sin(E / 2));

            const r = -obt.a * (1 - obt.e * Math.cos(E));

            const pos = obj.frame.position;
            pos.x = r * Math.cos(th);
            pos.y = r * Math.sin(th);

            // TODO: min size based on body type?
            const scale = obj.body.scale;
            scale.x = obj.radius;
            scale.y = obj.radius;
        }
    }

    private tmpPos = new THREE.Vector3();

    private getObjectPos = (obj: SystemObject): THREE.Vector3 => {
        const pos = this.tmpPos;
        pos.copy(obj.frame.position);
        for (var parent = obj.parent; parent; parent = parent.parent) {
            pos.add(parent.frame.position);
        }
        return pos;
    }
}
