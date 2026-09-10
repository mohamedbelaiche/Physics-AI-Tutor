---
id: concept/projectile_motion
type: concept
title_ar: الحركة المنحنية (القذيفة)
title_en: Projectile (curved) motion
unit: unit5
status: verified
source_refs:
  - api/data/البيانات/الوحدة الخامسة/ملخص_الوحدة_الخامسة.md
related_concepts: [concept/newton_laws, concept/straight_line_motion, concept/circular_orbit]
related_formulas: [formula/u5_projectile, formula/u5_free_fall]
related_exercises: []
---

# حركة القذيفة

قذف جسم بسرعة ابتدائية $\vec{v}_0$ تصنع زاوية α مع الأفقي (نهمل الهواء):

- بالإسقاط: a_x = 0 (حركة مستقيمة منتظمة على Ox)، a_z = −g (نفس شيئ متغير بانتظام على Oz).

## المعادلات الزمنية

| المحور | السرعة | الموضع |
|---|---|---|
| Ox | $v_0\cos\alpha$ | $x = v_0\cos\alpha .t$ |
| Oz | $-g.t + v_0\sin\alpha$ | $z = -\frac{1}{2}g.t^2 + v_0\sin\alpha .t$ |

## معادلة المسار

$$z = -\frac{g}{2v_0^2\cos^2\alpha}x^2 + \tan\alpha.x$$

قطع مكافئ.

## النقاط الخاصة

$$t_s = \frac{v_0\sin\alpha}{g} \qquad x_s = \frac{v_0^2\sin 2\alpha}{2g} \qquad z_s = \frac{v_0^2\sin^2\alpha}{2g}$$

$$x_p = \frac{v_0^2\sin 2\alpha}{g}$$

- x_p = 2x_s؛ المدى أعظمي عند α=45°.