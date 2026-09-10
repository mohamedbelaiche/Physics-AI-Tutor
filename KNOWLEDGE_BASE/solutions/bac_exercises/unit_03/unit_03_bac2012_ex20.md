---
id: solution/unit_03_bac2012_ex20
type: solution
title_ar: حل بكالوريا 2012 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2012_ex20
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2012
stream: رياضي + تقني رياضي
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2012 – شعبة رياضي + تقني رياضي – التمرين 20

## 1 –

**أ – العلاقة التي تربط $u_b(t)$، $u_R(t)$ و $E$:**

من قانون جمع التوتر:

$$E = u_R(t) + u_b(t) \quad \text{... (1)}$$

**ب – عبارة $u_b(t)$ بدلالة $i(t)$:**

$$u_b(t) = L \cdot \frac{di(t)}{dt} + r \cdot i(t) \quad \text{... (2)}$$

**عبارة $u_b(t)$ بدلالة $u_R(t)$:**

$$u_R(t) = R \cdot i(t) \Rightarrow i(t) = \frac{u_R(t)}{R} \Rightarrow \frac{di(t)}{dt} = \frac{1}{R} \cdot \frac{du_R(t)}{dt}$$

بالتعويض في (2):

$$u_b(t) = \frac{L}{R} \cdot \frac{du_R(t)}{dt} + \frac{r}{R} \cdot u_R(t)$$

**ج – المعادلة التفاضلية:**

تصبح العلاقة (1):

$$\frac{r + R}{L} \cdot u_R(t) + \frac{R}{L} \cdot \frac{du_R(t)}{dt} = \frac{R}{L} \cdot E$$

## 2 – تعيين الثوابت $A$، $B$ و $m$:

نشتق $u_R(t)$:

$$u_R(t) = A - B \cdot e^{-m \cdot t}$$

$$\frac{du_R(t)}{dt} = -B \cdot m \cdot e^{-m \cdot t}$$

نعوض $u_R(t)$ و $\frac{du_R(t)}{dt}$ في المعادلة التفاضلية:

$$-B \cdot m \cdot e^{-m \cdot t} + \frac{r + R}{L} \cdot \left(A - B \cdot e^{-m \cdot t}\right) = \frac{R}{L} \cdot E$$

حتى تتحقق هذه المساواة يجب أن يكون معامل $e^{-m \cdot t}$ معدوماً:

$$m = \frac{r + R}{L}$$

$$A = \frac{R}{r + R} \cdot E$$

من الشروط الابتدائية:

$$u_R(0) = 0 \Rightarrow A - B = 0 \Rightarrow B = A = \frac{R}{r + R} \cdot E$$

$$u_R(t) = \frac{R}{r + R} \cdot E \cdot \left(1 - e^{-t/\tau}\right)$$

حيث $\tau = \frac{L}{r + R}$.

## 3 –

**أ – عبارة $I_0$ في النظام الدائم:**

في النظام الدائم $\frac{di(t)}{dt} = 0$:

$$I_0 = \frac{E}{R + r}$$

**ب – الشدة $I_0$ بيانياً:** $I_0 = 18$ mA

مقاومة الوشيعة:

$$r \approx \frac{E}{I_0} - R = 11 \text{ } \Omega$$

**ج – عبارة ثابت الزمن $\tau$:**

$$\tau = \frac{L}{R + r}$$

التحليل البعدي:

$$[\tau] = \frac{[L]}{[R]} = \frac{U \cdot T}{I} \cdot \frac{I}{U} = T \text{ (الزمن)}$$

متجانس مع الزمن.

**د – قيمة $\tau$ بيانياً:**

من إحدى الطريقتين (طريقة المماس عند $t = 0$ أو طريقة 63%) نجد:

$$\tau \approx 4 \text{ ms}$$

قيمة الذاتية $L$:

$$L = \tau \cdot (R + r) = 0{,}44 \text{ H}$$
