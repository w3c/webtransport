# WebTransport Explainer

## Abstract

WebTransport is a web API that provides low-latency, bidirectional, client-server communication. It is designed for applications that require the performance of QUIC (the transport layer of HTTP/3)—such as high-frequency state synchronization and media streaming—while maintaining a secure, origin-based web model. It supports both reliable streams and unreliable datagrams.

## Problem and Background

Many applications, such as games and live streaming, need a mechanism to send many messages as quickly as possible, possibly out of order, and possibly unreliably from client to server or server to client.  The web platform is missing the capability to do this easily.

Native applications can use raw UDP sockets, but those are not available on the web because they lack encryption, congestion control, and a mechanism for consent to send (to prevent DDoS attacks).

Historically, web applications that needed bidirectional data stream between a client and a server could rely on WebSockets [RFC6455], a message-based protocol compatible with Web security model.  However, since the abstraction it provides is a single, reliable, ordered stream of messages, it suffers from head-of-line blocking (HOLB), meaning that all messages must be sent and received in order even if they are independent and some of them are no longer needed.  This makes it a poor fit for latency sensitive applications which rely on partial reliability and stream independence for performance.

Currently, web developers needing low-latency communication face a trade-off:

* **WebSockets** are easy to use but run over TCP, meaning a single lost packet delays all subsequent data (head-of-line blocking).
* **WebRTC Data Channels** support unreliable UDP-like transport but are architected for Peer-to-Peer (P2P). Using them for client-server communication requires a complex "fake peer" setup involving ICE, STUN, and TURN.
* **HTTP/2 and HTTP/3 (Fetch)** are request-response oriented and do not easily support long-lived, bidirectional, "push-style" data flow with custom reliability.

We think there is a room for a simple, client-server, unordered/unreliable API with minimal latency.  The WebTransport protocol provides this with a single transport object that abstracts away the specific underlying protocol with a flexible set of possible capabilities including reliable unidirectional and bidirectional streams, and unreliable datagrams
(much like the capabilities of QUIC).

## Goals

* **Low Latency**: Enable unreliable datagrams and independent reliable streams to eliminate head-of-line blocking. 
* **Multiplexing**: Support many simultaneous data flows over one connection.
* **Capability Negotiation**: Allow clients and servers to negotiate subprotocols and transport reliability (UDP vs. TCP fallback).
* **Fine-grained Flow Control**: Provide "Send Groups" and "Atomic Writes" to manage bandwidth across different data types.
* **Security & Privacy**: Enforce TLS 1.3, origin checks, and mitigations against cross-site tracking.

## Non-Goals

* **Peer-to-Peer**: WebTransport is strictly client-server. P2P use cases should continue to use WebRTC.
* **Universal UDP**: This is not "raw UDP." All traffic is congestion-controlled and encrypted.

## Use Cases

1. **Cloud Gaming & Remote Desktop**: Sending user input (reliable) while receiving high-frequency video frames and input state (unreliable).
2. **Live Streaming**: Pushing media chunks to a server with low overhead.
3. **Collaborative Editing**: Sending cursor positions (unreliable) while ensuring document changes (reliable) are persisted.
4. **Internet of Things (IoT)**: Efficiently multiplexing sensor data from thousands of devices.
5. **Financial Tickers**: Delivering high-frequency market data where the latest packet is the most valuable.

