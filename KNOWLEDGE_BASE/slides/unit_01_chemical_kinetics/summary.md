# ملخص المشارع التجريبي — unit_01_chemical_kinetics

> توليد آلي بخط الإنتاج: decks (①) → scene scripts (②) → SVGs (③) → index.json (④). لا يُحرَّر يدويًا إلا عبر `/build-slides`.

## الوضع

- **deck أقسام:** 13 — `sections/01.deck.md` … `13.deck.md`
- **مشاهد منجزة:** 8 — `scenes/*.script.json` + `assets/*.svg`
- **الشريحات:** 41 شريحة في `public/course/slides/unit_01_chemical_kinetics/index.json`
- **حالة الفحص:** ينتظر `node scripts/smoke-slides.js`

## بِنية deck (sample)

```markdown
## الشريحة 1 — العنوان
<type>: text            # title|text|formula|table|scene|mixed
<layout>: full          # full|two-col
<scene>?: no            # yes|no
```

## المشاهد المنجزة

| الشريحة | النوع | svg | script |
|---|---|---|---|
| unit1-s1-sl4 | انتقال e⁻ | assets/unit1-s1-sl4.svg | scenes/unit1-s1-sl4.script.json |
| unit1-s3-sl3 | التمديد | assets/unit1-s3-sl3.svg | scenes/unit1-s3-sl3.script.json |
| unit1-s4-sl2 | المتفاعل المحدّ | assets/unit1-s4-sl2.svg | scenes/unit1-s4-sl2.script.json |
| unit1-s5-sl2 | أصناف التحولات | assets/unit1-s5-sl2.svg | scenes/unit1-s5-sl2.script.json |
| unit1-s6-sl2 | نِقيس الناقلية | assets/unit1-s6-sl2.svg | scenes/unit1-s6-sl2.script.json |
| unit1-s7-sl4 | تطور السرعة | assets/unit1-s7-sl4.svg | scenes/unit1-s7-sl4.script.json |
| unit1-s8-sl1 | زمن نصف التفاعل | assets/unit1-s8-sl1.svg | scenes/unit1-s8-sl1.script.json |
| unit1-s10-sl2 | درجة الحرارة | assets/unit1-s10-sl2.svg | scenes/unit1-s10-sl2.script.json |

## مراجع خارج النطاق (تُقرأ ولا تُعدَّل)

- `public/course/course.json` — بنية الدروس النصية
- `KNOWLEDGE_BASE/lessons/unit_01_chemical_kinetics.md` — مصدر الحقائق