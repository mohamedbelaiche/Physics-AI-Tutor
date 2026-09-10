---
id: concept/decay_law
type: concept
title_ar: قانون التناقص الإشعاعي
title_en: Radioactive decay law
unit: unit2
status: verified
source_refs:
  - api/data/البيانات/الوحدة الثانية/ملخص_التحولات_النووية.md
related_concepts: [concept/radioactive_decay, concept/half_life, concept/activity]
related_formulas: [formula/u2_decay_law, formula/u2_half_life, formula/u2_time_constant]
related_exercises: []
---

# قانون التناقص الإشعاعي

## الصيغة

$$N(t) = N_0 \cdot e^{-\lambda t} \qquad m(t) = m_0 \cdot e^{-\lambda t}$$

- N, N₀: عدد الأنوية المتبقية/الابتدائية.
- m, m₀: كتل العينة في t و t=0.
- λ: ثابت التفكك (s⁻¹) يتعلق بطبيعة النواة.

## السلوك البياني

N(t) يتناقص أسّيًا من N₀:
- عند $t = \tau$: $N \approx N_0/e$.
- عند $t = t_{1/2}$: $N = N_0/2$.

## مفاهيم مرتبطة

- زمن عمر النصف t₁/₂ = ln2/λ.
- ثابت الزمن τ = 1/λ (متوسط عمر النواة).
- النشاط A = λN (انظر concept/activity).