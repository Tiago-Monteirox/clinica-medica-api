# SaasClinic Web

Interface operacional do SaasClinic para uso por administradores, recepcionistas, médicos e pacientes.

## Como rodar

Suba o backend em HOM ou PROD e sirva este diretório em uma porta liberada no CORS do gateway. Use `8000` para coexistir com o API Console; use `5174` se `8000` estiver ocupada.

```bash
cd saasclinic-web
python3 -m http.server 8000
# acesse http://localhost:8000

# alternativa
python3 -m http.server 5174
# acesse http://localhost:5174
```

Credencial inicial do backend:

```text
admin@clinica.com / admin123
```

## Ambientes

Abra o painel **Tweaks** e selecione:

- `HOM` -> `http://localhost:8084`
- `PROD` -> `http://localhost:8085`

Tokens e usuário logado são salvos por ambiente no `localStorage`.

## Observações

- `Mock` continua disponível para demonstração offline.
- Em `Live`, o acesso rápido por persona só usa a seed ADMIN. Para outros perfis, crie usuários reais em `Usuários` e faça login com as credenciais criadas.
- A tela de usuários lista contas via `GET /api/admin/v1/usuarios` e cria novas contas via `POST /auth/register`. Edição e exclusão permanecem indisponíveis em modo live.
- Ao registrar atendimento, o status do agendamento é atualizado assincronamente pelo RabbitMQ para `ATENDIDO`.

API Console no mesmo servidor: [`/api-console/`](api-console/).

Documentação completa: [`docs/23-SAAS-WEB.md`](../docs/23-SAAS-WEB.md).
