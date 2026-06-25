# Local Portless + Caddy Domains

This repo can run through Docker Compose behind Portless and Caddy, matching the
portless local-domain setup used by `vertical-core-2` while serving Contextbase
services.

## Domains

Slot 2 is the default local slot:

```txt
https://contextbase-2.test          -> TanStack Start web app
https://api.contextbase-2.test      -> API service
https://uploads.contextbase-2.test  -> browser file/media reads
https://zero.contextbase-2.test     -> Zero cache service
https://console.contextbase-2.test  -> reserved local console host
```

Slot 1 is available with the `:1` scripts and uses the same host pattern with
`contextbase-1.test`.

Portless runs on host HTTPS port `443` by default. Start it from an interactive
terminal so you can approve the sudo prompt. If you need the non-privileged
fallback, run with `PORTLESS_PORT=1355` and open the local URLs with `:1355`.

The `.test` domains are registered through Portless aliases, so they do not
require `/etc/hosts` edits.

## Start

```sh
npm install -g portless
pnpm local:domains:portless:up
pnpm local:domains:docker:2
open https://contextbase-2.test
```

No-sudo fallback:

```sh
pnpm local:domains:portless:up:unprivileged
pnpm local:domains:docker:2
open https://contextbase-2.test:1355
```

The Docker script runs under Compose project `contextbase-2`. Service ports are
bound to localhost for debugging, but Caddy is the intended browser entrypoint:

```txt
web        -> 4017
api        -> 3017
auth       -> 3317
mcp        -> 3217
zero-cache -> 4817
caddy      -> 8217
postgres   -> 5417
```

## Verify

```sh
curl https://contextbase-2.test
curl https://api.contextbase-2.test/health
curl https://uploads.contextbase-2.test/health
curl https://zero.contextbase-2.test
```

When using the no-sudo `1355` fallback:

```sh
curl -k https://contextbase-2.test:1355
curl -k https://api.contextbase-2.test:1355/health
```

Direct Caddy verification without Portless:

```sh
curl -H 'X-Forwarded-Host: contextbase-2.test' http://127.0.0.1:8217/
curl -H 'X-Forwarded-Host: api.contextbase-2.test' http://127.0.0.1:8217/health
```

## Stop

```sh
pnpm local:domains:docker:down:2
pnpm local:domains:portless:down
```
