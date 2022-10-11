# wt-demo
This is a demo of a WHATWG Streams-based media pipeline including capture, encode, serialization, transport, deserialization, decode and render. 
W3C APIs utilized include Media Capture & Streams, Mediacapture-transform, WebCodecs and WebTransport. 
In the demo, the main thread handles the UI and capture, and a worker thread is utilized for the media pipeline.
The Javscript client bounces frames sent via reliable/unordered transport (frame/stream) off of an echo server.
Note: The demo now support Bring Your Own Buffer (BYOB) reading, which requires Chrome Canary M108+. 

To see the demo live, point your browser to:  https://webrtc.internaut.com/wc/wtSender4/

An earlier version of the demo which does not require BYOB (and therefore can run on Chrome Stable) is available at: 
https://webrtc.internaut.com/wc/wtSender2/
