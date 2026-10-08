# Deploying Plonko

The game has two parts:

- **The relay**: a small Node WebSocket server. It is only needed for online play. It runs on the Oracle Cloud VM.
- **The client**: static files. It goes to Cloudflare Pages (your own link) and to itch.io (the storefront). Both use the same build.

Do the relay first, because both client builds need its address. If you want to ship solo play and the campaign before online is ready, skip to Part 2 or 3 and leave `VITE_WS_URL` unset: the "Play with a friend" card is then shown as unavailable.

Everything here is free.

## Part 1: The relay on the Oracle VM

You need a hostname that points at the VM, for example `plonko-relay.yourdomain.com`. A browser on an HTTPS page will only connect to `wss://`, and a certificate cannot be issued for a bare IP address.

No domain? Create a free subdomain at duckdns.org, point it at the VM's public IP, and use that name wherever this guide says `plonko-relay.yourdomain.com`.

### 1.1 Point the hostname at the VM

In your DNS provider, add an **A record**: name `plonko-relay`, value the VM's public IP. If the DNS is on Cloudflare, set the record to **DNS only** (grey cloud) so the certificate step below works.

### 1.2 Install Node and the code

```bash
ssh ubuntu@YOUR_VM_IP

node -v        # needs v20 or newer; if it is missing or older:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

git clone https://github.com/sam666-deb/Plonko.git
cd Plonko
npm ci
```

Check that it starts, then stop it with Ctrl+C:

```bash
npm run start
# Plonko relay listening on ws://localhost:8787
```

### 1.3 Run it as a service

Open `deploy/plonko-relay.service` and make three lines match your VM:

- `User=` your login (`whoami`)
- `WorkingDirectory=` the folder you cloned into (`pwd`)
- `ExecStart=` the path printed by `which npm`, followed by ` run start`

Then install it:

```bash
sudo cp deploy/plonko-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now plonko-relay
systemctl status plonko-relay      # should say "active (running)"
```

Logs: `journalctl -u plonko-relay -f`

### 1.4 Put HTTPS in front of it

First find out whether something is already listening on ports 80 and 443, which is likely if Pulsly's signalling server is served over HTTPS from this VM:

```bash
sudo ss -ltnp | grep -E ':80 |:443 '
```

**If nothing is listening, use Caddy.** It fetches and renews the certificate by itself.

```bash
sudo apt-get install -y caddy      # if this fails, see caddyserver.com/docs/install
sudo nano /etc/caddy/Caddyfile
```

Replace the file's contents with this, using your hostname:

```
plonko-relay.yourdomain.com {
	reverse_proxy localhost:8787
}
```

```bash
sudo systemctl reload caddy
```

**If nginx is already there,** add a server block for the new hostname next to the existing one, then issue a certificate the same way you did for Pulsly (for example `sudo certbot --nginx -d plonko-relay.yourdomain.com`):

```nginx
server {
    server_name plonko-relay.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
```

**If Caddy is already there,** add the three-line block above to its existing Caddyfile and reload.

### 1.5 Open the firewall

Two firewalls sit in front of an Oracle VM, and both must allow ports 80 and 443. If Pulsly already works over HTTPS from this VM, both are already open and you can skip this.

1. **Oracle console**: Networking → Virtual Cloud Networks → your VCN → Security Lists → add ingress rules for TCP ports 80 and 443 from `0.0.0.0/0`.
2. **On the VM** (Oracle's Ubuntu images block everything but SSH by default):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 1.6 Check it

From your own computer:

```bash
curl -i https://plonko-relay.yourdomain.com
```

`HTTP/1.1 426 Upgrade Required` is the right answer: it means HTTPS works and the relay is behind it. The relay's address for the next two parts is:

```
wss://plonko-relay.yourdomain.com
```

## Part 2: The client on Cloudflare Pages

Cloudflare builds from GitHub, so push your latest commits first.

1. Sign in at dash.cloudflare.com and open **Workers & Pages**.
2. Choose **Create**, then **Pages**, then **Connect to Git**, and pick the `Plonko` repository. (Cloudflare renames these buttons from time to time; you want a Pages project connected to a Git repository.)
3. Set the build:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `client/dist` |
| Root directory | leave empty |

4. Under **Environment variables**, add:

| Name | Value |
|---|---|
| `VITE_WS_URL` | `wss://plonko-relay.yourdomain.com` |
| `NODE_VERSION` | `22` |

5. **Save and Deploy.** After a minute or two you get an address like `plonko.pages.dev`.

From now on every push to `main` redeploys it. To use your own domain, open the project's **Custom domains** tab.

`VITE_WS_URL` is read when the site is built, not when it runs. If you change it, start a new deployment for it to take effect.

## Part 3: The client on itch.io

### 3.1 Build the zip

On your own computer, tell the build where the relay is. Create the file `client/.env.production.local` (it is ignored by git) containing:

```
VITE_WS_URL=wss://plonko-relay.yourdomain.com
```

Then, from the repository root:

```bash
npm run itch
```

This writes `plonko-itch.zip` (about 3 MB) in the repository root.

### 3.2 Create the page

1. Sign in at itch.io, open the menu at the top right, and choose **Upload new project**.
2. Fill in:

| Field | Value |
|---|---|
| Title | Plonko |
| Kind of project | **HTML** |
| Pricing | No payments |

3. Under **Uploads**, upload `plonko-itch.zip` and tick **This file will be played in the browser**.
4. Under **Embed options**:

| Option | Value |
|---|---|
| Viewport dimensions | 1280 × 720 |
| Fullscreen button | ticked |
| Mobile friendly | ticked, orientation Landscape |

5. Add a description, cover image and screenshots. Set genre to Action and add tags such as `multiplayer` and `physics`.
6. Leave **Visibility** on Draft and **Save**. Use **View page** to play it, test online with a friend, then change Visibility to **Public**.

### 3.3 How it differs on itch.io

The game runs inside a frame there, so a link to it cannot carry a room. Players share the **room code** shown on the waiting screen, and the friend types it into **Have a room code?** on the landing page. Players on itch.io and on the Cloudflare site use the same relay and can play each other.

### 3.4 Updating

Run `npm run itch` again, open **Edit game**, upload the new zip, tick the browser-play box on it, and delete the old upload.

## Updating the relay

After pushing changes that touch `server/` or `shared/`:

```bash
ssh ubuntu@YOUR_VM_IP
cd Plonko && git pull && npm ci && sudo systemctl restart plonko-relay
```

Update the relay and both clients together when the messages between them change. An old client talking to a new relay, or the reverse, can misbehave; players only need to reload the page.

## If something is wrong

| Symptom | Likely cause |
|---|---|
| "Play with a friend" is greyed out | The build had no `VITE_WS_URL`. Set it and rebuild. |
| Waiting screen stays on "Connecting to the server…" | The relay is unreachable. Run the `curl` check from 1.6; check `systemctl status plonko-relay`. |
| `curl` times out | A firewall is closed. Recheck both in 1.5. |
| `curl` reports a certificate error | DNS has not reached the VM yet, or port 80 was closed when the certificate was requested. Fix it, then reload Caddy. |
| `curl` returns 502 | The proxy works but the relay is not running on port 8787. |
| The browser console says "Mixed Content" | `VITE_WS_URL` starts with `ws://`. It must be `wss://`. |
| Cloudflare's build fails on install | `NODE_VERSION` is missing or too old. |
| The itch.io page is blank | The zip must have `index.html` at its top level. Use `npm run itch`; do not zip the `dist` folder itself. |
