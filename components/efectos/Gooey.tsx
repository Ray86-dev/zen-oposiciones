/**
 * Los filtros que dan la textura líquida de Zen.
 *
 * Es la técnica clásica del "gooey": se desenfoca la silueta y después se
 * recorta el canal alfa con una matriz de contraste, de modo que dos formas
 * cercanas se funden en una sola gota en lugar de solaparse. Todo es SVG, así
 * que no cuesta GPU, funciona en Safari y sobrevive al export estático.
 *
 * Se monta una sola vez en el layout; los componentes lo invocan con
 * filter: url(#zen-goo).
 */
export default function Gooey() {
  return (
    <svg className="zen-defs" aria-hidden focusable="false">
      <defs>
        {/* Fusión amplia: navegación, grupos de botones. */}
        <filter id="zen-goo" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="borroso" />
          <feColorMatrix
            in="borroso"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"
            result="gota"
          />
          <feComposite in="SourceGraphic" in2="gota" operator="atop" />
        </filter>

        {/* Fusión corta: puntas de anillo, indicadores pequeños. */}
        <filter id="zen-goo-fino" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="borroso" />
          <feColorMatrix
            in="borroso"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
          />
        </filter>

        {/* Halo suave para el fondo de los anillos. */}
        <filter id="zen-halo" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
        </filter>
      </defs>
    </svg>
  );
}
