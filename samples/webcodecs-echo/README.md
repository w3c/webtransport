# wt-demo
This is a demo of a WHATWG Streams-based media pipeline including capture, encode, serialization, transport, deserialization, decode and render. 
W3C APIs utilized include Media Capture & Streams, Mediacapture-transform, WebCodecs and WebTransport. 
In the demo, the main thread handles the UI and capture, and a worker thread is utilized for the media pipeline.
The Javscript client bounces frames sent via reliable/unordered transport (frame/stream) off of an echo server.
To see the demo live, point your browser to:  https://webrtc.internaut.com/wc/wtSender2/
