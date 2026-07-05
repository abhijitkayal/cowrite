import http from "node:http";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";

const port = Number(process.env.YJS_WS_PORT ?? 1234);

const server = http.createServer((_request, response) => {
  response.writeHead(200);
  response.end("Yjs websocket server");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (conn, request) => {
  setupWSConnection(conn, request, {
    gc: true
  });
});

server.listen(port, () => {
  console.log(`Yjs websocket server listening on ws://localhost:${port}`);
});
