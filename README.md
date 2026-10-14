# Cakto → WhatsApp: convite para a comunidade

Serviço que recebe uma compra aprovada da Cakto e envia ao comprador, pela API oficial do WhatsApp, um convite para o grupo da comunidade.

## Fluxo

1. A Cakto envia o evento `purchase_approved` para `POST /webhooks/cakto`.
2. O serviço valida a assinatura/segredo, o status, o produto e o telefone.
3. O pedido entra em uma fila persistente e a Cakto recebe a confirmação imediatamente.
4. O worker envia um template aprovado pelo WhatsApp e tenta novamente em caso de falha.
5. O `data.id` da Cakto é único no banco, então reenvios do mesmo webhook não duplicam a mensagem.

O serviço aceita os formatos V1 (`data` como objeto) e V2 (`data` como lista) da Cakto. Por padrão, só a oferta principal envia convite; order bumps, upsells e downsells são ignorados.

## Pré-requisitos

- Node.js 22.5 ou superior, ou Docker;
- um número configurado na **WhatsApp Business Platform (Cloud API)**;
- um token permanente do System User da Meta com acesso ao número;
- um template aprovado no WhatsApp Manager;
- uma URL pública com HTTPS para hospedar este serviço.

## 1. Crie o template do WhatsApp

No WhatsApp Manager, crie um template chamado `convite_comunidade_compra`, idioma **Português (Brasil)**, categoria **Utility**, usando variáveis nomeadas:

```text
Olá, {{nome}}! Sua compra do curso {{produto}} foi aprovada. 🎉

Entre agora no grupo exclusivo da comunidade:
{{link}}

Se você não reconhece esta compra, ignore esta mensagem.
```

O texto definitivo e a categoria dependem da aprovação da Meta. Os nomes das três variáveis precisam ser exatamente `nome`, `produto` e `link`. Se você mudar o nome ou o idioma do template, atualize o `.env`.

## 2. Configure o projeto

```powershell
Copy-Item .env.example .env
npm install
```

Edite `.env` e preencha:

- `CAKTO_WEBHOOK_SECRET`: segredo que também será informado ao criar o webhook na Cakto;
- `CAKTO_ALLOWED_PRODUCT_IDS`: ID do curso. É possível informar mais de um, separado por vírgulas;
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número na Meta, não o número de telefone;
- `WHATSAPP_ACCESS_TOKEN`: token permanente armazenado apenas no servidor;
- `WHATSAPP_GROUP_INVITE_URL`: link de convite do grupo;
- `META_GRAPH_API_VERSION`: versão ativa configurada para o app da Meta.

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
- Se o link do grupo vazar, revogue-o no WhatsApp e atualize `WHATSAPP_GROUP_INVITE_URL`.
- O cliente precisa ter consentido em receber mensagens relacionadas à compra; mantenha o texto transacional.

## Testes

```powershell
npm test
```

Os testes cobrem autenticação do webhook, expiração da assinatura, V1/V2, filtro de produto, telefone e deduplicação.
