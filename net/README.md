# net/ — networking layer (Core)

`NetProtocol` (message encoding and the WebSocket transport) and the server-side room manager (4-letter codes, two slots, lobby lifecycle).

Game code talks to `NetProtocol`, never to the transport directly, so the transport can be swapped later without touching gameplay. Message types are listed in the GDD's "Network protocol" section.
