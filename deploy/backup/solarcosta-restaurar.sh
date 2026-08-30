#!/usr/bin/env bash
#
# Restauração do banco SolarCosta a partir de um dump.
#
#   ./solarcosta-restaurar.sh /var/backups/solarcosta/diario/solarcosta-AAAAMMDD-HHMMSS.dump
#
# DESTRUTIVO: substitui o conteúdo do banco de destino. Pede confirmação
# explícita digitada — não aceita apenas "s".
#
# Faça este teste UMA VEZ por trimestre num banco descartável. Backup que
# nunca foi restaurado é uma suposição, não uma garantia.

set -Eeuo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5434}"
PGUSER="${PGUSER:-postgres}"
# Por padrão restaura num banco de TESTE, não no de produção.
PGDATABASE="${PGDATABASE:-SolarCosta_restore_teste}"

arquivo="${1:-}"

if [ -z "$arquivo" ]; then
    echo "uso: $0 <arquivo.dump>"
    echo
    echo "Backups disponíveis:"
    find /var/backups/solarcosta -name '*.dump' -type f -printf '%TY-%Tm-%Td %TH:%TM  %10s  %p\n' 2>/dev/null \
        | sort -r | head -20
    exit 1
fi

[ -f "$arquivo" ] || { echo "arquivo não encontrado: $arquivo"; exit 1; }

echo "Conferindo integridade do dump..."
pg_restore --list "$arquivo" > /dev/null || { echo "dump corrompido."; exit 1; }
tabelas=$(pg_restore --list "$arquivo" | grep -c 'TABLE DATA public SolarCosta' || true)
echo "  ok · $tabelas tabelas SolarCosta_ no dump · $(du -h "$arquivo" | cut -f1)"
echo

echo "════════════════════════════════════════════════════════════"
echo "  ATENÇÃO: isto APAGA o conteúdo atual de:"
echo
echo "    banco:    $PGDATABASE"
echo "    servidor: $PGHOST:$PGPORT"
echo
echo "  e substitui pelo conteúdo de:"
echo "    $arquivo"
echo "════════════════════════════════════════════════════════════"
echo
read -r -p 'Digite exatamente RESTAURAR para continuar: ' confirmacao

if [ "$confirmacao" != "RESTAURAR" ]; then
    echo "Cancelado."
    exit 1
fi

echo
echo "Restaurando..."

# --clean derruba os objetos antes de recriar; --if-exists evita erro quando
# o objeto ainda não existe. Sem --exit-on-error de propósito: avisos de
# ownership em objetos de extensão são normais e não invalidam a restauração.
pg_restore \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-password \
    --verbose \
    "$arquivo" 2>&1 | grep -Ev '^pg_restore: (processing|creating|executing)' || true

echo
echo "Conferindo o resultado..."
psql --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" \
     --no-password --tuples-only --command "
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name LIKE 'SolarCosta%') || ' tabelas, ' ||
  (SELECT count(*) FROM information_schema.views
    WHERE table_schema='public' AND table_name LIKE 'SolarCosta%') || ' views, ' ||
  (SELECT count(*) FROM \"SolarCosta_Usuarios\") || ' usuarios, ' ||
  (SELECT count(*) FROM \"SolarCosta_Leads\") || ' leads';
"

echo
echo "Restauração concluída em $PGDATABASE."
