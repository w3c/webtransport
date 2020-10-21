Ordinality of listing does not imply priority. 

1. **Machine learning**
    1. Speech translation/emotion analysis  - sending audio/video data from client to server for analysis and receiving translated data/text/audio in return.
    1. Security camera analysis - data and/or video sent to cloud service for analysis. Service may return data instructions.
1. **Multiplayer Gaming - web and consoles**
    1. Game play instructions sent from client to cloud based game engine. Some instructions are time sensitive (such as location data) , others are stateful (avatar selection). Dataflow is bi-directional. 
    1. Mixture of client-server and p2p data flows. 
    1. AR gaming requires real-world interaction, including virtual theatre - geo-separate actors with virtual backgrounds. 
1. **Low-latency live streaming**
    1. Unidirectional Broadcast - one to many - sports events, news, wagering, latency equivalent to social media delay and quality to support UHD, HDR, HFR, DRM. 
    1. Bi-directional few-to-few video chats via server, reduced connection time/complexity compared to WebRTC. Example - Apple Facetime
1. **Cloud Game Streaming**
    1. Server-side game rendering (such as Google Stadia) transmitted to thin client with low latency. 
    1. Bi-directional Game play instructions (both server and p2p).
1. **Server-based video conferencing**
    1. Simpler session establishment
    1. Censorship circumvention - preventing fingerprinting and identification during session establishment.
1. **Remote desktop**
    1. Transmission of screen capture/sharing and control instructions.
    1. Collaborative work on a shared screen.
    1. Including scaling to very large audiences.
    1. Online document sharing
    1. Remote assistance temporarily "taking over" control of a system
1. **Time Synchronized Multimedia Web communications**
    1. Combining geo-separate singing and/or instruments together online with precise time synchronization
1. **IOT sensor and analytics data transfer**
    1. Efficient and intermittent transmission of data. For example  - sending a 1 bit flag, GPS position updates, mouse clicks on site etc. 
    1. Sensor data upload  - including filters, aggregation, triggers.
1. **PubSub Models - avoid long-polling**
    1. Social feeds - Twitter etc, Financial tickers
    1. Messaging platforms, including Enterprise messaging infrastructure

