# server/ — headless server entry point (Core)

Starts the WebSocket listener, owns the rooms, runs each room's simulation at 20 ticks per second, and broadcasts snapshots.

Included only in the Linux server export. Reads its port and build number from environment variables so the same container runs on any host.
