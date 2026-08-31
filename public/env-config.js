// Placeholder para dev/build local. Em produção (Docker/Nginx), o
// docker-entrypoint.sh sobrescreve este arquivo com a URL real da API,
// lida da variável de ambiente VITE_API_URL do container.
window.__ENV__ = {
  VITE_API_URL: '',
};
