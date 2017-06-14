import * as React from "react";
import * as ReactDOM from "react-dom";

import { SystemMap } from "./components/SystemMap";
import { sol } from "./models/sol"

ReactDOM.render(
    <SystemMap system={sol} />,
    document.getElementById("app")
);
