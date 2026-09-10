---
id: concept/reaction_rate
type: concept
title_ar: سرعة التفاعل والسرعة الحجمية
title_en: Reaction rate and volumetric rate
unit: unit1
status: verified
source_refs:
  - api/data/البيانات/الوحدة الأولى/ملخص_المتابعة_الزمنية_لتحول_كيميائي.md
related_concepts: [concept/progress_table, concept/half_reaction_time, concept/kinetic_factors]
related_formulas: [formula/u1_reaction_rate]
related_exercises: []
---

# سرعة التفاعل

## السرعة اللحظية للتفاعل

$$v_{تفاعل}(t) = \frac{dx}{dt}\Big|_t$$

## السرعة الحجمية

$$v_{vol}(t) = \frac{1}{V_T} \times \frac{dx}{dt}\Big|_t$$

حيث V_T الحجم الكلي للمزيج التفاعلي.

## سرعات التكوّن والاختفاء

- تكوّن نوع: $v_C(t) = \frac{dn}{dt}\Big|_t$؛ حجمية: $v_{C,vol} = \frac{1}{V_T}\frac{dn}{dt}$.
- اختفاء نوع: $v_A(t) = -\frac{dn}{dt}\Big|_t$؛ حجمية: $v_{A,vol} = -\frac{1}{V_T}\frac{dn}{dt}$.

## العلاقات بين السرعات

$$v_{تفاعل} = \frac{v_A}{a} = \frac{v_B}{b} = \frac{v_C}{c} = \frac{v_D}{d}$$

$$v_{vol} = \frac{1}{V_T}v_{تفاعل}$$

## سلوك زمني

السرعة أَعظمية عند t=0 ثم تتناقص حتى تنعدم في نهاية التفاعل.

## بيانيًا

قيمة السرعة = ميل المماس لمنحنى x(t).