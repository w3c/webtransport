WebTransport is a web API for flexible data transport.

It provides abstractions for reliable streams and unreliable datagrams with a concrete mapping to QUIC.  

It can be used like a WebSocket but with multiple streams and the ability for the server to push streams.

It can be used like a UDP socket, but with encryption and congestion control.

It can be used with an existing HTTP/3 connection to send both HTTP and non-HTTP data over the same QUIC connection.

See the explainer for more info.
