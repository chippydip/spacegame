var ws = new WebSocket("ws://" + location.host + "/websocket");

ws.onopen = function() {
    ws.send("ping2");
    console.log("First message sent");
};

ws.onmessage = function (evt) {
    console.log(evt.data);
    if(evt.data == "pong") {
        setTimeout(function(){ws.send("ping");}, 2000);
    }
};

ws.onclose = function() {
    console.log("Connection closed");
    window.close();
};
