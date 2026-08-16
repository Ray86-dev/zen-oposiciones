/** Stub del motor neuronal para las pruebas: ni worker, ni ONNX, ni descargas. */
class SintesisCancelada extends Error {}
module.exports = {
  SintesisCancelada,
  VOCES_ES: [{ id: "es_ES-sharvard-medium", nombre: "Sharvard", nota: "", mb: 60 }],
  sintetizar: async () => ({ size: 128, type: "audio/wav" }),
  descargarVoz: async () => {},
  vocesDescargadas: async () => ["es_ES-sharvard-medium"],
  cancelarSintesis: () => {},
  liberarMotorVoz: () => {},
  apagarMotorVoz: () => {},
};
