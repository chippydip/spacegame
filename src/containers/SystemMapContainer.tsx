import React, { useState } from "react";
import { SpeedSelector } from "../components/SpeedSelector";
import { SystemMap } from "../components/SystemMap";
import { sol } from "../models/sol";

export const SystemMapContainer = () => {
    const [speed, setSpeed] = useState(0.1);
    return (
        <div style={{ width: "100%", height: "100%" }}>
            <SystemMap system={sol} deltaT={speed} />
            <SpeedSelector setSpeed={setSpeed} />
        </div>
    );
};
