<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1poaXLh-8_borcITmY1SxTohtdDG3Xu4c

## Run Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the app:
   ```bash
   npm run dev
   ```
   *O comando `npm run dev` inicia simultaneamente o servidor backend SQLite (`server/index.js`) na porta 3001 e o frontend Vite na porta 5173 com proxy configurado.*

## Banco de Dados Local (SQLite)

- Os dados financeiros são armazenados localmente no arquivo `data/fincontrol.sqlite`.
- A autenticação permanece integrada ao Firebase Auth (Login com Google/Gmail e e-mail/senha).
- Os dados de cada usuário são isolados localmente pelo `uid` da sua conta.
