# Contrato Claro IA — arquitetura e implementação

## Estado verificado

Em 28/10/2026, o checkout e o remoto Kadusk8/claro não contêm arquivos ou commits. A demonstração na Vercel foi informada pelo responsável, mas não foi inspecionada. Nenhuma funcionalidade de pagamento, upload ou análise foi validada. A proposta abaixo depende da inspeção do código original; preservar a stack e as funcionalidades aproveitáveis tem prioridade.

## Arquitetura proposta

- Aplicação TypeScript com Next.js na Vercel, se compatível com o código recebido. Componentes mobile first e endpoints de servidor na mesma aplicação reduzem custo e manutenção inicial.
- Supabase para PostgreSQL, autenticação e armazenamento privado. Políticas por usuário e pedido; nenhuma permissão pública sobre documentos. Avaliar região, contratos de tratamento, transferências internacionais e custo antes de contratar.
- Mercado Pago Pix chamado exclusivamente pelo servidor. Credenciais de teste e produção separadas. Cobranças reais desativadas por configuração no servidor até autorização e validação operacional.
- Fila gerenciada e worker separado para extração/OCR e análise: tarefas longas não devem depender do tempo de execução de uma requisição da Vercel. Selecionar provedor após medir duração, volume e custo em documentos sintéticos.
- Provedor de IA acessado pelo worker com envio mínimo de dados e política de retenção contratualmente avaliada. Modelo e OCR serão escolhidos após avaliação de qualidade e custos.

O custo variável por análise inclui armazenamento, extração/OCR, tokens, fila e tarifa de pagamento. Medir margem sobre R$ 19,90 antes da liberação comercial. Definir limites de páginas, tamanho e tokens e um orçamento por pedido.

## Módulos e estrutura sugerida

```text
src/app/                  rotas, telas e endpoints
src/components/ui/        botões, campos, estados e acessibilidade
src/features/intake/      dados iniciais, preço e consentimentos
src/features/payments/    checkout Pix e acompanhamento
src/features/documents/   upload e estado dos documentos
src/features/analysis/    progresso e diagnóstico
src/server/auth/          sessão e autorização
src/server/payments/      cliente Mercado Pago, webhook e conciliação
src/server/documents/     armazenamento privado e validação
src/server/analysis/      orquestração, regras e saída estruturada
src/server/db/            consultas e transações
workers/                  extração, OCR e análise assíncrona
tests/                    integração e jornadas críticas
```

Adaptar esta organização à stack real, sem reescrever a demonstração por conveniência. Componentes visuais não acessam credenciais nem decidem autorização.

## Pedido, pagamento e acesso

Entidades: usuários, pedidos, tentativas de pagamento, eventos recebidos, documentos, trabalhos de análise e relatórios. Registrar versões de termos e aviso de privacidade aceitos, quando e para qual finalidade. Não coletar CPF ou outros dados sem necessidade demonstrada.

Manter estados separados para pagamento (pendente, aprovado, expirado, cancelado ou reembolsado), documentos (aguardando, em validação, aceitos ou rejeitados) e análise (aguardando, em execução, concluída ou falha). Atualizações financeiras precisam de histórico e não devem regredir por evento atrasado.

1. Criar o pedido no servidor com preço fixado em 1.990 centavos e moeda BRL. Antes de criar cobrança, estabelecer um mecanismo seguro de recuperação do pedido por email; limitar coleta inicial para reduzir abandono.
2. Criar pagamento com chave de idempotência estável por tentativa. Restringir tentativas ativas por pedido e reutilizar Pix pendente. Conciliação deve tratar timeout após criação e pagamentos duplicados sem liberar análises extras.
3. Validar assinatura do webhook conforme a documentação vigente do Mercado Pago. Aplicar proteção contra repetição e processar eventos de forma idempotente. Não registrar dados sensíveis nos logs.
4. Consultar o pagamento na API autenticada e conferir status aprovado, valor, moeda, referência do pedido e recebedor esperado. Redirecionamento, query string e resposta do navegador nunca liberam acesso.
5. Persistir confirmação e liberação em transação. Conciliação periódica recupera webhooks perdidos. Eventos duplicados não repetem entrega nem cobrança.
6. Exigir sessão autenticada vinculada ao proprietário para acessar pedido, upload e relatório. Um identificador de pedido sozinho não é autorização. Links de autenticação devem expirar e usar redirecionamentos permitidos.

