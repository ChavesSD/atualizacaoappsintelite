/**
 * Vídeos de apoio do tutorial (gravações da Intelite). Os arquivos ficam em /downloads/videos e vão junto no deploy.
 * No texto de uma etapa (admin), a linha `[[video:remover]]` mostra o vídeo, somente para quem escolheu o formato vídeo.
 * Este módulo só tem dados (é usado no navegador); o acesso a disco fica em `videos-server.ts`.
 */
export const TUTORIAL_VIDEOS = {
  remover: { title: "Como remover a versão anterior", note: "O procedimento é o mesmo para o totem e para o painel." },
  instalar: { title: "Como baixar e instalar a nova versão", note: "O procedimento é o mesmo para o totem e para o painel; muda apenas o link." },
  ajustar: { title: "Como ajustar a proporção da tela", note: "Use as setas do controle remoto, como mostrado." },
} as const;

export type TutorialVideo = keyof typeof TUTORIAL_VIDEOS;

export const isTutorialVideo = (v: string): v is TutorialVideo => Object.prototype.hasOwnProperty.call(TUTORIAL_VIDEOS, v);
export const videoSrc = (slug: TutorialVideo) => `/api/videos/${slug}.mp4`;
export const videoPoster = (slug: TutorialVideo) => `/api/videos/${slug}.jpg`;

