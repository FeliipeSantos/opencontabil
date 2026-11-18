/** Address of the module (Controle > Quadros). */
export const BOARDS_PATH = '/quadros';

export const boardPath = (id: string) => `${BOARDS_PATH}/${encodeURIComponent(id)}`;
