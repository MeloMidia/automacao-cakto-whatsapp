# Cakto → Evolution API: convite para a comunidade

Serviço que recebe uma compra aprovada da Cakto e envia ao comprador, pela instância Evolution API já usada no sistemaMelo, um convite para o grupo da comunidade.

## Fluxo

1. A Cakto envia o evento `purchase_approved` para `POST /webhooks/cakto`.
2. O serviço valida a assinatura/segredo, o status, o produto e o telefone.
3. O pedido entra em uma fila persistente e a Cakto recebe a confirmação imediatamente.
4. O worker envia uma mensagem de texto pela Evolution API e tenta novamente em caso de falha.
5. O `data.id` da Cakto é único no banco, então reenvios do mesmo webhook não duplicam a mensagem.

O serviço aceita os formatos V1 (`data` como objeto) e V2 (`data` como lista) da Cakto. Por padrão, só a oferta principal envia convite; order bumps, upsells e downsells são ignorados.

## Pré-requisitos

- Node.js 22.5 ou superior, ou Docker;
- uma instância Evolution API conectada ao WhatsApp;
- URL, API key e nome da instância Evolution;
- uma URL pública com HTTPS para hospedar este serviço.

## 1. Mensagem enviada

Não é necessário criar nem aprovar um template. A automação envia este texto, preenchendo nome, produto e link:

```text
Olá, {{nome}}! 🎉

Seu pagamento do {{produto}} foi confirmado.

A comunidade exclusiva faz parte da sua compra. Entre pelo link:
{{link}}

Se precisar de ajuda, responda a esta mensagem.
```

O texto pode ser alterado em `src/evolution.js`. Mantenha-o transacional e sem promoção para reduzir denúncias e bloqueios.

## 2. Configure o projeto

```powershell
Copy-Item .env.example .env
npm install
```

Edite `.env` e preencha:

- `CAKTO_WEBHOOK_SECRET`: segredo que também será informado ao criar o webhook na Cakto;
- `CAKTO_ALLOWED_PRODUCT_IDS`: ID do curso. É possível informar mais de um, separado por vírgulas;
- `EVOLUTION_API_URL`: URL da mesma Evolution API usada pelo sistemaMelo;
- `EVOLUTION_API_KEY`: chave da Evolution armazenada apenas no servidor;
- `EVOLUTION_INSTANCE_NAME`: nome da instância, atualmente `sistemamelo` no CRM;
- `EVOLUTION_MIN_SEND_INTERVAL_MS`: intervalo mínimo entre mensagens, padrão de 7 segundos;
- `WHATSAPP_GROUP_INVITE_URL`: link de convite do grupo.

Comece com `DRY_RUN=true`. Nesse modo o webhook e a fila funcionam, mas nenhuma mensagem real é enviada.

## 3. Execute

Com Node.js:

```powershell
npm start
```

Ou com Docker:

```powershell
docker compose up --build -d
```

Teste a saúde local:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Em produção, mantenha uma única instância e um volume persistente para `/app/data`. Esta versão usa SQLite e foi desenhada para uma operação pequena/média. Para múltiplas réplicas, troque a fila por Postgres/Redis.

## 4. Cadastre o webhook na Cakto

No painel da Cakto:

1. Acesse **Integrações → Webhooks → Criar Novo Webhook**.
2. Use a URL pública `https://seu-dominio.com/webhooks/cakto`.
3. Selecione somente o produto do curso.
4. Marque o evento **Compra aprovada (`purchase_approved`)**.
5. Informe o mesmo segredo de `CAKTO_WEBHOOK_SECRET`.
6. Salve e use **Enviar evento de teste**.

Confira `GET /health`: a fila deve mostrar uma mensagem em `sent`. Como `DRY_RUN=true`, ainda não haverá envio real. Depois do teste, altere para `DRY_RUN=false`, reinicie o serviço e faça uma compra real de valor baixo/teste controlado.

> O evento correto é `purchase_approved`. `pix_gerado` significa apenas que a cobrança foi criada, não que a compra foi paga.

## Operação e segurança

- Nunca envie nem versione o arquivo `.env`.
- O endpoint valida `X-Cakto-Signature` (HMAC-SHA256) e aceita o segredo no corpo para compatibilidade com webhooks antigos.
- A assinatura vence em cinco minutos, reduzindo o risco de replay.
- Apenas nome, telefone, produto e ID do pedido são guardados; documento e e-mail não são persistidos.
- Falhas de envio são tentadas novamente até `MAX_SEND_ATTEMPTS`.
- As mensagens são enviadas sequencialmente, com intervalo mínimo configurável.
- Se o link do grupo vazar, revogue-o no WhatsApp e atualize `WHATSAPP_GROUP_INVITE_URL`.
- O cliente precisa ter consentido em receber mensagens relacionadas à compra; mantenha o texto transacional.
- A Evolution API não é uma integração oficial da Meta. Existe risco de desconexão ou bloqueio do número; use um número comercial dedicado e evite rajadas.

## Testes

```powershell
npm test
```

Os testes cobrem autenticação do webhook, expiração da assinatura, V1/V2, filtro de produto, telefone, deduplicação e o envio pela Evolution API.
