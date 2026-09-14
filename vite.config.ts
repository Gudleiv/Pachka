import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * CSP приходится класть мета-тегом: GitHub Pages не позволяет задавать
 * заголовки. Адрес Supabase известен только на сборке, поэтому политика
 * собирается здесь, а не лежит в index.html готовой строкой.
 *
 * Мета-тег не умеет `frame-ancestors` — встраивание страницы в чужой iframe
 * этим способом не запретить.
 */
function cspMeta(supabaseUrl: string): Plugin {
  const api = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    // Интерфейс написан инлайновыми стилями, шрифты — у Google.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    // Обложка пачки задаётся в базе, так что хост картинки заранее неизвестен.
    "img-src 'self' https:",
    `connect-src 'self'${api ? ` ${api}` : ''}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return {
    name: 'pachka-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="utf-8" />',
        `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

// GitHub Pages serves a project site from /<repo>/, so assets need that prefix.
// The deploy workflow passes the real repo name through BASE_PATH.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env['BASE_PATH'] || '/pachka/',
    plugins: [cspMeta((env['VITE_SUPABASE_URL'] ?? '').trim())],
    build: { outDir: 'dist', assetsDir: 'assets', target: 'es2022' },
  };
});
