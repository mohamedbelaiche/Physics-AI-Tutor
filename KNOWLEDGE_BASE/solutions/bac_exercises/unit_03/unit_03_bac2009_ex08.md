---
id: solution/unit_03_bac2009_ex08
type: solution
title_ar: حل بكالوريا 2009 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2009_ex08
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2009
stream: علوم تجريبية
topic: تفريغ مكثفة RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2009 – شعبة علوم تجريبية

## التمرين الثامن: دائرة RC (تفريغ)

**1- رسم مخطط الدار:**

(انظر الشكل)

**2- تمثيل $i$ (انظر مخطط الدار).

**3- العلاقة بين $u_R$ و $u_C$:**

$$u_R + u_C = 0 \quad \text{؛} \quad u_R = -u_C$$

**4- المعادلة التفاضلية بدالة $u_C$:**

$$u_R + u_C = 0 \quad \text{؛} \quad u_R = R \cdot i = R \cdot \frac{dq}{dt}$$

إذن:

$$R \cdot \frac{dq}{dt} + u_C = 0$$

$$\frac{du_C}{dt} = \frac{1}{C} \cdot \frac{dq}{dt}$$

إذن:

$$RC \cdot \frac{du_C}{dt} + u_C = 0$$

أو:

$$\frac{du_C}{dt} + \frac{1}{RC} \cdot u_C = 0$$

**5- تعيين كل من $a$ و $b$:**

حل المعادلة التفاضلية السابقة هو من الشكل:

$$u_C = a \cdot e^{b \cdot t}$$

إذن: $\frac{du_C}{dt} = a \cdot b \cdot e^{b \cdot t}$، بالتعويض في المعادلة التفاضلية نجد:

$$a \cdot b \cdot e^{b \cdot t} + a \cdot e^{b \cdot t} \cdot \frac{1}{RC} = 0$$

أو:

$$a \cdot b \cdot RC \cdot e^{b \cdot t} + a \cdot e^{b \cdot t} = 0$$

و منه:

$$e^{b \cdot t} \cdot (a \cdot b \cdot RC + a) = 0 \quad \Rightarrow \quad a \cdot b \cdot RC + a = 0$$

$$a \cdot (b \cdot RC + 1) = 0$$

إذن:

$$b = -\frac{1}{RC} = -666,7 \quad \text{؛} \quad b \cdot RC + 1 = 0$$

عند $t = 0$ فإن:

$$u_C(0) = \frac{q_0}{C} = E = 6 \text{ V}$$

**6- العبارة الزمنية للتوتر $u_C$:**

$$u_C = a \cdot e^{b \cdot t}$$

$$a = E \quad \text{؛} \quad b = -\frac{1}{RC}$$

إذن:

$$u_C = E \cdot e^{-\frac{t}{RC}} = 6 \cdot e^{-666,7 \cdot t}$$

**7- بيانيًا:**

عند $t = 0$ فإن $u_C = 6 \text{ V}$

كذلك:

$$\tau = -\frac{1}{b} = RC$$

$$t = 3 \cdot \tau = 1,5 \times 10^{-3} \text{ s} \quad \Rightarrow \quad u_C = 0,37 \cdot E = 2,22 \text{ V}$$

إذن:

$$b = -\frac{1}{\tau} = -\frac{1}{1,5 \times 10^{-3}} = -666,7 \text{ s}^{-1}$$

و هي نفس القيم لـ $a$ و $b$ المتحصل عليها في إجابة السؤال 5.
