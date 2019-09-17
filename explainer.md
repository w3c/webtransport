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

1. A set of generic transport mixins that can be provided by any transport,
   but match closely with QUIC's capabilities.

2. A specific transport based on QUIC that implements all of the transport mixins.

3. A specific transport based on HTTP/3 that allows a subset of the transport
   mixins able to be pooled with HTTP traffic (sharing a congestion control context).

## Example of sending unreliable game state to server using QUIC datagrams

```javascript
const host = 'example.com';
const port = 10001;
const transport = new QuicTransport(host, port);
const datagramWriter = transport.sendDatagrams().getWriter();

setInterval(() => {
  // App-specific encoded game state
  const gameState = getGameState();
  const encodeGameState = encodeGameState(gameState);

  // If backpressure is being applied, it will get dropped
  // But that's OK for this scenario.
  datagramWriter.write(encodedGameState);
}, 100);
```

## Example of sending reliable game state to server using a QUIC unidirectional send stream

```javascript
const host = 'example.com';
const port = 10001;
const transport = new QuicTransport(host, port);

setInterval(async () => {
  // App-specific encoded game state
  const gameState = getGameState();
  const encodeGameState = encodeGameState(gameState);
  const stream = await transport.createSendStream();
  const writer = stream.writable.getWriter();
  writer.write(encodedGameState);
  writer.close();
}, 100);
```

## Example of receiving media pushed from server using unidirectional receive streams

```javascript
const host = 'example.com';
const port = 10001;
const transport = new QuicTransport(host, port);

const mime = 'video/webm; codecs="opus, vp09.00.10.08"';
const mediaSource = new MediaSource();
await new Promise(resolve => mediaSource.addEventListener('sourceopen', () => resolve(), {once: true}));
const sourceBuffer = mediaSource.addSourceBuffer(mime);

// App-specific request
const mediaRequest = Uint8Array.of(1, 2, 3, 4);
const requestStream = await transport.createSendStream();
const requestWriter = requestStream.writable.getWriter();
requestWriter.write(mediaRequest);
requestWriter.close();

// Receive the responses.
for await (const responseStream of transport.receiveStreams()) {
  const response = await responseStream.arrayBuffer();
  sourceBuffer.appendBuffer(response);
  await new Promise(resolve => sourceBuffer.addEventListener('update', () => resolve(), {once: true}));
}
```

## Example of receiving notifications pushed from the server, with responses

```javascript
const host = 'example.com';
const port = 10001;
const transport = new QuicTransport(host, port);

for await (const stream of transport.receiveBidirectionalStreams()) {
  (async () => {
    const notification = await stream.arrayBuffer();
    // App-specific notification encoding
    const notificationMessage = decodeNotification(notification);
    const notification = new Notification(notificationMessage);
    notification.addEventListener(() => {
      // App-specific click message encoding
      const clickMessage = encodeClickMessage();
      const writer = stream.writable.getWriter();
      writer.write(clickMessage);
      writer.close();
    }, {once: true});
  })();
}
```

## Example of requesting over pooled HTTP and receiving media pushed out-of-order and unreliably over the same network connection

```javascript
const mime = 'video/webm; codecs="opus, vp09.00.10.08"';
const mediaSource = new MediaSource();
await new Promise(resolve => mediaSource.addEventListener('sourceopen', () => resolve(), {once: true}));
const sourceBuffer = mediaSource.addSourceBuffer(mime);
const transport = new Http3Transport("/video");
if (!transport) {
  return;
}
await fetch('http://example.com/babyshark');
for await (const datagram of transport.receiveDatagrams()) {
  const chunk = containerizeMedia(datagram);
  sourceBuffer.appendBuffer(chunk);
  await new Promise(resolve => sourceBuffer.addEventListener('update', () => resolve(), {once: true}));
}
```

## Example of requesting over HTTP and receiving media pushed out-of-order and reliably over the same network connection

```javascript
const mime = 'video/webm; codecs="opus, vp09.00.10.08"';
const mediaSource = new MediaSource();
await new Promise(resolve => mediaSource.addEventListener('sourceopen', () => resolve(), {once: true}));
const sourceBuffer = mediaSource.addSourceBuffer(mime);
const transport = new Http3Transport("https://example.com/video");
for await (const stream of transport.receiveStreams()) {
  sourceBuffer.appendBuffer(await stream.arrayBuffer());
  await new Promise(resolve => sourceBuffer.addEventListener('update', () => resolve(), {once: true}));
}
```

## Detailed design discussion

Any WebTransport can provide any of the following capabilities (mixins):

- Unidirectional streams are indefintely long streams of bytes in one direction 
  with back pressure applied
  to the sender when either the receiver can't read quickly enough or when
  constrained by network capacity/congestions.  Useful for sending messages that
  do not expect a response.  In-order, reliable messaging can be achieved by
  sending many messages in a single stream. Out-of-order messaging can be achieved
  by sending one message per stream.

- Bidirectional streams are like unidirectional streams, but in two directions.  
  They are useful for sending messages that expect a response.

- Datagrams are small, out-of-order, unreliable messages.  They are useful for 
  sending messages with less API complexity
  and less network overhead than streams.

A QuicTransport is a WebTransport that maps directly to QUIC streams and
datagrams, which makes it easy to connect to servers that speak QUIC with
minimum overhead.  It supports all of these capabilities.

An Http3Transport is a WebTransport that provides QUIC streams and datagrams
with slightly more overhead vs. a QuicTransport.  It has the advantage that HTTP
and non-HTTP traffic can share the same network port and congestion control
context, and it may be pooled with other transports such that the transport may
be connected more quickly (by reusing an existing HTTP/3 connection).

## Alternative designs considered

### [WebRTC Data Channel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)
can be used, but require that the server endpoint implement several protocols
uncommonly found on servers (ICE, DTLS, and SCTP) and that the client
application use a complex API designed for a very different use case.

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
