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
const certHashHex = "edb03e3a0a5fbb4c1c8e62c8a0cf9c54c2e5a6d3b2b4a1c9d0e1f2a3b4c5d6e7";

const wt = new WebTransport("https://127.0.0.1:4433/wt", {
  headers: { Authorization: `Bearer ${token}` },
  serverCertificateHashes: [{ algorithm: "sha-256", value: hexToU8(certHashHex) }],
});
await wt.ready;

function hexToU8(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
```


### 3. Unidirectional and Bidirectional Streams

```javascript
// Receiving server-initiated unidirectional streams of data
for await (const readable of wt.incomingUnidirectionalStreams) {
  // consume streams independently using IFFEs, reporting per-stream errors
  ((async () => {
    try {
      for await (const bytes of readable) processTheData(bytes);
    } catch (e) {
      console.error(e);
    }
  })());
}

// Sending a UTF-8 encoded stream
const encoder = new TextEncoderStream("utf-8");
const writer = encoder.writable.getWriter();
writer.write("Hello Server").catch(() => {});
writer.close();
await encoder.readable.pipeTo(await wt.createUnidirectionalStream());

// Using non-blocking bidirectional streams as a request/response pattern
const encoder = new TextEncoderStream("utf-8");
const writer = encoder.writable.getWriter();
writer.write("Hello Server").catch(() => {});
writer.close();
await encoder.readable
  .pipeThrough(await wt.createBidirectionalStream())
  .pipeThrough(new TextDecoderStream("utf-8"))
  .pipeTo(new WritableStream({write: msg => console.log(msg)}); // "Hi client"
```

### 4. Sending and Receiving Datagrams

Ideal for high-frequency, time-sensitive data.

```javascript
// Decoding server-initiated datagrams into text
const decoder = new TextDecoder();
for await (const datagram of wt.datagrams.readable) {
  console.log(decoder.decode(datagram));
}

// Sending datagrams to the server
const writable = wt.datagrams.createWritable();
const writer = writable.getWriter();
for (const message of messages) {
  await writer.ready;
  writer.write(encoder.encode(message)).catch(() => {});
}

```

### 5. Managing Bandwidth with Send Groups

In complex apps, different groups of related data might compete for bandwidth. **Send Groups** allow developers to group related streams and prioritize them individually within that group.

```javascript
const audioGroup = wt.createSendGroup();
const videoGroup = wt.createSendGroup();

// Create a high-priority audio stream
const audioStream = await wt.createUnidirectionalStream({
  sendGroup: audioGroup,
  sendOrder: 10 // Highest priority within its group
});

// The browser scheduler will now balance bandwidth between the audioGroup and videoGroup

```

### 6. Reliable Writes and Commits

WebTransport also supports transactional writes and reliable reset via the 'atomicWrite()' and `commit()` methods respectively. The former ensures that bytes only go out together, and the latter commits to sending what has been written up to this point even if the stream is later aborted.

```javascript
const writer = stream.getWriter();

try {
  // atomicWrite ensures the chunk fits in the current flow-control window
  await writer.atomicWrite(importantMetadata);
  writer.commit(); // Ensure this metadata arrives even if we reset the stream later
} catch (e) {
  if (e.name === 'AbortError') console.warn("Network buffer full");
}

```

### 7. Unreliable Datagrams with Aging

For data like "player position," old updates are useless. Developers can now set an "expiration" on datagrams so the browser drops them rather than sending stale data.

```javascript
const datagrams = wt.datagrams.createWritable();
datagrams.outgoingMaxAge = 500; // Drop if not sent within 500ms

const writer = datagrams.getWriter();
await writer.write(new TextEncoder().encode("pos: 10,20"));

```

### 8. Handling Session Draining

Servers signal this during graceful restarts.

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

