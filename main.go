package main

import (
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/skratchdot/open-golang/open"
)

var listener net.Listener

func main() {
	http.HandleFunc("/websocket", ws)

	fs := http.FileServer(http.Dir("gui"))
	http.HandleFunc("/", fs.ServeHTTP)

	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	listener = l
	fmt.Println("listening on", listener.Addr().String())
	open.Run("http://" + listener.Addr().String())
	panic(http.Serve(listener, nil))
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func ws(w http.ResponseWriter, r *http.Request) {
	defer func() {
		fmt.Println("exiting")
		//listener.Close()
	}()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(err)
		return
	}

	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			fmt.Println(err)
			return
		}
		if string(msg) == "ping" {
			fmt.Println("ping")
			time.Sleep(2 * time.Second)
			err = conn.WriteMessage(msgType, []byte("pong"))
			if err != nil {
				fmt.Println(err)
				return
			}
		} else {
			fmt.Println(string(msg))
		}
	}
}
