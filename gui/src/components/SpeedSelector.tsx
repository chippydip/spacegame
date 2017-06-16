import * as React from "react";

export interface SpeedSelectorProps {
    onSpeedSet: (deltaT: number) => void;
}

export class SpeedSelector extends React.Component<SpeedSelectorProps, undefined> {
    render() {
        return (
            <div style={{position: "absolute", top: 0, right: 0, color: "red"}}>
                <button onClick={() => this.props.onSpeedSet(0)}>Pause</button>
                <button onClick={() => this.props.onSpeedSet(0.01)}>Slow</button>
                <button onClick={() => this.props.onSpeedSet(0.1)}>Normal</button>
                <button onClick={() => this.props.onSpeedSet(1)}>Fast</button>
            </div>
        );
    }
}
