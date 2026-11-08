# Deploy no Coolify

- Conecte o Git e escolha Build Pack Dockerfile, caminho /Dockerfile e contexto /.
- Porta interna: 3001. Configure domínio HTTPS e DNS apontando ao servidor.
- Persistent Storage: volume em /app/data. Use uma única réplica.
- Crie uma conta de serviço no Firebase finance-64bfd com permissão para consultar usuários (Firebase Authentication Viewer). Monte sua chave JSON como arquivo secreto em /app/secrets/firebase.json, somente leitura. Nunca envie a chave ao Git ou à imagem.
- Variáveis de runtime: GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/firebase.json, FIREBASE_PROJECT_ID=finance-64bfd, PORT=3001, DATA_DIR=/app/data.
- Opcional: ADMIN_USER_ID com seu UID Firebase habilita o download do SQLite completo para esse administrador. Sem ele, use backup JSON individual.
- Autorize o domínio em Firebase Authentication. Faça Deploy e confira /health, login, lançamento, backup JSON e persistência após redeploy.

Para migrar dados locais, pare o servidor e faça um backup consistente do SQLite antes de restaurar no volume. Não copie apenas fincontrol.sqlite enquanto houver gravações ou WAL pendente. Volume novo começa vazio. Mantenha backups regulares do volume.

A API verifica tokens e revogação via Firebase Admin e precisa de conectividade de saída para Google. Frontend e API compartilham domínio. Não use Vite dev/preview em produção. A aplicação usa UID 1000; o volume deve permitir escrita por esse usuário.

## Desenvolvimento local
Execute npm run dev. Sem NODE_ENV=production e sem GOOGLE_APPLICATION_CREDENTIALS, o servidor verifica assinatura, projeto e expiração do token sem consultar revogação, dispensando chave administrativa. Em produção (Docker), a consulta de revogação permanece obrigatória. O SQLite local continua em data/fincontrol.sqlite. Reinicie o servidor após atualizar o código.
