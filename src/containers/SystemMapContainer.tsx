import * as React from "react";
import { SpeedSelector } from "../components/SpeedSelector";
import { SystemMap } from "../components/SystemMap";
import { sol } from "../models/sol";

interface SystemMapContainerState {
    deltaT: number;
}

export class SystemMapContainer extends React.Component<{}, SystemMapContainerState> {
    constructor(props: {}) {
        super(props);

        this.state = {
            deltaT: 0.1
        };
    }

    render() {
        return (
            <div style={{ width: "100%", height: "100%" }}>
                <SystemMap system={sol} deltaT={this.state.deltaT} />
                <SpeedSelector onSpeedSet={this.onSpeedSet} />
            </div>
        );
    }

    private onSpeedSet = (deltaT: number) => {
        this.setState({
            deltaT
        });
    }
}
