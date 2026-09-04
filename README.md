# Fitnamente Studio

Estúdio web gratuito para aplicar um layout padrão a vários vídeos.

## O que esta versão faz

- Upload de múltiplos vídeos.
- Template Clean ou Top.
- Personalização do `@perfil`.
- Texto opcional.
- Pré-visualização.
- Exportação local no navegador.
- Não envia os vídeos para um servidor.

## Limitação importante

A versão atual exporta **WebM**, porque `MediaRecorder` é uma API do navegador. Ela não depende de FFmpeg/servidor.

Para gerar **MP4/H.264**, manter áudio de forma consistente e fazer processamento em lote mais robusto, a próxima versão deve usar FFmpeg WebAssembly (`@ffmpeg/ffmpeg`) ou um backend.

## Como publicar grátis

1. Crie um repositório no GitHub.
2. Envie `index.html`, `style.css` e `script.js`.
3. Em Settings > Pages, habilite GitHub Pages.
4. Escolha a branch `main` e a pasta `/root`.
5. Abra o endereço fornecido pelo GitHub.

Também pode ser publicado em Cloudflare Pages ou Netlify.

## Uso

Abra `index.html` em Chrome/Edge atual ou publique os arquivos em HTTPS. Para alguns recursos de mídia, HTTPS é mais confiável que abrir o arquivo diretamente.
