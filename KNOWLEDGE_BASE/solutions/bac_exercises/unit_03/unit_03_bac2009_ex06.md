---
id: solution/unit_03_bac2009_ex06
type: solution
title_ar: حل بكالوريا 2009 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2009_ex06
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2009
stream: رياضي + تقني رياضي
topic: RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2009 – شعبة رياضي + تقني رياضي

## التمرين السادس: دائرة RC (شحن)

**1- البادلة عند الوضع (1): (دار الشحن)**

**أ)** اتجاه التيار الكهربائي المار في الدار وتمثيل التوترين $u_C$ و $u_R$:

(انظر الشكل المقابل)

**ب)** التعبير عن $u_C$ و $u_R$ بدالة شحنة المكثفة $q = q_A$:

لدينا: $u_C = \frac{q}{C}$، $u_R = R \cdot i = R \cdot \frac{dq}{dt}$

إذن: $i = \frac{dq}{dt}$

**المعادلة التفاضلية:**

$$E = u_{AD} = u_C + u_R$$

$$E = \frac{q}{C} + R \cdot \frac{dq}{dt}$$

إذن:

$$\frac{dq}{dt} + \frac{1}{RC} \cdot q = \frac{E}{R} \quad \text{(معادلة تفاضلية من الرتبة الأولى)}$$

**ج)** العبارة لكل من $A$ و $\alpha$ بدالة $E$، $R$ و $C$:

حل المعادلة التفاضلية السابقة من الشكل:

$$q(t) = A \left(1 - e^{-\alpha t}\right)$$

إذن: $\frac{dq}{dt} = A \cdot \alpha \cdot e^{-\alpha t}$، بالتعويض في المعادلة التفاضلية:

$$A \cdot \alpha \cdot e^{-\alpha t} + \frac{A}{RC} \cdot e^{-\alpha t} - \frac{E}{R} = 0$$

و منه:

$$A \cdot e^{-\alpha t} \left(\alpha - \frac{1}{RC}\right) + \frac{E}{R} = 0$$

*عندما $t = 0$:*

$$A \cdot e^{0} = \frac{E}{R} \quad \Rightarrow \quad A = \frac{E}{R}$$

*عندما $t = \infty$:*

$$0 = \frac{E}{R} - \frac{A}{RC} \quad \Rightarrow \quad \alpha = \frac{1}{RC}$$

إذن:

$$\begin{cases} A = \dfrac{E}{R} \\[10pt] \alpha = \dfrac{1}{RC} \end{cases}$$

أي أن:

$$q(t) = C \cdot E \left(1 - e^{-\frac{t}{RC}}\right)$$

**د)** استنتاج قيمة $E$:

قيمة التوتر الكهربائي عند نهاية الشحن بين طرفي المكثفة $u_C = 5 \text{ V}$، عندئذ التيار لا يمر $(i = 0)$ لأن المكثفة مشحونة نهائيا وبذلك يكون:

$$u_C = E = 5 \text{ V}$$

$$u_R = 0 \quad \text{(نظام دائم)}$$

**هـ)** استنتاج سعة المكثفة $C$:

بالتعريف:

$$E = \frac{q_{\text{max}}^2}{2C} = \frac{1}{2} C E^2$$

$$C = \frac{2 \cdot E}{E^2}$$

$$C = \frac{2 \times 5 \times 10^{-3}}{2 \times 5^2} = \frac{10 \times 10^{-3}}{50} = 400 \; \mu\text{F}$$

**2- البادلة عند الوضع (2): (دار التفريغ)**

**أ)** يحدث للمكثفة تفريغ كهربائي في الناقل الأومي.

**ب)** المقارنة بين قيمتي ثابت الزمن الموافق للوضعين (1) ثم (2) للبادلة $K$:

*ثابت الزمن في الوضع (1) للبادلة:*

$$\tau_1 = R \cdot C = 470 \times 400 \times 10^{-6} = 0,188 \text{ s}$$

*ثابت الزمن في الوضع (2) للبادلة:*

$$\tau_2 = 2 \cdot R \cdot C = 2 \cdot RC = 2 \cdot \tau_1$$

نستنتج أن ثابت زمن دار التفريغ يعادل ضعف ثابت زمن دار الشحن.
