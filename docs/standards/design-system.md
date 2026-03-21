# Design System Base - GrupoB

## Fontes

Baseado em `index.html`:

- Fonte primaria: `Inter` (`font-sans`).
- Fonte secundaria: `Nunito Sans` (`font-nunito`).

## Paleta base (tokens bitrix)

Definida no `tailwind.config` inline de `index.html`:

- `bitrix.nav`: `#111827`
- `bitrix.accent`: `#7C3AED`
- `bitrix.text`: `#1F2937`
- `bitrix.secondary`: `#6B7280`
- `bitrix.border`: `#E5E7EB`
- `bitrix.surface`: `#FFFFFF`

## Superficie e base de tela

- Fundo global: `#F9FAFB`.
- Estilo visual predominante: clean, alto contraste, bordas suaves, foco em legibilidade.

## Diretriz para novos sistemas

1. Manter os tokens acima como base.
2. Evitar criar paletas paralelas sem necessidade.
3. Centralizar qualquer novo token em um unico ponto de configuracao.
