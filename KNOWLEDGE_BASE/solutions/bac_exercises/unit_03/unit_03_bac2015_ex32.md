---
id: solution/unit_03_bac2015_ex32
type: solution
title_ar: حل بكالوريا 2015 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2015_ex32
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2015
stream: رياضي + تقني رياضي
topic: مكثفة RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2015 – شعبة رياضي + تقني رياضي

## التمرين 32

**1- رسم الدار**

**2- المعادلة التفاضلية:**

بتطبيق قانون جمع التوتر:

$$u_C + u_R = E$$

$$RC \frac{du_C}{dt} + u_C = E$$

ومنه:

$$\frac{du_C}{dt} + \frac{1}{RC} \cdot u_C = \frac{E}{RC}$$

**3- البرهان:**

$$u_C(t) = A \cdot (1 - e^{-t/\tau})$$

$$\frac{du_C}{dt} = \frac{A}{\tau} \cdot e^{-t/\tau}$$

بالتعويض في المعادلة التفاضلية:

$$\frac{A}{\tau} \cdot e^{-t/\tau} + \frac{A}{RC} \cdot (1 - e^{-t/\tau}) = \frac{E}{RC}$$

$$\frac{A}{RC} + A \cdot e^{-t/\tau} \cdot \left(\frac{1}{\tau} - \frac{1}{RC}\right) = \fracE{RC}$$

حيث أن:

$$\frac{1}{\tau} - \frac{1}{RC} \cdot e^{-t/\tau} = 0$$

ومع:

$$A \cdot e^{-t/\tau} \neq 0$$

ومنه:

$$\frac{1}{RC} = \frac{1}{\tau}$$

ومنه:

$$\tau = RC$$

وبالتالي:

$$u_C(t) = E \cdot (1 - e^{-t/RC})$$

هي حل للمعادلة التفاضلية.

**4- إثبات العلاقة:**

$$u_C = E - E \cdot e^{-t/\tau}$$

$$E - u_C = E \cdot e^{-t/\tau}$$

$$\ln(E - u_C) = -\frac{t}{\tau} + \ln E$$

**5- بيانياً:**

**أ- قيمة $E$ بيانياً:**

العبارة $\ln(E - u_C) = a \cdot t + b$ حيث: $b = 1.5$

$$a = \frac{0 - 1.5}{1.5 \times 10^3 - 0} = -10^{-3}$$

$$\ln(E - u_C) = -1000 \cdot t + 1.5$$

بالمطابقة نجد: $\ln E = 1.5 \implies E = 4.5 \text{ V}$

**ب- قيمة كل من $\tau$ و $C$:**

$$\tau = \frac{1}{1000} = 10^{-3} = 0.001$$

$$C = \frac{\tau}{R} = \frac{0.001}{100} = 10.0 \text{ } \mu\text{F}$$

**6**

**أ- العبارة اللحظية للطاقة:**

$$E_C(t) = \frac{1}{2} C \cdot u_C^2(t) = \frac{1}{2} C \cdot E^2 \cdot (1 - e^{-t/RC})^2$$

**7- حساب $C'$:**

$$\frac{1}{C_{eq}} = \frac{1}{C} + \frac{1}{C'} \implies \frac{1}{C'} = \frac{1}{C} - \frac{1}{C} = \frac{1}{3} \times 10^3$$

$$C' = 3.33 \text{ } \mu\text{F}$$

ومنه المكثفة تربط على التسلسل مع المكثفة السابقة.
