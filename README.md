# WebTransport

WebTransport is a web API for flexible data transport.

It provides:
- APIs for reliable streams 
- APIs for unreliable datagrams
- a concrete mapping to client-server QUIC
- the flexibility to map to other protocols, including p2p ones

It can be used:
- like a WebSocket that has with multiple streams and server stream push
- like a UDP socket, but with encryption and congestion control
- with an existing HTTP/3 connection with both HTTP and non-HTTP data over the same QUIC connection.

It's great for:
- sending or receiving high-frequency, small messages that don't need to be reliable (like game state)
- sending or receiving low-latency media

See the [explainer](https://github.com/pthatcherg/web-transport/blob/master/explainer.md) for more info.

See the [spec](https://github.com/pthatcherg/web-transport/blob/master/index.html) for a lot more info.
