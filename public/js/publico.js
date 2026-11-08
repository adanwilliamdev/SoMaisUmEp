// Página pública de um top (/t/<código>, montada no servidor por api/_pagina.js): só aplica os estilos vindos de data-*
// (o CSP não aceita style="" no HTML), como a cor do pôster provisório de quem não tem capa.
import { observarEstilos } from './util.js';

observarEstilos();
