---
id: solution/unit_03_bac2015_ex31
type: solution
title_ar: حل بكالوريا 2015 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2015_ex31
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2015
stream: رياضي + تقني رياضي
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2015 – شعبة رياضي + تقني رياضي

## التمرين 31

**1- إيجاد المعادلة التفاضلية:**

بتطبيق قانون جمع التوتر:

$$L \frac{di}{dt} + (R+r) \cdot i = E$$

أو:

$$\frac{di}{dt} + \frac{R+r}{L} \cdot i = \frac{E}{L}$$

وهي من الشكل:

$$\frac{di}{dt} + \alpha \cdot i = \beta$$

بالمطابقة نجد:

$$\alpha = \frac{R+r}{L}$$

$$\beta = \frac{E}{L}$$

**2- التحقق من الحل:**

$$\frac{d}{dt}\left(e^{\alpha t} \cdot i(t)\right) = e^{\alpha t} \cdot \frac{di}{dt} + \alpha \cdot e^{\alpha t} \cdot i(t) = e^{\alpha t} \cdot \beta$$

$$e^{\alpha t} \cdot i(t) = \frac{\beta}{\alpha} \cdot e^{\alpha t} + K$$

$$i(t) = \frac{\beta}{\alpha} + K \cdot e^{-\alpha t}$$

وبالتعويض نجد:

$$i(t) = \frac{E}{R+r} \cdot (1 - e^{-\alpha t})$$

وهي الحل للمعادلة التفاضلية.

**3- العبارة $u_b(t)$:**

$$u_b(t) = L \frac{di}{dt} + r \cdot i(t)$$

$$= L \cdot \frac{E}{R+r} \cdot \alpha \cdot e^{-\alpha t} + r \cdot \frac{E}{R+r} \cdot (1 - e^{-\alpha t})$$

$$= E \cdot e^{-\alpha t} + \frac{rE}{R+r} - \frac{rE}{R+r} \cdot e^{-\alpha t}$$

أو بالطريقة:

$$u_b(t) = E - R \cdot I_0 \cdot e^{-\alpha t} = E + \frac{rE}{R+r} \cdot (e^{-\alpha t} - 1)$$

**4**

**أ- الرسم:**

**ب- من البيان نجد:**

- القوة المحركة الكهربائية للمولد: $E = 6 \text{ V}$
- مقاومة الوشيعة: $r = \frac{R \times E}{R+r} = \frac{1.5 \times 6}{1.5 \times 15} = 1.5 \text{ } \Omega$ و $R+r = 1.5 \times 15 = 22.5 \text{ } \Omega$
- ثابت الزمن: $\tau = 25 \text{ ms}$
- الذاتية: $L = \tau \times (R+r) = 0.025 \times 20 = 0.5 \text{ H}$

**5**

**أ- العبارة اللحظية للطاقة:**

$$E_L(t) = \frac{1}{2} L \cdot i^2(t) = \frac{1}{2} L \cdot \left(\frac{E}{R+r}\right)^2 \cdot (1 - e^{-(R+r)t/L})^2$$

(نقبل الجواب: $E_L = \frac{1}{2} L \cdot i^2$)

**ب- قيمة الطاقة في النظام الدائم:**

$$E_L = \frac{1}{2} L \cdot I_0^2 = \frac{1}{2} \times 0.5 \times \left(\frac{6}{15+5}\right)^2$$

$$= \frac{1}{2} \times 0.5 \times 2.25 \times 10^{-2} = \frac{1}{2} \times 0.5 \times \frac{2.25}{(15+5)^2} = 2.25 \times 10^{-2} \text{ J}$$
