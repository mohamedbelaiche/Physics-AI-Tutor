---
id: solution/unit_03_bac2013_ex23
type: solution
title_ar: حل بكالوريا 2013 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2013_ex23
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2013
stream: رياضي + تقني رياضي
topic: مكثفة RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2013 – شعبة رياضي + تقني رياضي – التمرين 23

## 1 –

**أ – إيجاد المعادلة التفاضلية:**

$$u_R + u_C = 0$$

$$RC \cdot \frac{du_C}{dt} + u_C = 0$$

$$\therefore \frac{du_C}{dt} + \frac{u_C}{RC} = 0$$

**ب –** عبارة $u_C = A \cdot e^{\alpha t}$ هي حل للمعادلة التفاضلية السابقة:

$$\frac{du_C}{dt} = \alpha \cdot A \cdot e^{\alpha t}$$

بالتعويض في المعادلة التفاضلية:

$$\alpha \cdot A \cdot e^{\alpha t} + \frac{A \cdot e^{\alpha t}}{RC} = 0$$

$$A \cdot e^{\alpha t} \cdot \left(\alpha + \frac{1}{RC}\right) = 0$$

لكن $A \cdot e^{\alpha t} \neq 0$:

$$\alpha + \frac{1}{RC} = 0 \Rightarrow \alpha = -\frac{1}{RC}$$

$$u_C(0) = E = A$$

$$u_C(t) = E \cdot e^{-t/RC}$$

## 2 – عبارة الطاقة:

$$E_C(t) = \frac{1}{2} \cdot C \cdot E^2 \cdot e^{-2t/RC}$$

## 3 –

**أ – الطاقة العظمى للمكثفة:**

من البيان نجد: $E_0 = 140$ $\mu$J

**ب – معادلة المماس:** $E_C(t) = a \cdot t + b$

حيث: $a = \left(\frac{dE_C}{dt}\right)_{t=0}$

$$\frac{dE_C}{dt} = -\frac{2}{\tau} \cdot \frac{C \cdot E^2}{2} \cdot e^{-2t/\tau}$$

عند $t = 0$:

$$a = -\frac{CE^2}{\tau} = -\frac{2E_0}{\tau}$$

$$b = E_C(0) = \frac{CE^2}{2} = E_0$$

$$E_C(t) = -\frac{2E_0}{\tau} \cdot t + E_0$$

عند نقطة التقاطع مع محور الأزمنة:

$$-\frac{2E_0}{\tau} \cdot t + E_0 = 0$$

$$t = \frac{\tau}{2}$$

**ج – حساب $\tau$:**

$$\tau = 2 \text{ ms}$$

حساب سعة المكثفة:

$$\tau = RC \Rightarrow C = \frac{\tau}{R} = \frac{2 \times 10^{-3}}{6} = 2 \text{ } \mu\text{F}$$

## 4 – زمن تناقص الطاقة إلى النصف:

$$E_C(t_{1/2}) = \frac{E_0}{2}$$

$$\frac{CE^2}{4} = \frac{CE^2}{2} \cdot e^{-2t_{1/2}/\tau}$$

$$\frac{1}{2} = e^{-2t_{1/2}/\tau}$$

$$-\frac{2t_{1/2}}{\tau} = -\ln 2$$

$$t_{1/2} = \frac{\tau \cdot \ln 2}{2}$$

قيمته:

$$t_{1/2} = \frac{2 \times 10^{-3} \times 0{,}693}{2} = 0{,}693 \text{ ms}$$
