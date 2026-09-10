---
id: solution/unit_03_bac2015_ex33
type: solution
title_ar: حل بكالوريا 2015 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2015_ex33
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2015
stream: علوم تجريبية
topic: مكثفة RC – الشحن
review_notes: ["RQ-001"]
---

# حل بكالوريا 2015 – شعبة علوم تجريبية

## التمرين 33

**1**

من البيان $u_C = f(t)$ ظاهرة جداً، فالجهاز قصير، فإن مدة الظاهرة المناسب لمتابعتها عملياً هو "اسم الإهتزاز ذي الذاكرة."

**2**

**أ- طريقة توصيل راسم الإهتزاز:**

**ب- حساب النسبة:**

$$\frac{u_C(t_2)}{u_C(t_1)} = \frac{2 \times (1 - e^{-t_2/\tau})}{(1 - e^{-t_1/\tau})} = \frac{2}{1} \times \frac{e^{-t_2/\tau} - 1}{e^{-t_1/\tau} - 1} = 0.4$$

**3**

بتطبيق قانون جمع التوتر في الدار $RC$، نجد:

$$E = u_C + u_R$$

مع:

$$u_R = R \cdot i$$

و:

$$i = C \frac{du_C}{dt} = \frac{dq}{dt}$$

ومنه:

$$\frac{du_C}{dt} = \frac{E - u_C}{RC}$$

أو:

$$\frac{du_C}{dt} + \frac{1}{RC} \cdot u_C = \frac{E}{RC}$$

**4- التحقق:**

$$u_C(t) = E \cdot (1 - e^{-t/\tau})$$

بالتالي:

$$\frac{du_C}{dt} = \frac{E}{\tau} \cdot e^{-t/\tau}$$

وبالتعويض في المعادلة التفاضلية نجد:

$$\frac{E}{\tau} \cdot e^{-t/\tau} + \frac{E}{\tau} \cdot (1 - e^{-t/\tau}) = \frac{E}{\tau}$$

$$\frac{E}{\tau} = \frac{E}{\tau}$$

ومنه: $\tau = RC$

**5- البرهان:**

$$u_C(t) = E \cdot (1 - e^{-t/\tau})$$

ومنه:

$$u_C(\tau) = E \cdot (1 - e^{-1}) = E \cdot (1 - 0.37) = 0.63 \cdot E$$

بيانياً: $E = 2 \text{ V}$

بإسقاط القيمة $0.63E = 1.26 \text{ V}$ على البيان نجد: $\tau = 6.7 \text{ ms}$

**6- قيمة السعة:**

$$\tau = R \cdot C$$

$$C = \frac{\tau}{R} = \frac{6 \times 10^{-3}}{100} = 60 \text{ } \mu\text{F}$$
