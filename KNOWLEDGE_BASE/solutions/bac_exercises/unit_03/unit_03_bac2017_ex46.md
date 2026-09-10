---
id: solution/unit_03_bac2017_ex46
type: solution
title_ar: حل بكالوريا 2017 – شعبة علوم تجريبية (الدورة الإضافية)
exercise_ref: exercise/unit_03_bac2017_ex46
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2017
stream: علوم تجريبية
topic: مكثفة + RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2017 – شعبة علوم تجريبية (الدورة الإضافية)

## 1-أ. الظاهرة الكهربائية

شحن المكثفة.

## 1-ب

(تُحدد حسب المخطط.)

## 1-ج. المعادلة التفاضلية

$$\frac{du_C}{dt} + \frac{1}{RC} \cdot u_C = \frac{E}{RC}$$

## 1-د. الحل

$$u_C(t) = E(1 - e^{-t/RC})$$

هو حل للمعادلة التفاضلية.

## 2-أ. المعادلة التفاضلية لشدة التيار

$$\frac{di(t)}{dt} + \frac{R}{L} \cdot i(t) = \frac{E}{L}$$

## 2-ب. إيجاد عبارة كل من $A$ و $B$

$$i(t) = A \cdot e^{-Rt/L} + B$$

$$\frac{di(t)}{dt} = -A \cdot \frac{R}{L} \cdot e^{-Rt/L}$$

$$-\frac{AR}{L} \cdot e^{-Rt/L} + \frac{R}{L} \cdot A \cdot e^{-Rt/L} + \frac{R}{L} \cdot B = \frac{E}{L}$$

$$B = \frac{E}{R}$$

$$i(0) = 0 \implies A + B = 0 \implies A = -B = -\frac{E}{R}$$

## 3-أ. ارفاق كل منحنى بالوضع المناسب للبادلة

شدة التيار في الوشيعة تتزايد مع مرور الزمن بينما في المكثفة تتناقص.

وبالتالي **البيان $(a)$ يوافق البادلة في الوضع (2)** و **البيان $(b)$ يوافق البادلة في الوضع (1)** و هو $u_C(t)$.

## 3-ب. قيم المقادير $E$، $R$، $C$ و $L$

من البيان $(b)$: $u_{C,\max} = E = 6$ V

من البيان $(a)$:

$$R = \frac{E}{I_{\max}} = \frac{E}{500} = 500 \; \Omega$$

من البيان $(b)$: $\tau_b = 10$ ms

$$C = \frac{\tau_b}{R} = \frac{2 \times 10^{-5}}{10} \implies C = 2 \times 10^{-5} \text{ F}$$

من البيان $(a)$: $\tau_a = 1$ ms

$$L = R \cdot \tau_a \implies L = 500 \times 0{,}5 = 0{,}5 \text{ mH} = 0{,}5 \text{ H}$$
