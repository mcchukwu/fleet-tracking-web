const API_PREFIX = "/api/";

function isWebSocket(request) {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

async function proxyApi(request, env) {
  const api = new URL(env.API_ORIGIN);
  const target = new URL(request.url);
  target.protocol = api.protocol;
  target.host = api.host;

  const headers = new Headers(request.headers);
  if (isWebSocket(request) && env.WS_ORIGIN_REWRITE === "true") {
    headers.set("Origin", api.origin);
  }

  if (isWebSocket(request)) {
    return proxyWebSocket(target, headers);
  }

  return fetch(
    new Request(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual",
    }),
  );
}

async function proxyWebSocket(target, headers) {
  const upstreamHeaders = new Headers(headers);
  upstreamHeaders.set("Upgrade", "websocket");

  const upstreamResponse = await fetch(target, { headers: upstreamHeaders });
  const upstream = upstreamResponse.webSocket;
  if (!upstream) {
    return new Response("Upstream refused the WebSocket upgrade", {
      status: 502,
    });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.binaryType = "arraybuffer";
  server.accept();
  upstream.accept();

  server.addEventListener("message", (event) => upstream.send(event.data));
  upstream.addEventListener("message", (event) => server.send(event.data));
  server.addEventListener("close", (event) =>
    closeQuietly(upstream, event.code, event.reason),
  );
  upstream.addEventListener("close", (event) =>
    closeQuietly(server, event.code, event.reason),
  );
  server.addEventListener("error", () =>
    closeQuietly(upstream, 1011, "Proxy error"),
  );
  upstream.addEventListener("error", () =>
    closeQuietly(server, 1011, "Upstream error"),
  );

  return new Response(null, { status: 101, webSocket: client });
}

function closeQuietly(socket, code, reason) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.close(code, reason);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(API_PREFIX)) {
      return proxyApi(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
