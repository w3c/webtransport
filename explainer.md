# WebTransport Explainer

## Problem and Motivation

Many applications, such as games and live streaming, need a mechanism to send
many messages as quickly as possibly, possibly out of order, and possibly
unreliably from client to server or server to client.  The web platform is
missing the capability to do this easily.

Native applications can use raw UDP sockets, but those are not available on the
web because they lack encryption, congestion control, and a mechanism for
consent to send (to prevent DDoS attacks).

Historically, web applications that needed bidirectional data stream between a
client and a server could rely on WebSockets [RFC6455], a message-based
protocol compatible with Web security model.  However, since the abstraction it
provides is a single, reliable, ordered stream of messages, it suffers from head-of-line
blocking (HOLB), meaning that all messages must be sent and received in order
even if they are independent and some of them are no longer needed.  This makes
it a poor fit for latency sensitive applications which rely on partial
reliability and stream independence for performance.

We think there is a room for a simple, client-server, unordered/unreliable API
with minimal latency.  The WebTransport protocol provides this with a single
transport object that abstracts away the specific underlying protocol with
a flexibile set of possible capabilities including reliable
unidirectional and bidirectional streams, and unreliable datagrams
(much like the capabilities of QUIC).

## Goals

- Provide a way to communicate with servers with low latency, including support
for unreliable and unordered communication.

- Provide an API that can be used for many use cases and network protocols,
including both reliable and unreliable, ordered and unordered, client-server and
p2p, data and media.

- Ensure the same security properties as WebSockets (use of TLS,
  server-controlled origin policy)

## Non-goals

