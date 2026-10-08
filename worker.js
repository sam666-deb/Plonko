// The Cloudflare Worker in front of the site. It serves the built game, and passes WebSocket
// connections on /ws through to the relay server.
//
// The game could connect to the relay directly, but its address is on a dynamic-DNS domain that
// ad blockers (Brave's built-in one among them) refuse. Reaching it through the site's own
// address avoids that.
const RELAY = 'https://plonko.duckdns.org/'

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
      return fetch(new Request(RELAY, request))
    }
    return env.ASSETS.fetch(request)
  },
}
