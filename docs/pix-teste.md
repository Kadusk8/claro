# Pix Asaas — integração inicial exclusivamente Sandbox

A integração ativa substitui Mercado Pago. Documentos de arquitetura anteriores descrevem o planejamento original e não a integração ativa.

## Configuração

Na Vercel, configurar ASAAS_API_KEY como segredo somente em Preview, branch pix-test, com uma chave criada na conta Sandbox do Asaas. Não enviar a chave ao chat. MERCADO_PAGO_ACCESS_TOKEN não é mais lida e pode ser removida da configuração pelo responsável. Não utilizar a chave antiga exposta em conversa.

O servidor exige VERCEL_ENV=preview e usa exclusivamente https://api-sandbox.asaas.com/v3. Não existe override para produção. A chave fica no servidor, enviada no header access_token. A assinatura das sessões tem namespace próprio desta integração; sessões antigas são invalidadas.

## Fluxo implementado

- Sessão assinada HttpOnly, Secure e SameSite=Strict, com duração de uma hora. Sem nome, email ou CPF no cookie.
- Formulário solicita nome, email e CPF de teste. Apenas validação básica de formato do CPF nesta etapa; usar dados sintéticos aceitos pelo Sandbox, sem dados reais.
- Busca cobrança por externalReference do pedido e reutiliza quando encontrada. Busca ou cadastra cliente com notificações desativadas e cria cobrança PIX por R$ 19,90 com valor definido no servidor.
- Salva referência da cobrança na sessão antes de buscar o payload Pix, para permitir recuperação de falha do QR.
- Obtém o payload em /payments/{id}/pixQrCode e consulta a cobrança autenticada no servidor, conferindo referência, valor, tipo e exclusão. Status RECEIVED ou CONFIRMED é exibido como confirmação de teste; não libera documentos.
- Interface apresenta Pix copia e cola. Imagem de QR Code ainda não implementada.

## Limitações que impedem produção

Não há banco de pedidos, recuperação por email, webhook, armazenamento de documentos, rate limiting distribuído nem trava distribuída contra concorrência. A busca antes de criar evita repetição sequencial, mas não garante exclusão mútua nem exatamente uma cobrança em requisições simultâneas. Sessão expirada ou outro navegador também não deduplicam o mesmo cliente. Implementar persistência e transações antes de qualquer habilitação comercial. Esta integração não é um fluxo de venda operacional.

Credenciais indisponíveis no executor e documentação oficial retornando HTTP 403 em 28/10/2026. Endpoints implementados devem ser confirmados em teste integrado antes de declarar funcionamento. Requisitos do CPF, permissões de Pix, chave Pix da conta e comportamento de busca/expiração permanecem sujeitos à validação com Sandbox. Nunca resolver divergências recorrendo à produção.

## Verificação executada

Seis testes com respostas simuladas: bloqueio de produção/configuração, assinatura e expiração da sessão, conferência financeira, host Sandbox e tratamento sem vazamento de erros, reutilização/detecção de duplicidade e criação seguida da consulta do payload Pix. Sintaxe de módulos verificada. Nenhuma chamada autenticada ao Asaas foi executada e nenhum Pix foi gerado no provedor.

## Próximo teste

Após salvar ASAAS_API_KEY, abrir o novo deployment da branch pix-test, preencher dados sintéticos e clicar em Gerar Pix de teste. Usar a simulação oferecida pelo painel Sandbox para testar confirmação; não efetuar transferência bancária real. Conferir a mensagem e a cobrança no painel do Sandbox. Guardar apenas identificadores de teste e resultados, sem dados pessoais ou segredos.
