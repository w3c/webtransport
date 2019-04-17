var respecConfig = {
  specStatus: "base",
  // if there a publicly available Editor's Draft, this is the link
  edDraftURI: "https://pthatcherg.github.io/web-transport/",
  shortName: "web-transport",     
  editors: [
    { name: "Peter Thatcher", company: "Google", w3cid: "68236" },
    { name: "Bernard Aboba", company: "Microsoft Corporation", w3cid: "65611" },
    { name: "Robin Raymond", company: "Optical Tone Ltd." }
  ],
  authors: [
  ],
  // TODO: Add links to WICG later?
  // wg: "Object-RTC API Community Group",
  // wgURI: "https://www.w3.org/community/ortc/",
  // wgPublicList: "public-ortc",
  // issueBase: "https://github.com/w3c/webrtc-quic/issues",
  otherLinks: [
  {
      data: [
      key: "Participate",
  // TODO: Add links to WICG later?
  //       {
  //         value: "Mailing list",
  //         href: "https://lists.w3.org/Archives/Public/public-webrtc/"
  //       },
  //       {
  //         value: "Browse open issues",
  //         href: "https://github.com/w3c/webrtc-quic/issues"
  //       },
        {
          value: "IETF QUIC Working Group",
          href: "https://tools.ietf.org/wg/quic/"
        }
      ]
    }
  ],
  wgPatentURI:  "https://www.w3.org/2004/01/pp-impl/47318/status",
  localBiblio: {
    "QUIC-DATAGRAM": {
      "title": "An Unreliable Datagram Extension to QUIC",
      "href": "https://tools.ietf.org/html/draft-pauly-quic-datagram",
      "authors": [
        "T. Pauly",
        "E. Kinnear",
        "D. Schinazi"
      ],
      "status": "10 September 2018. Internet draft (work in progress)",
      "publisher": "IETF"
    },
    "QUIC-TRANSPORT": {
      "title": "QUIC: A UDP-Based Multiplexed and Secure Transport",
      "href": "https://tools.ietf.org/html/draft-ietf-quic-transport",
      "authors": [
        "J. Iyengar",
        "M. Thomson"
      ],
      "status": "23 October 2018. Internet draft (work in progress)",
      "publisher": "IETF"
    },
    "TLS13": {
      "title": "The Transport Layer Security (TLS) Protocol Version 1.3",
      "href": "https://tools.ietf.org/html/draft-ietf-tls-tls13",
      "authors": [
        "E. Rescorla"
      ],
      "status": "20 March 2018. Internet Draft (work in progress)",
      "publisher": "IETF"
    },
    "ALPN": {
      "title": "Transport Layer Security (TLS) Application-Layer Protocol Negotiation Extension",
      "href": "https://tools.ietf.org/html/rfc7301",
      "authors": [
        "S. Friedl",
        "A. Popov",
        "A. Langley",
        "E. Stephan"
      ],
      "status": "Internet Standards Track document",
      "publisher": "IETF"
    }
  }
}
