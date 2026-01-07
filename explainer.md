# WebTransport Explainer

## Abstract

WebTransport is a web API that provides low-latency, bidirectional, client-server communication. It is designed for applications that require the performance of QUIC (the transport layer of HTTP/3)—such as high-frequency state synchronization and media streaming—while maintaining a secure, origin-based web model. It supports both reliable streams and unreliable datagrams.

## Problem and Background

Currently, web developers needing low-latency communication face a trade-off:

* **WebSockets** are easy to use but run over TCP, meaning a single lost packet delays all subsequent data (head-of-line blocking).
* **WebRTC Data Channels** support unreliable UDP-like transport but are architected for Peer-to-Peer (P2P). Using them for client-server communication requires a complex "fake peer" setup involving ICE, STUN, and TURN.
* **HTTP/2 and HTTP/3 (Fetch)** are request-response oriented and do not easily support long-lived, bidirectional, "push-style" data flow with custom reliability.

WebTransport fills this gap by providing a QUIC-native, client-server API that handles multiplexing without head-of-line blocking.

## Goals

* **Low Latency**: Support for unreliable datagrams and independent streams to avoid head-of-line blocking.
* **Flexibility**: Allow developers to mix reliable and unreliable data on a single connection.
* **Efficiency**: Enable complex prioritization (Send Groups) to manage bandwidth between different types of application data.
* **Compatibility**: Provide a reliable fallback to HTTP/2 when HTTP/3 (UDP) is blocked by network middleboxes.
* **Security**: Enforce origin-based security and TLS encryption.

## Non-Goals

* **Peer-to-Peer**: WebTransport is strictly client-server. P2P use cases should continue to use WebRTC.
* **Universal UDP**: This is not "raw UDP." All traffic is congestion-controlled and encrypted.

## Use Cases

1. **Cloud Gaming & Remote Desktop**: Sending user input (reliable) while receiving high-frequency video frames and input state (unreliable).
2. **Live Streaming**: Pushing media chunks to a server with low overhead.
3. **Collaborative Editing**: Sending cursor positions (unreliable) while ensuring document changes (reliable) are persisted.
4. **Internet of Things (IoT)**: Efficiently multiplexing sensor data from thousands of devices.

Additional use-cases are described in the [original use-cases](https://github.com/w3c/webtransport/blob/main/use-cases.md) document. 

---

## Proposed Solution: Key Scenarios

### 1. Connection, Reliability, and Subprotocol Negotiation

Applications can now propose a list of subprotocols (similar to WebSockets) and specify if they require the performance of an unreliable (UDP/QUIC) transport or if a reliable-only (TCP/H2) fallback is acceptable. See the additional [explainer on Subprotocol negotiation](https://github.com/w3c/webtransport/blob/main/explainers/subprotocol_negotiation.md) for more detail and background.

```javascript
const transport = new WebTransport('https://example.com/wt', {
  // Propose subprotocols to the server
  protocols: ['v2.chat', 'v1.chat'], 
  
  // Fail the connection if UDP/H3 is not available
  requireUnreliable: true 
});

const { protocol, responseHeaders } = await transport.ready;

// The server-selected subprotocol
console.log(`Negotiated protocol: ${transport.protocol}`); 

// The transport mode used ("supports-unreliable" or "reliable-only")
console.log(`Reliability mode: ${transport.reliability}`);
```

### 2. Managing Bandwidth with Send Groups

In complex apps, different data types compete for bandwidth. **Send Groups** allow developers to group related streams and prioritize them collectively.

```javascript
const audioGroup = transport.createSendGroup();
const videoGroup = transport.createSendGroup();

// Create a high-priority audio stream
const audioStream = await transport.createUnidirectionalStream({
  sendGroup: audioGroup,
  sendOrder: 10 // Highest priority within its group
});

// The browser scheduler will now balance bandwidth between the audioGroup and videoGroup

```

### 3. Reliable Writes and Commits

WebTransport now supports "Atomic Writes" and "Reliable Reset" via the `commit()` method. This ensures that even if a stream is later aborted, the bytes marked as "committed" are guaranteed to be delivered.

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

### 4. Unreliable Datagrams with Aging

For data like "player position," old updates are useless. Developers can now set an "expiration" on datagrams so the browser drops them rather than sending stale data.

```javascript
const datagrams = transport.datagrams.createWritable();
datagrams.outgoingMaxAge = 500; // Drop if not sent within 500ms

const writer = datagrams.getWriter();
await writer.write(new TextEncoder().encode("pos: 10,20"));

```

---

## Detailed Design

### Transport Modes

The API exposes a `reliability` attribute. If it returns `"reliable-only"`, the transport has fallen back to HTTP/2. In this mode, `datagrams` and `createUnidirectionalStream` may be unavailable or behave as reliable streams.

### Stream Prioritization

The combination of `sendOrder` (a numeric priority) and `WebTransportSendGroup` (a logical bucket) allows for a hierarchical scheduling model. This is critical for preventing large file transfers from starving small, latency-sensitive control messages.

### Session Draining

Servers can signal a "Draining" state. This informs the client that the server is preparing to shut down. The client should stop opening new streams and finish existing work gracefully.

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

