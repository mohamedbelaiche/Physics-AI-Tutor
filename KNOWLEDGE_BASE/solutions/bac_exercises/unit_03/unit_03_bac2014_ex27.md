---
id: solution/unit_03_bac2014_ex27
type: solution
title_ar: حل بكالوريا 2014 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2014_ex27
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2014
stream: رياضي + تقني رياضي
topic: مكثفة RC – الشحن والتفريغ
review_notes: ["RQ-001"]
---

# حل بكالوريا 2014 – شعبة رياضي + تقني رياضي

## التمرين 27

### I

**1- المعادلة التفاضلية:**

بتطبيق قانون جمع التوتر:

$$u_R + u_C = 0$$

$$i = \frac{u_R}{R} = \frac{dq}{dt} = C \frac{du_C}{dt} \implies u_R = R \cdot C \frac{du_C}{dt}$$

إذن:

$$RC \frac{dq}{dt} + q = 0 \implies \frac{dq}{dt} + \frac{q}{RC} = 0$$

بالمطابقة مع المعادلة المعطاة نجد أن: $\alpha = \frac{1}{RC}$ والمعادلة محققة.

**2- العبارة الحرفية لـ $Q_0$ (كمية الشحنة العظمى):**

$$Q_0 = C \cdot u_{C0} = C \cdot E$$

$$Q_0 = 470 \times 10^{-9} \times 6 \times 2.2 = 2.82 \times 10^{-6} \text{ C}$$

**3- العبارة الحرفية لشدة التيار الكهربائي:**

$$i(t) = \frac{dQ}{dt} = -\frac{Q_0}{RC} \cdot e^{-t/RC}$$

$$i(t) = -\frac{CE}{RC} \cdot e^{-t/RC} = -\frac{E}{R} \cdot e^{-\alpha t}$$

### II

**1-**

**أ- قيمة اللحظة $t_1$:**

نحسب أولاً قيمة $u_C$ عند هذه اللحظة: $u_C = 6 \times 2.2 \times \frac{100}{36.8}$

من أجل هذه القيمة نجد من البيان: $t_1 = 0.24 \times 4 = 0.8 \text{ s}$

**ب- قيمة ثابت الزمن $\tau$:**

من البيان ومن أجل $u_C = 0.37 \times 6 \times 2.2 = 2.22 \text{ V}$:

$$\tau = 0.8 \text{ s}$$

**ج- استنتاج قيمة $R$:**

$$\tau = RC \implies R = \frac{\tau}{C} = \frac{0.8}{470 \times 10^{-9}} = 1.7 \times 10^{6} \text{ } \Omega$$

**2- حساب عدد التقلصات القلبية في الدقيقة:**

$$N = \frac{60}{t} = \frac{60}{0.8} = 75$$

**3- حساب الطاقة المحررة من المكثفة:**

$$E_{lib} = E_0 - E_r$$

حيث: $E_{lib}$ (الطاقة المحررة)، $E_0$ (الطاقة الابتدائية)، $E_r$ (الطاقة المتبقية)

$$E_{lib} = \frac{1}{2} C \cdot u_C^2 = \frac{1}{2} \times 470 \times 10^{-9} \times (6 \times 2.2)^2 = 7.32 \times 10^{-9} \text{ J}$$