## Documentos, privacidade e análise

- Bucket privado; URLs assinadas curtas e emitidas somente após autorização. Segredos apenas no servidor. Separar ambientes e usar documentos sintéticos no desenvolvimento.
- Limitar tamanho, quantidade e páginas; validar tipo real do arquivo, verificar malware e rejeitar conteúdo incompatível. Nomes aleatórios e processamento isolado. Não enviar arquivos a OCR/IA antes da validação.
- Definir política de retenção, exclusão de originais, texto extraído e relatórios, incluindo prazo de expiração de backups. Prever pedidos dos titulares, suporte, incidentes e base legal por finalidade. Consentimento não substitui a avaliação de base legal.
- Criptografia em trânsito e em repouso, autorização por objeto, controle de acesso administrativo e trilha de auditoria sem conteúdo contratual. Aplicar rate limit em autenticação, cobrança, upload e análise.
- Tratar documentos como entrada não confiável: instruções dentro deles não podem alterar regras nem acionar ferramentas. Saída estruturada validada, com referências a página/trecho e distinção entre fato identificado, possível atenção e informação insuficiente.
- Informar limites de extração e ausência de dados. Seguro não comprova venda casada. Não prometer reembolso nem resultado jurídico. Serviço independente da Caixa, com análise preliminar e informativa.
- Falhas devem permitir retomada segura e oferecer caminho de suporte. Definir cancelamento, reembolso e tratamento de falhas antes de cobrar clientes reais.

## Etapas e critérios de conclusão

1. **Inspeção e linha de base:** receber código original, identificar stack, rotas, dependências, integrações e persistência; executar build e jornadas existentes. Produzir inventário de funcionalidade real versus simulação e preservar o comportamento útil.
2. **Organização e experiência mobile:** extrair componentes e módulos gradualmente; entrada direta no início da análise, preço claro antes do pagamento, formulários curtos, estados de erro e acessibilidade. Validar em telas pequenas e teclado móvel.
3. **Fundação segura:** schema e migrações, autenticação e recuperação de pedido, autorização, políticas de armazenamento, avisos legais, observabilidade e ambientes separados. Testar tentativas de acesso entre dois usuários.
4. **Pagamento em teste:** criação Pix idempotente, assinatura, confirmação por API, conciliação e estados. Validar webhook inválido, repetido e atrasado, timeout, valor divergente e tentativa de liberar acesso pelo navegador. Manter produção bloqueada.
5. **Upload privado:** validação e quarentena, verificação de arquivos e retenção. Testar formatos proibidos, arquivos grandes, expiração de URL e acesso indevido.
6. **Extração e análise:** implementar worker com retries limitados, deduplicação e limites de custo; avaliar contratos sintéticos ou devidamente anonimizados. Testar citações, ausência de dados, falhas de OCR e instruções maliciosas nos documentos.
7. **Jornada integrada:** concluir pedido de teste até relatório, verificar recuperação de falhas, exclusão e suporte; revisar segurança e qualidade jurídica das mensagens. Avaliar conversão sem enviar documentos ou dados sensíveis ao Meta Pixel; configurar mensuração e consentimentos pertinentes.
8. **Liberação controlada:** apresentar evidências, custos, limites e procedimentos operacionais para autorização explícita. Publicação e ativação de cobranças reais são ações separadas e dependem dessa autorização.

## Pendência atual

Disponibilizar os arquivos da demonstração em ZIP ou no repositório. A URL da Vercel ajuda a avaliar a experiência visual, mas não substitui o código para auditar pagamentos, segurança e persistência.
