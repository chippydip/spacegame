export type System = (Barycenter | Body);

export interface Orbit {
    // orbital path
    a: number; // semi-major axis
    e: number; // eccentricity
    //b: number; // semi-minor axis = a * Math.sqrt(1 - e*e)
    //c: number; // linear eccentricity = Math.sqrt(a*a - b*b)
    pomega: number; // logitude of periapsis = longitude of ascending node + argument of periapsis

    // body position
    M0: number; // mean anomaly at epoch (J2000)
    n: number; // mean angular motion (per day)
}

export interface Orbitable {
    name: string;
    radius: number;
    mass: number;
    soi: number;
    orbit: Orbit;
    satellites?: System[];

}

export interface Barycenter extends Orbitable {
}

export enum BodyType {

}

export interface Body extends Orbitable {
    type: BodyType;
}

export function isBody(arg: Orbitable): arg is Body {
    return (arg as any).type !== undefined;
}
