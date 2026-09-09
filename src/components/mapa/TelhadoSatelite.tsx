// Figura do telhado com os módulos posicionados.
//
// Um componente só para a calculadora e para o PDF: a figura que o consultor
// aprova na tela precisa ser exatamente a que sai impressa.
//
// Como é montado: uma imagem de satélite sem sobreposições (vinda do nosso
// proxy) e um <svg> por cima com um polígono por módulo. Os módulos NÃO são
// desenhados pelo Google — o `path=` do Static Maps estoura o limite de URL
// na casa das duas dezenas de placas, e viria rasterizado. Em SVG a figura
// continua vetorial no papel.

import React from 'react';
import { ModuloLayout } from '../../types';
import { enquadrar, projetar, type Enquadramento } from '../../utils/layoutModulos';

interface TelhadoSateliteProps {
  modulos: ModuloLayout[];
  /** Object URL da imagem de satélite. Sem ela a figura sai só com os módulos. */
  imagemUrl?: string | null;
  /** Enquadramento já resolvido. Omitido, é derivado dos próprios módulos. */
  enquadramento?: Enquadramento;
  /** Linha discreta no rodapé da figura — normalmente a data da imagem. */
  legenda?: string;
  className?: string;
}

export const TelhadoSatelite: React.FC<TelhadoSateliteProps> = ({
  modulos,
  imagemUrl,
  enquadramento,
  legenda,
  className = '',
}) => {
  // O enquadramento carrega o tamanho do quadro: o viewBox precisa ser o
  // MESMO usado ao pedir a imagem, senão a foto e os módulos desencontram.
  const enq = enquadramento ?? enquadrar(modulos);

  const poligonos = modulos.map((m) =>
    m.cantos
      .map((c) => {
        const p = projetar(enq, c);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' '),
  );

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-800 ${className}`}
      style={{ aspectRatio: '1 / 1' }}
    >
      {imagemUrl ? (
        <img
          src={imagemUrl}
          alt="Vista de satélite do telhado com os módulos posicionados"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // Sem imagem a figura ainda serve: o consultor confere a disposição e
        // a contagem dos módulos. É também o estado enquanto a imagem carrega.
        <div className="absolute inset-0 bg-slate-800" aria-hidden />
      )}

      <svg
        viewBox={`0 0 ${enq.larguraPx} ${enq.alturaPx}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`${modulos.length} módulos fotovoltaicos posicionados sobre o telhado`}
      >
        {poligonos.map((pontos, i) => (
          <polygon
            key={i}
            points={pontos}
            // Preenchimento escuro com contorno claro: é como o módulo aparece
            // numa foto aérea, e o contorno mantém as placas distinguíveis
            // mesmo quando o telhado embaixo já é escuro.
            fill="#0b1b2b"
            fillOpacity={0.88}
            stroke="#e2e8f0"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        ))}
      </svg>

      {legenda && (
        <p className="absolute bottom-0 left-0 right-0 bg-black/55 px-3 py-1.5 text-[10px] font-semibold text-white">
          {legenda}
        </p>
      )}
    </div>
  );
};
