---
id: solution/unit_03_bac2017_ex42
type: solution
title_ar: حل بكالوريا 2017 – شعبة رياضيات + تقني رياضي (الدورة العادية)
exercise_ref: exercise/unit_03_bac2017_ex42
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2017
stream: رياضيات + تقني رياضي
topic: مكثفة + LC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2017 – شعبة رياضيات + تقني رياضي (الدورة العادية)

## 1-أ. الظاهرة التي تحدث في المكثفة

هي ظاهرة الشحن.

## 1-ب. اتجاه التيار المار في الدار واتجاه التوترين $u_C$ و $u_R$

(تُحدّد حسب المخطط مع إشارة الاتجاه المتعارف.)

## 2-أ. إيجاد المعادلة التفاضلية لـ $u_C(t)$

$$u_C + u_R = E$$

$$u_C + RC \cdot \frac{du_C}{dt} = E$$

$$\frac{du_C}{dt} + \frac{1}{RC} \cdot u_C = \frac{E}{RC}$$

## 2-ب. تعويض عبارتي $A$ و $B$ و $\alpha$ بدلالية مقادير الدار

$$u_C(t) = A + B \cdot e^{-\alpha t}$$

$$\frac{du_C}{dt} = -B\alpha \cdot e^{-\alpha t}$$

بالتعويض في المعادلة التفاضلية نجد:

$$-B\alpha \cdot e^{-\alpha t} + \frac{A + B \cdot e^{-\alpha t}}{RC} = \frac{E}{RC}$$

$$\frac{A \cdot e^{-\alpha t}}{RC} - \frac{B}{RC} \cdot e^{-\alpha t} + \frac{E}{RC} \cdot e^{-\alpha t} = 0$$

$$\alpha = \frac{1}{RC} \implies A = E$$

$$-\frac{1}{RC} - \frac{1}{RC} = 0 \implies \alpha = \frac{1}{RC} \implies B = 0$$

من الشروط الابتدائية:

عند $t = 0$ يكون $u_C(0) = 0 \implies u_C(0) = A + B = 0$

ومنه: $B = -A$

ومنه:

$$u_C(t) = E(1 - e^{-t/RC})$$

## 2-ج. إيجاد وحدة قياس $\alpha$ في ج.و.د (SI)

لدينا: $\alpha = \frac{1}{RC}$

بتطبيق قواعد التحليل البعدية نجد:

$$[\alpha] = \frac{[I]}{[U] \cdot [I] \cdot [I] \cdot [T]} = \frac{1}{[I] \cdot [T]} = S \cdot I$$

## 3-أ. إيجاد ثابت الزمن $\tau$ للدار

عند:

$$w_{C,\max} = \frac{1}{2}CE^2 \cdot (1 - e^{-2\tau/\tau}) = \frac{1}{2}CE^2 \cdot (1 - 0{,}63) = 7{,}9 \times 10^{-4} \text{ J}$$

من البيان $E = f(t)$ نجد: $\tau = 0{,}5$ s

## 3-ب. إيجاد القوة المحركة الكهربائية للمولد

عند اللحظة $t = 0$ يكون: $u_{R,\max}(0) = E = 9$ V

## 3-ج. إيجاد سعة المكثفة

$$\frac{E^2}{C} = 2 \cdot E_{C,\max} \implies C = \frac{49{,}4}{2E^2} \text{ F} \implies C = 49{,}9 \; \mu F$$

## 3-د. إيجاد مقاومة الناقل الأومي

$$R = \frac{\tau}{C} = \frac{0{,}5}{10{,}1 \times 10^{-6}} = 49{,}9 \times 10^3 \; \Omega$$

## 4-أ. المعادلة التفاضلية لتطور $u_C(t)$

بتطبيق قانون تجميع التوتر $(LC)$:

$$u_C(t) + u_L(t) = 0$$

لكن: $u_L = L \cdot \frac{di}{dt} = L \cdot C \cdot \frac{d^2u_C}{dt^2}$

ومنه:

$$\frac{d^2u_C}{dt^2} + \frac{1}{LC} \cdot u_C(t) = 0$$

## 4-ب. حل المعادلة التفاضلية

$$u_C(t) = A \cdot \cos\left(\frac{t}{\sqrt{LC}}\right)$$

ومنه:

$$\frac{d^2u_C}{dt^2} = -\frac{A}{LC} \cdot \cos\left(\frac{t}{\sqrt{LC}}\right)$$

$$\frac{d^2u_C}{dt^2} = -\frac{1}{LC} \cdot u_C(t)$$

وهو المطلوب.

عبارة الدور الذاتي: $T_0 = \frac{2\pi}{\omega_0}$ حيث $\omega_0 = \frac{1}{\sqrt{LC}}$ و مننه: $T_0 = 2\pi\sqrt{LC}$

عبارة $A$: عند $t = 0$ لدينا $u_C(0) = A = E$

## 4-ج. قيمة الدور الذاتي

$$T_0 = 4 \times 0{,}5 = 2 \text{ ms}$$

قيمة ذاتية الوشيعة:

$$L = \frac{T_0^2}{4\pi^2 C} = \frac{(2 \times 10^{-3})^2}{4 \times 50 \times 10^{-6}} = \frac{2 \times 10^{-6}}{2 \times 10^{-4}} = 2 \times 10^{-2} = 0{,}01 \text{ H} = 10 \text{ mH}$$
