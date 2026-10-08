# Deploying Plonko

The game has two parts:

- **The relay**: a small Node WebSocket server. It is only needed for online play. It runs on the Oracle Cloud VM.
- **The client**: static files. It goes to Cloudflare Pages (your own link) and to itch.io (the storefront). Both use the same build.

Do the relay first, because both client builds need its address, which goes in `client/.env.production`. If you want to ship solo play and the campaign before online is ready, empty that file: the "Play with a friend" card is then shown as unavailable.

Everything here is free.

## Part 1: The relay on the Oracle VM

You need a hostname that points at the VM, for example `plonko-relay.yourdomain.com`. A browser on an HTTPS page will only connect to `wss://`, and a certificate cannot be issued for a bare IP address.

No domain? Create a free subdomain at duckdns.org, point it at the VM's public IP, and use that name wherever this guide says `plonko-relay.yourdomain.com`.

### 1.1 Point the hostname at the VM

In your DNS provider, add an **A record**: name `plonko-relay`, value the VM's public IP. If the DNS is on Cloudflare, set the record to **DNS only** (grey cloud) so the certificate step below works.

### 1.2 Install Node and the code

Log in and install Node. Ubuntu 24.04 and later carry a new enough version in their own packages:

```bash
ssh ubuntu@YOUR_VM_IP
sudo apt-get update && sudo apt-get install -y nodejs npm
node -v        # needs v20 or newer
```

On a 1 GB server, add swap first so the install cannot run it out of memory:

```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

The repository is private, so the server does not clone it. From your own computer, in the repository, this copies just the relay's files and installs its dependencies:

```bash
deploy/push-relay.sh ubuntu@YOUR_VM_IP
```

It takes an SSH host name, and defaults to `plonko-vm` if you have that set up in `~/.ssh/config`.

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

## Part 2: The client on Cloudflare

Cloudflare builds from GitHub, so push your latest commits first. Two files in the repository do the configuring, so the dashboard needs very little:

- `wrangler.jsonc` tells Cloudflare to publish the built client, `client/dist`, as a static site.
- `client/.env.production` holds the relay's address, which is baked into the build.

1. Sign in at dash.cloudflare.com and open **Workers & Pages**.
2. Choose **Create**, then import the `Plonko` repository from GitHub, allowing Cloudflare access to it.
3. Set the build:

| Setting | Value |
|---|---|
| Project name | `plonko` (it must match `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | leave empty |

4. Deploy. After a minute or two you get an address like `plonko.YOUR-ACCOUNT.workers.dev`.

From now on every push to `main` redeploys it. To use your own domain, open the project's **Settings → Domains & Routes**.

The relay's address is read when the site is built, not when it runs. To point the site at a different relay, change `client/.env.production` and push.

## Part 3: The client on itch.io

### 3.1 Build the zip

On your own computer, from the repository root:

```bash
npm run itch
```

This writes `plonko-itch.zip` (about 3 MB) in the repository root. It connects to the relay named in `client/.env.production`, the same one the Cloudflare site uses.

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

After changes that touch `server/` or `shared/`, from your own computer:

```bash
deploy/push-relay.sh
```

It copies the new code, reinstalls dependencies and restarts the service.

Update the relay and both clients together when the messages between them change. An old client talking to a new relay, or the reverse, can misbehave; players only need to reload the page.

## If something is wrong

| Symptom | Likely cause |
|---|---|
| "Play with a friend" is greyed out | The build had no relay address. Check `client/.env.production` and rebuild. |
| Waiting screen stays on "Connecting to the server…" | The relay is unreachable. Run the `curl` check from 1.6; check `systemctl status plonko-relay`. |
| `curl` times out | A firewall is closed. Recheck both in 1.5. |
| `curl` reports a certificate error | DNS has not reached the VM yet, or port 80 was closed when the certificate was requested. Fix it, then reload Caddy. |
| `curl` returns 502 | The proxy works but the relay is not running on port 8787. |
| The browser console says "Mixed Content" | `VITE_WS_URL` starts with `ws://`. It must be `wss://`. |
| Cloudflare's deploy step says it ran "in the root of a workspace" | `wrangler.jsonc` is missing from the repository root. |
| The itch.io page is blank | The zip must have `index.html` at its top level. Use `npm run itch`; do not zip the `dist` folder itself. |
