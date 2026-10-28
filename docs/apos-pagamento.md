# Após o pagamento — Preview de teste

## Implementado

Pagamento confirmado no Asaas Sandbox leva à tela de documentos. A página tenta retomar uma sessão paga ao recarregar, enquanto o cookie de uma hora continuar válido. Cada listagem e envio reconsulta o Asaas e confere o pedido, valor R$ 19,90, tipo PIX e estado RECEIVED/CONFIRMED. Reembolso ou pendência bloqueiam acesso. Identificadores enviados pelo navegador não selecionam o pedido.

Arquivos de teste PDF até 1 MB são enviados pelo servidor a um bucket privado de quarentena. Verificação básica de assinatura e final PDF não é antivírus, parser completo ou sanitização. Nenhum arquivo segue para IA. Interface recebe apenas categoria e estado; nomes originais não são armazenados. Paths usam o pedido da sessão assinada e UUID aleatório. A chave service-role nunca vai para o navegador. Nenhuma URL pública é gerada.

## Preparar o projeto Supabase existente

1. Executar supabase/documents.sql no SQL Editor. Confirmar public=false. Auditar políticas existentes de storage.objects: não deve haver acesso de anon/authenticated ao bucket contracts-quarantine, inclusive por políticas globais. Não tornar o bucket público.
2. Na Vercel, projeto contrato-claro-ia, adicionar SUPABASE_URL (URL HTTPS do projeto) e SUPABASE_SERVICE_ROLE_KEY (chave legada service_role do projeto) somente em Preview, branch pix-test. A chave é segredo exclusivo do servidor; não usar prefixos públicos nem chave anon. Não compartilhar valores no chat. Alternativamente, adaptar e validar a autenticação antes de usar novo formato de chave.
3. Preservar ASAAS_API_KEY do Sandbox e criar novo deployment de pix-test. Se a chave Asaas for trocada, sessões assinadas antigas deixam de valer.
4. Abrir o novo Preview; usar pagamento Sandbox e PDF fictício sem dados pessoais. Verificar que upload e listagem funcionam, que outro navegador não tem acesso e que pendência/reembolso bloqueiam a operação.
5. Apagar os PDFs de teste pelo painel Storage ao terminar e definir política automatizada de retenção antes de dados reais. Não colocar dados reais nesta fase.

## Validação e limites

Testes locais simulam autorização de pagamento, isolamento do pedido, recusa de bucket público, formato/tamanho do PDF, envio privado e estado de configuração ausente. Não confirmam o projeto Supabase real nem o runtime Vercel; esses testes integrados dependem das variáveis e do bucket.

A sessão expira após uma hora. Ainda não há recuperação de pedido, autenticação por email, banco de pedidos, webhook, pipeline de malware/OCR, IA, diagnóstico nem retenção automatizada. O limite de cinco arquivos é sequencial, sem trava distribuída; tentativas simultâneas podem ultrapassá-lo. Upload não é idempotente em resposta perdida: a interface orienta atualizar a listagem antes de reenviar. Não há download do documento no app. Somente dados sintéticos e Preview são permitidos nesta entrega.
