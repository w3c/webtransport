# WebTransport Application Protocol Negotiation

## Motivating Example
ExampleChat is an open source library that lets Web developers embed an
interactive chat into their Web applications.  It uses WebTransport to support
multiple chat channels, one WebTransport stream per channel.  The library
provides both a chat client (ExampleChat.js) and a chat server
(example_chat.py).

In the original version of the protocol, the data on WebTransport streams is
encoded using JSON.  After substantial deployment experience, the developers
have discovered that the format would benefit dramatically from data
compression.  The problem is, they do not have a good way to retrofit it:

* The client and the server are not guaranteed to be updated simultaneously, so
  the change has to be backward-compatible.
* The developers could attempt to encode the information about compression
  support into the URL; however, the URL is provided by the library user, and
  there is no guarantee that any modification of the URL would not break the
  server, especially if the WebTransport connection is routed via a load
  balancer, or some other form of HTTP middleware.

WebTransport Application Protocol Negotiation provides an escape hatch for
situations like that.  In the WebTransport constructor, the ExampleChat.js
library can specify that it supports two different versions of the protocol:

```js
let transport = new WebTransport("https://www.example.com/chat",
                      {"protocols": ["examplechat-compressed", "examplechat"]});
```

This would result in the user agent sending `WT-Available-Protocols:
"examplechat-compressed", "examplechat"`.  If the server is running a newer
version of example_chat.py, it will reply with `WT-Protocol:
"examplechat-compressed"` and use the compressed message format; the client
would retrieve `"examplechat-compressed"` from `transport.protocol`.  A server
running the old version will ignore that header, and the client would retrieve
`null` from `transport.protocol`.

## Prior Art

* **WebSockets** provides a similar mechanism through the [`protocols`
  parameter](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket#protocols)
  of the WebSocket constructor.
* Applications built directly on top of **TLS** can use the [TLS
  ALPN extension](https://datatracker.ietf.org/doc/html/rfc7301).

The mechanism provided in WebTransport matches the TLS ALPN semantics (the
client offers a list of protocols, the server picks one of them).  This is done
intentionally to simplify development of protocols that can run both over
WebTransport, and over a raw QUIC connection directly, such as
[MOQT](https://datatracker.ietf.org/doc/draft-ietf-moq-transport/).

## Alternatives Considered

* **Allowing Web developers to set arbitrary HTTP headers**.  This has been
  proposed a few years ago, and the proposal has not since moved forward.
  Setting arbitrary headers has greater security implications due to potential
  concerns around things like CORS, and thus it is uncertain if and when that
  would happen.
