/**
 * Vídeos do tutorial (gravações da Intelite). Os arquivos ficam em /downloads/videos e vão junto no deploy.
 *  - `tutorial`: vídeo completo da atualização, com narração, legendas (tutorial.vtt) e capítulos (tutorial.json).
 *    Aparece ao lado do passo a passo, sincronizado com ele.
 *  - `ajustar`: ajuste da proporção da tela, usado dentro do tutorial de ajuste (`[[video:ajustar]]` no texto da etapa).
 * Este módulo só tem dados (é usado no navegador); o acesso a disco fica em `videos-server.ts`.
 */
export const TUTORIAL_VIDEOS = {
  ajustar: { title: "Como ajustar a proporção da tela", note: "Use as setas do controle remoto, como mostrado." },
} as const;

export type TutorialVideo = keyof typeof TUTORIAL_VIDEOS;

export const isTutorialVideo = (v: string): v is TutorialVideo => Object.prototype.hasOwnProperty.call(TUTORIAL_VIDEOS, v);
export const videoSrc = (slug: TutorialVideo) => `/api/videos/${slug}.mp4`;
export const videoPoster = (slug: TutorialVideo) => `/api/videos/${slug}.jpg`;

/** Vídeo principal do guia: capítulos na mesma ordem dos blocos ("## título") do texto da etapa "Atualizar". */
export interface GuideVideo {
  title: string;
  src: string;
  poster: string | null;
  captions: string | null;
  durationSec: number;
  chapters: { title: string; start: number }[];
}

