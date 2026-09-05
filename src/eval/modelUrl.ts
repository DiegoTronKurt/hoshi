/** URL del modelo de KataGo vendorizado (ver public/models/kata-b10c128/),
 * compartida por todo lugar que construya un EvalClient -- antes duplicada
 * a mano en ReviewScreen.tsx, ahora tambien usada por PlayGameScreen.tsx. */
export const EVAL_MODEL_URL = `${import.meta.env.BASE_URL}models/kata-b10c128/model.json`
