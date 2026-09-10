---
id: solution/unit_03_bac2009_ex07
type: solution
title_ar: حل بكالوريا 2009 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2009_ex07
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2009
stream: علوم تجريبية
topic: RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2009 – شعبة علوم تجريبية

## التمرين السابع: دائرة RC (شحن)

**1- المعادلة التفاضلية:**

$$u_C + u_R = E \quad \text{؛} \quad u_R = R \cdot i$$

$$u_C = E - R \cdot i$$

$$i = C \cdot \frac{du_C}{dt}$$

$$E = u_C + R \cdot C \cdot \frac{du_C}{dt}$$

بالتألي:

$$\frac{du_C}{dt} + \frac{1}{RC} \cdot u_C - \frac{E}{RC} = 0$$

**2-** حل للمعادلة التفاضلية:

لدينا:

$$u_C(t) = E \left(1 - e^{-\frac{t}{RC}}\right)$$

$$\frac{du_C}{dt} = \frac{E}{RC} \cdot e^{-\frac{t}{RC}}$$

بالتعويض في المعادلة التفاضلية، نجد:

$$\frac{E}{RC} \cdot e^{-\frac{t}{RC}} + \frac{E}{RC} \left(1 - e^{-\frac{t}{RC}}\right) - \frac{E}{RC} = 0$$

$$\frac{E}{RC} - \frac{E}{RC} = 0$$

و منه:

$$u_C(t) = E \left(1 - e^{-\frac{t}{RC}}\right) \quad \text{حل للمعادلة التفاضلية}$$

**3- وحدة المقدار $RC$ (التحليل البعدي):**

$$[RC] = [R] \times [C] = \frac{[V]}{[A]} \times \frac{[A] \times [T]}{[V]} = [T]$$

بالتألي: $RC$ متجانس مع الزمن.

مدلوله العملي بالنسبة للدار هو المدة الزمنية اللازم لشحن المكثفة بنسبة 63%.

اسمه: ثابت الزمن، يرمز له بالرمز: $\tau = RC$

**4- تكملة الجدول:**

| $t$ (ms) | 0 | 6 | 12 | 18 | 24 |
|---|---|---|---|---|---|
| $u_C(t)$ (V) | 0 | 3,79 | 5,19 | 5,70 | 5,89 |

**5- المنحنى البياني $u_C(t) = f(t)$:**

(انظر الشكل)

**6- العبارة اللفظية للشدة اللحظية للتيار الكهربائي $i(t)$:**

لدينا:

$$\frac{du_C}{dt} = \frac{E}{RC} \cdot e^{-\frac{t}{RC}} \quad \text{؛} \quad i = C \cdot \frac{du_C}{dt}$$

إذن:

$$i(t) = \frac{E}{R} \cdot e^{-\frac{t}{RC}}$$

قيمة الشدة في اللحظتين $t = 0$ و $t \to \infty$:

$$i(0) = \frac{E}{R} = \frac{6}{5 \times 10^3} = 1,2 \text{ mA}$$

$$i(\infty) = 0 \text{ mA}$$

**7-** العبارة للطاقة الكهربائية المخزنة في المكثفة:

بالتعريف:

$$E(t) = \frac{1}{2} C \cdot u_C(t)^2 \quad \text{؛} \quad u_C(\infty) = E = 6 \text{ V}$$

بالتألي:

$$E(\infty) = \frac{1}{2} \cdot 1,2 \times 10^{-6} \times 6^2 = 21,6 \; \mu\text{J}$$
