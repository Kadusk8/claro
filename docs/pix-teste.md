# Integração inicial de Pix — somente Preview

Configurar MERCADO_PAGO_ACCESS_TOKEN com credencial TEST no ambiente Preview da Vercel. Esta versão bloqueia outros prefixos e VERCEL_ENV diferente de preview; não configurar produção para contornar o bloqueio. Verificar a disponibilidade de Pix de teste com a modalidade e conta usadas no Mercado Pago. Se não for suportado, o teste integrado permanece bloqueado, sem recorrer a cobrança real.

A branch pix-test deve gerar um Preview pela integração Git da Vercel. Fazer o teste nessa URL, não no domínio de produção.

O navegador solicita uma sessão assinada HttpOnly e cria a tentativa com idempotência vinculada à sessão por uma hora. A mesma sessão reutiliza a tentativa; outro navegador ou sessão expirada não tem deduplicação global. A assinatura usa HMAC com separação de domínio e o token do servidor; a futura persistência/autenticação deve ter segredo independente e rotação planejada. Não há dados pessoais no cookie. O nome e email são enviados ao Mercado Pago somente ao gerar o Pix.

Consultar o status faz uma leitura autenticada na API e confere referência, valor, moeda e modo de teste. Não concede acesso a documentos. Não há persistência de pedidos, webhook, autenticação de cliente, recuperação por email ou rate limiting distribuído nesta etapa; todos são pré-requisitos para produção. Não usar este protótipo para venda real.

Validação executada: três testes locais para bloqueio de produção, integridade/expiração da sessão e conferência dos campos financeiros. Ainda não validado: requisição real ao Mercado Pago, geração de Pix suportada pela conta, fluxo de navegador e deployment da Vercel.
