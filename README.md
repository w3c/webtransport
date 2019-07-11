# WebTransport

API that allows web applications to establish interactive, bidirectional, multiplexed network connections

It fills gaps in the web platform:
- Lack of UDP-like networking API
- Lack of WebSocket-like API without head-of-line blocking

It provides:
- Reliable streams 
- Unreliable datagrams
- Encryption and congestion control
- An origin-based security model
- Bindings for QUIC
- Multiplexing with existing HTTP/3 connections
- Flexible API that can be extended to other protocols, such as TCP fallback and p2p
- Ability to change transport without changing application code

It's great for:
- sending or receiving high-frequency, small messages that don't need to be reliable (like game state)
- sending or receiving low-latency media
- transferring files

See the [explainer](https://github.com/wicg/web-transport/blob/master/explainer.md) for more info.

See the [proposed spec](https://wicg.github.io/web-transport/).

Note that the proposed spec is out of date compared to the explainer because new
ideas are first developed in the explainer before the spec. In particular, at
this time the explainer uses ReadableStreams and WritableStreams (aka WHATWG
streams) and the spec does not.