Additional use-cases are described in the [original use-cases](https://github.com/w3c/webtransport/blob/main/use-cases.md) document. 

---

## Proposed Solution: Key Scenarios

### 1. Connection, Reliability, and Subprotocol Negotiation

Applications can now propose a list of subprotocols (similar to WebSockets), and specify if they require the performance of an unreliable (UDP/QUIC) transport if a reliable-only (TCP/H2) fallback is undesirable. See the additional [explainer on Subprotocol negotiation](https://github.com/w3c/webtransport/blob/main/explainers/subprotocol_negotiation.md) for more detail and background.

```javascript
const wt = new WebTransport('https://example.com/wt', {
  protocols: ['v2.chat', 'v1.chat'], // Proposed to the server
  requireUnreliable: true            // Fail if only H2/TCP available
});
await wt.ready;
console.log(`The server selected ${wt.protocol || "no"} protocol`); 
console.log(wt.reliability); // supports-unreliable
```

### 2. Connection with Headers and Cert Hashes

```javascript
// Replace these two with real values from your server.
const token = "dev-token-123";
const certHash = new Uint8Array([
  0xed, 0xb0, 0x3e, 0x3a, 0x0a, 0x5f, 0xbb, 0x4c, 0x1c, 0x8e, 0x62, 0xc8, 0xa0, 0xcf, 0x9c, 0x54,
  0xc2, 0xe5, 0xa6, 0xd3, 0xb2, 0xb4, 0xa1, 0xc9, 0xd0, 0xe1, 0xf2, 0xa3, 0xb4, 0xc5, 0xd6, 0xe7,
]);

const wt = new WebTransport("https://127.0.0.1:4433/wt", {
  headers: { Authorization: `Bearer ${token}` },
  serverCertificateHashes: [{ algorithm: "sha-256", value: certHash }],
});
await wt.ready;
```


### 3. Unidirectional and Bidirectional Streams

```javascript
// Receive server-initiated unidirectional streams of data (may arrive out of order)
for await (const readable of wt.incomingUnidirectionalStreams) consumeConcurrently(readable);

async function consumeConcurrently(readable) {
  try {
    for await (const bytes of readable) processTheData(bytes);
  } catch (e) {
    console.error(e);
  }
}
```
```javascript
// Send a UTF-8 encoded stream
const { writable, readable } = new TextEncoderStream();
const writer = writable.getWriter();
writer.write("Hello server").catch(() => {});
writer.close();
await readable.pipeTo(await wt.createUnidirectionalStream());
```
```javascript
// Use bidirectional streams as a request/response pattern
const { writable, readable } = new TextEncoderStream();
const writer = writable.getWriter();
writer.write("Hello server").catch(() => {});
writer.close();
for await (const message of readable
    .pipeThrough(await wt.createBidirectionalStream())
    .pipeThrough(new TextDecoderStream())) {
  console.log(message); // "Hi client"
}
```

### 4. Sending and Receiving Datagrams

Ideal for high-frequency, time-sensitive data.

```javascript
// Receive server-initiated utf-8 encoded datagrams
const decoder = new TextDecoder();
for await (const datagram of wt.datagrams.readable) {
  console.log(decoder.decode(datagram));
}

// Send utf-8 encoded datagrams to the server
const writable = wt.datagrams.createWritable();
const writer = writable.getWriter();
const encoder = new TextEncoder();
for (const message of messages) {
  const datagram = encoder.encode(message);
  if (datagram.length > wt.datagrams.maxDatagramSize) throw;
  await writer.ready;
  writer.write(datagram).catch(() => {});
}
```

### 5. Sending Real-time Video one Frame per Stream with Send Order

As video frames tend to exceed the size of a datagram, a common way to send video is to use a stream per frame or segment. This ensures frames arrive whole without blocking on previous frames, allowing for frame loss. The streams can be assigned a send order to avoid them competing with one another.
```js
let frameCount = 0;
for await (const encodedVideoChunk of realtimeEncodedVideoChunks.readable) {
  const bytes = new Uint8Array(encodedVideoChunk.byteLength);
  encodedVideoChunk.copyTo(bytes);
  const writable = await wt.createUnidirectionalStream({ sendOrder: frameCount++ });
  const writer = writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close();
}
```

### 6. Managing Bandwidth with Send Groups

In complex apps, different groups of related data might compete for bandwidth. **Send Groups** allow developers to group related streams and prioritize them individually within that group.

```javascript
sendParticipant(encodedVideoChunksParticipantA, wt.createSendGroup());
sendParticipant(encodedVideoChunksParticipantB, wt.createSendGroup());

async function sendParticipant(realtimeEncodedVideoChunks, sendGroup) {
  let frameCount = 0;
  for await (const encodedVideoChunk of realtimeEncodedVideoChunks.readable) {
    const bytes = new Uint8Array(encodedVideoChunk.byteLength);
    encodedVideoChunk.copyTo(bytes);
    const writable = await wt.createUnidirectionalStream({ sendGroup, sendOrder: frameCount++ });
    const writer = writable.getWriter();
    writer.write(bytes).catch(() => {});
    writer.close();
  }
}
```

### 7. Transactional Writes and Reliable Reset

WebTransport also supports transactional writes and reliable reset via the `atomicWrite()` and `commit()` methods respectively. The former ensures that bytes only go out together, and the latter commits to sending what has been written up to this point even if the stream is later aborted.

```javascript
const writable = await wt.createUnidirectionalStream();
const writer = writable.getWriter();
try {
  await writer.atomicWrite(bytes);
} catch (e) {
  if (e.name != "AbortError") throw e;
  // Blocked on flow control; the writable remains un-errored.
}
```
```javascript
const writable = await wt.createUnidirectionalStream();
const writer = writable.getWriter();
writer.write(bytes).then(() => writer.commit()).catch(() => {});
```

### 8. Unreliable Datagrams with Aging

For data like "player position," old updates are useless. Developers can now set an "expiration" on datagrams so the browser drops them rather than sending stale data.

```javascript
const datagrams = wt.datagrams.createWritable();
datagrams.outgoingMaxAge = 500; // Drop if not sent within 500ms

const writer = datagrams.getWriter();
await writer.write(new TextEncoder().encode("pos: 10,20"));

```

### 9. Handling Session Draining

Servers might signal this during graceful reset.

```javascript
wt.draining.then(() => {
  console.log("Server is draining. Finalizing active streams...");
  // Stop opening new streams
});

```
---

## Detailed Design

### Transport Modes

The API exposes a `reliability` attribute. If it returns `"reliable-only"`, the transport has fallen back to HTTP/2. In this mode, `datagrams` and `createUnidirectionalStream` may be unavailable or behave as reliable streams.

### Stream Prioritization

The combination of `sendOrder` (a numeric priority) and `WebTransportSendGroup` (a logical bucket) allows for a hierarchical scheduling model. This is critical for preventing large file transfers from starving small, latency-sensitive control messages.

### Session Draining

Servers can signal a "Draining" state. This informs the client that the server is preparing to shut down. The client should stop opening new streams and finish existing work gracefully.

### Stats

WebTransport provides granular visibility via getStats(). This includes RTT metrics (smoothedRtt), estimated send rates, and detailed datagram health (dropped, expired, or lost).

---

## Security and Privacy Considerations

### Origin-based Security

Connections follow the same security rules as `fetch()`. The server must explicitly allow the connection from the client's origin during the handshake.

### Certificate Hashes

To support development on local networks where a public CA-signed certificate is impossible, WebTransport allows `serverCertificateHashes`. These are restricted to a maximum 2-week validity to prevent long-term tracking.

### Fingerprinting

The richness of the `getStats()` API (providing RTT, packet loss, and throughput) can potentially be used for fingerprinting. Browsers mitigate this by using network partition keys, ensuring a site cannot use WebTransport stats to track a user across different top-level domains.

Additional security questions are answered in the [security questionnaire](https://github.com/w3c/webtransport/blob/main/security-questionnaire.md).

## Alternatives Considered

### WebSockets over HTTP/3

While possible, WebSockets are architected for a single reliable stream. Adding unreliable features to WebSockets would require a complete redesign of the protocol's framing.

### WebRTC

WebRTC remains the standard for Peer-to-Peer. However, its overhead for client-server (ICE/STUN/SDP) makes it significantly more difficult to scale on the server-side compared to WebTransport's HTTP-based handshake.

