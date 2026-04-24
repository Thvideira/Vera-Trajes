# Loja Vera — produção (Docker / Swarm)

## 1) Ver a UI e a API a partir de um teu portátil

- Defina a URL pública (por defeito a app em [vera-store.cetara.dev.br](https://vera-store.cetara.dev.br/)) e execute na raiz do repositório:

  ```bash
  chmod +x scripts/check-prod-deploy.sh
  PROD_URL="https://vera-store.cetara.dev.br" ./scripts/check-prod-deploy.sh
  ```

- No servidor, confirme que a stack e as réplicas estão activas, por exemplo (ajuste o nome do stack, ex. `vera-trajes`):

  ```bash
  docker service ls
  docker service ps vera-trajes_web --no-trunc
  docker service ps vera-trajes_api --no-trunc
  docker service logs vera-trajes_api --tail 100
  ```

- O ficheiro [docker-stack.yml](docker-stack.yml) mapeia o Nginx (frontend) na **porta 80** do nó. O tráfego HTTPS do domínio tem de ser encaminhado (reverse proxy) para o host:porta correctos. Se a página dá 502, verifique proxy, firewall e o serviço `web`. Se `/health` ou os pedidos a `/api/` falham, verifique o serviço `api` e `docker service logs` (ver comandos acima).

## 2) Ficheiro `.env` no servidor (serviço `api`)

- Coloque o `.env` **junto** ao [docker-stack.yml](docker-stack.yml) (o mesmo `REMOTE_DIR` de [deploy.sh](deploy.sh)), com base no modelo [deploy/.env.production.example](deploy/.env.production.example):
  - `DATABASE_URL` com um host acessível **a partir do container** da API (não use `localhost` para o Postgres no host, salvo padrão explícito da plataforma).
  - `PUBLIC_BASE_URL` e `CORS_ORIGIN` com o domínio **HTTPS** público.
  - `JWT_SECRET` longo e aleatório; `AUTH_DISABLED=false` para uso com login.
- Depois de editar, volte a publicar a stack: `export APP_VERSION=... && cd <REMOTE_DIR> && docker stack deploy -c docker-stack.yml <nome>` (ou o fluxo do [deploy.sh](deploy.sh)).

## 3) Base de dados, migrates e seed

- O [entrypoint](backend/docker-entrypoint.sh) da API executa `prisma migrate deploy` ao subir. O PostgreSQL tem de ser alcançável; se a API reinicia em ciclo, veja os logs do serviço.
- Se a base estiver vazia e faltar o utilizador admin, execute o seed (a partir de uma máquina com `DATABASE_URL` apontando **para o mesmo** Postgres) na pasta `backend`:

  ```bash
  cd backend
  export DATABASE_URL="postgresql://..."
  npm run db:seed
  ```

- O README descreve o admin seed (ex. `admin@loja.vera` / `admin123` após o seed) — trate a senha como insegura e altere o fluxo em produção consoante a vossa política.

## 4) Redeploy de imagem após alterar o Nginx

- Qualquer alteração a [frontend/nginx-default.conf](frontend/nginx-default.conf) (por exemplo, bloco `location = /health`) exige **rebuild e redeploy** da imagem `web` (ver [deploy.sh](deploy.sh)).
