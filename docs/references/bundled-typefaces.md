# Bundled typefaces

The application serves Inter for UI text and Gelasio, a Georgia-compatible serif, for public display text. The WOFF2 assets include Turkish letters in precomposed and combining forms. Both families have separate upright and italic files with variable weights. The browser can use the same face for Turkish and basic Latin letters without requesting a font from a third party.

The sources are the [Inter](https://github.com/rsms/inter) and [Gelasio](https://github.com/SorkinType/Gelasio) distributions in [Google Fonts at cc5661d](https://github.com/google/fonts/tree/cc5661d43cd4f9aad5567033a8e15ca28dc35c86/ofl). The original SIL Open Font License notices are bundled alongside the font files.

Generate each asset from the corresponding upstream variable TTF using FontTools 4.60.1 with Brotli 1.2.1. For example, for the upright Inter file:

```sh
python3 -m fontTools.subset 'Inter[opsz,wght].ttf' \
  --output-file=public/fonts/inter-latin.woff2 --flavor=woff2 \
  --unicodes='U+0020-024F,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2190-21FF,U+2212' \
  --name-IDs='*' --no-recalc-timestamp
```
