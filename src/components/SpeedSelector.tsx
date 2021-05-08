import React from "react";

export interface Props {
    setSpeed: (speed: number) => void;
}

export const SpeedSelector = ({ setSpeed }: Props) => (
    <div style={{ position: "absolute", top: 0, right: 0 }}>
        <button onClick={() => setSpeed(0)}>Pause</button>
        <button onClick={() => setSpeed(0.01)}>Slow</button>
        <button onClick={() => setSpeed(0.1)}>Normal</button>
        <button onClick={() => setSpeed(1)}>Fast</button>
    </div>
);
