---
id: solution/unit_03_bac2014_ex29
type: solution
title_ar: حل بكالوريا 2014 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2014_ex29
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2014
stream: علوم تجريبية
topic: وشيعة RL – الشحن
review_notes: ["RQ-001"]
---

# حل بكالوريا 2014 – شعبة علوم تجريبية

## التمرين 29

**1**

**أ- عند غلق القاطعة $K$:**

التيار في فرع الذيع الداري لا يمر عبر الصمام، لأن هذا الأخير مستقطب عكسياً.

**ب- في النظام الدائم:**

$$I_{ste} = \frac{E}{R + r}$$

**2**

**أ- ربط الجهاز كما في الشكل:**

المنحنى $u_{BC} = f(t)$ المشاهد:

المقدار الفيزيائي الذي يماثل $u_{BC}(t)$ في التطور هو شدة التيار المار في الدار $BC$:

$$u_{BC} = R \cdot i \implies i = \frac{u_{BC}}{R}$$

**ب- المعادلة التفاضلية:**

بتطبيق قانون تجميع التوتر في الدار:

$$u_{AB} + u_{BC} = E$$

ومنه:

$$L \frac{di}{dt} + r \cdot i + R \cdot i = E$$

ومنه:

$$\frac{di}{dt} + \frac{R+r}{L} \cdot i = \frac{E}{L}$$

أو:

$$\tau \frac{di}{dt} + i = I_0$$

**ج-**

لدينا:

$$i(t) = 0.2 \times e^{-50t}$$

ومنه:

$$I_0 = \frac{E}{R+r} = 0.2 \text{ A}$$

بالتالي:

$$E = I_0 \times (R+r) = 12 \text{ V}$$

كذلك:

$$\frac{1}{\tau} = 50 \implies \tau = \frac{1}{50} = 0.02 \text{ s} = 20 \text{ ms}$$

حيث أن:

$$\tau = \frac{L}{R+r} = 0.02$$

فإن:

$$L = \tau \times (R+r) = 1.2 \text{ H}$$

**د- العبارة الطاقة المخزنة في الوشيعة:**

$$E_L(t) = \frac{1}{2} L \cdot i^2(t)$$

$$E_L(t) = \frac{1}{2} \times 1.2 \times (0.2)^2 \times e^{-100t} = 24 \times 10^{-3} \times e^{-100t}$$

قيمتها في اللحظة $t = \tau = 0.02 \text{ s}$:

$$E_L(\tau) = 9.5 \times 10^{-3} \text{ J}$$