This is not [UDP Socket API](https://www.w3.org/TR/raw-sockets/).  We must have
encrypted and congestion-controlled communication.

## Key use-cases

- Sending game state with minimal latency to server in many small, unreliable,
  out-of-order messages at a regular interval

- Receiving media pushed from server with minimal latency (out-of-order)

- Receiving messages pushed from server (such as notifications)

- Requesting over HTTP and receiving media pushed out-of-order and unreliably
  over the same network connection

## Proposed solutions

1. A generic transport interface that can be provided by any transport,
   but match closely with QUIC's capabilities.

2. The transport interface can talk
   [a QUIC based protocol](https://tools.ietf.org/html/draft-vvv-webtransport-quic).

3. The transport interface can talk
   [an HTTP/3 based protocol](https://tools.ietf.org/html/draft-vvv-webtransport-http3)
   that allows web developers to reuse HTTP/3 connections (sharing a congestion control context).

## Example of sending unreliable game state to server using datagrams

```javascript
// The app provides a way to get a serialized state to send to the server
function getSerializedGameState() { ... }

const wt = new WebTransport('https://example.com:10001/path');
const writer = wt.datagrams.writable.getWriter();
setInterval(() => {
  const message = getSerializedGameState();
  writer.write(message);
}, 100);
```

## Example of sending reliable game state to server using a unidirectional send stream

```javascript
// The app provides a way to get a serialized state to send to the server.
function getSerializedGameState() { ... }

const wt = new WebTransport('https://example.com:10001/path');
setInterval(async () => {
  const message = getSerializedGameState();
  const stream = await wt.createUnidirectionalStream();
  const writer = stream.getWriter();
  writer.write(message);
  writer.close();
}, 100);
```

## Example of receiving media pushed from server using unidirectional receive streams

```javascript
// The app provides a way to get a serialized media request to send to the server
function getSerializedMediaRequest() { ... }

const wt = new WebTransport('https://example.com:10001/path');

const mediaSource = new MediaSource();
await new Promise(resolve => mediaSource.addEventListener('sourceopen', resolve, {once: true}));
const sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="opus, vp09.00.10.08"');

// App-specific request
const mediaRequest = getSerializedMediaRequest();
const requestStream = await wt.createUnidirectionalStream();
const requestWriter = requestStream.getWriter();
requestWriter.write(mediaRequest);
requestWriter.close();

// Receive the responses.
for await (const receiveStream of wt.incomingUnidirectionalStreams) {
  for await (const buffer of receiveStream) {
    sourceBuffer.appendBuffer(buffer);
  }
  await new Promise(resolve => sourceBuffer.addEventListener('update', resolve, {once: true}));
}
```

## Example of receiving notifications pushed from the server, with responses

```javascript
// The app provides a way to deserialize a notification received from the server.
function deserializeNotification(serializedNotification) { ... }
// The app also provides a way to serialize a "clicked" message to send to the server.
function serializeClickedMessage(notification) { ... }

const wt = new WebTransport('https://example.com:10001/path');
for await (const {readable, writable} of wt.incomingBidirectionalStreams) {
  const buffers = []
  for await (const buffer of readable) {
    buffers.push(buffer)
  }
  const notification = new Notification(deserializeNotification(buffers));
  notification.addEventListener('onclick', () => {
    const clickMessage = encodeClickMessage(notification);
    const writer = writable.getWriter();
    writer.write(clickMessage);
    writer.close();
  });
}
```

## Example of requesting over pooled HTTP and receiving media pushed out-of-order and unreliably over the same network connection

```javascript
const mediaSource = new MediaSource();
await new Promise(resolve => mediaSource.addEventListener('sourceopen', resolve, {once: true}));
const sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="opus, vp09.00.10.08"');
const wt = new WebTransport('/video', {allowPooling: true});
await fetch('https://example.com/babyshark');
for await (const datagram of wt.datagrams.readable) {
  sourceBuffer.appendBuffer(datagram);
  await new Promise(resolve => sourceBuffer.addEventListener('update', resolve, {once: true}));
}
```

## Example of requesting over HTTP and receiving media pushed out-of-order and reliably over the same network connection

```javascript
const mediaSource = new MediaSource();
await new Promise(resolve => mediaSource.addEventListener('sourceopen', () => resolve(), {once: true}));
const sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="opus, vp09.00.10.08"');
const wt = new WebTransport('https://example.com/video');
for await (const receiveStream of transport.incomingUnidirectionalStreams) {
  for await (const buffer of receiveStream) {
    sourceBuffer.appendBuffer(buffer);
  }
  await new Promise(resolve => sourceBuffer.addEventListener('update', resolve, {once: true}));
}
```

## Detailed design discussion

WebTransport can support multiple protocols, each of which provide some of the
following capabilities.

- Unidirectional streams are indefinitely long streams of bytes in one direction
  with back pressure applied
  to the sender when either the receiver can't read quickly enough or when
  constrained by network capacity/congestions.  Useful for sending messages that
  do not expect a response.  In-order, reliable messaging can be achieved by
  sending many messages in a single stream. Out-of-order messaging can be achieved
  by sending one message per stream.

- Bidirectional streams are full-duplex streams. A bidirectional stream is effectively
  a pair of unidirectional streams.

- Datagrams are small, out-of-order, unreliable messages.  They are useful for
  sending messages with less API complexity
  and less network overhead than streams.

[WebTransport over
HTTP/3](https://datatracker.ietf.org/doc/html/draft-ietf-webtrans-http3)
is a WebTransport protocol built on top of HTTP/3. It is the only protocol supported
by WebTransport as of now. More protocols such as WebTransport over HTTP/2 may be
supported in the future.

## Alternative designs considered

### [WebRTC Data Channel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)
While WebRTC data channel has been used for client/server communications (e.g.
for cloud gaming applications), this requires that the server endpoint implement
several protocols uncommonly found on servers (ICE, DTLS, and SCTP) and that the
application use a complex API (RTCPeerConnection) designed for a very different use case.

### Layering WebSockets over HTTP/3
[I-D.ietf-quic-http] in a manner similar to how they are currently layered over
HTTP/2 [RFC8441].  That would avoid head-of-line blocking and provide an
ability to cancel a stream by closing the corresponding WebSocket object.
However, this approach has a number of drawbacks, which all stem primarily from
the fact that semantically each WebSocket is a completely independent entity:

1. Each new stream would require a WebSocket handshake to agree on application
  protocol used, meaning that it would take at least one RTT for each new
  stream before the client can write to it.
1. Only clients can initiate streams.  Server-initiated streams and other
  alternative modes of communication (such as QUIC DATAGRAM frame) are not
  available.
1. While the streams would normally be pooled by the user agent, this is not
  guaranteed, and the general process of mapping a WebSocket to the end is
  opaque to the client.  This introduces unpredictable performance properties
  into the system, and prevents optimizations which rely on the streams being on
  the same connection (for instance, it might be possible for the client to
  request different retransmission priorities for different streams, but that
  would be impossible unless they are all on the same connection).
