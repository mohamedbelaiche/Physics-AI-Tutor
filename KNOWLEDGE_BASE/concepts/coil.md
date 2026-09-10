---
id: concept/coil
type: concept
title_ar: الوشيعة (الذاتية والمقاومة الداخلية)
title_en: The coil (self-inductance and internal resistance)
unit: unit3
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/rl_dipole, concept/coil_energy]
related_formulas: [formula/u3_coil_voltage]
related_exercises: []
review_notes: ["RQ-001"]
---

# الوشيعة

## التعريف

عنصر كهربائي من سلك (عادة نحاس) ملفوف على شكل حلقات معزول بطبقة عازلة.

## الخصائص

- **الذاتية L** (هنري H): مقدار مميز يتعلق بالشكل الهندسي (طول l، نصف القطر R، عدد اللفات N).
- **المقاومة الداخلية r** (أوم Ω).
- الوشيعة الصرفة: r = 0.

## التوتر بين طرفيها

$$u_L = r.i + L\frac{di}{dt}$$

- إذا كانت i ثابتة: $\frac{di}{dt}=0$، وتتصرف كموصل أومي: u_L = r.i.
- إذا كانت i متغيرة والوشيعة صرفة: u_L = L·di/dt.